"""Audio/video → transcript, via ffmpeg segmentation and Groq Whisper.

Media files are first-class sources the same way images are: instead of text
being pulled out of a document, the body is a transcript of the speech. ffmpeg
does the decoding (normalise to 16 kHz mono mp3, cut into upload-sized windows);
Groq's OpenAI-compatible transcription endpoint does the speech-to-text.

No new Python dependency: the only external requirement is the ffmpeg binary,
and the upload is a hand-built multipart/form-data request on urllib.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from . import runtime
from .extract import AUDIO_EXTS, VIDEO_EXTS, ExtractionError

MEDIA_EXTS = AUDIO_EXTS | VIDEO_EXTS

TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
TRANSCRIBE_MODEL = "whisper-large-v3-turbo"

# 10 minutes of 32 kbps mono mp3 is ~2.4 MB — comfortably inside Groq's 20 MB
# upload cap, with headroom for the odd mismatch between bitrate and file size.
SEGMENT_SECONDS = 600  # ~2.4 MB of 32 kbps mono mp3 per chunk, far under 20 MB
HTTP_TIMEOUT = 180.0
API_KEY_ENV = "GROQ_API_KEY"
API_KEY_CONFIG = "groq_api_key"
#: api.groq.com sits behind Cloudflare, which answers urllib's default UA with
#: "Error 1010: Access denied". A named client is let through.
USER_AGENT = "HermesNotebook/1.5 (+https://github.com/DECRUX9812/hermes-plugin-notebook)"


def is_media_path(path: Path) -> bool:
    """True when *path*'s extension is one :func:`transcribe` handles."""
    return Path(path).suffix.lower() in MEDIA_EXTS


def transcribe(path: Path) -> str:
    """Transcript text for one audio/video file. Raises ExtractionError.

    Returns the transcript only — the caller owns the surrounding header/title,
    so this stays reusable for refresh, search, and any future pipeline.
    """
    p = Path(path).expanduser()
    if not p.is_file():
        raise ExtractionError(f"media file not found: {p}")

    key = _api_key()
    if not key:
        raise ExtractionError(
            "transcription needs a Groq API key: set GROQ_API_KEY in the "
            "environment or 'groq_api_key' in the plugin config"
        )

    parts: list[str] = []
    with tempfile.TemporaryDirectory(prefix="hermes-notebook-media-") as tmp:
        for segment in _ffmpeg_segments(p, Path(tmp)):
            data = _post_multipart(
                TRANSCRIBE_URL,
                {"model": TRANSCRIBE_MODEL, "response_format": "json", "temperature": "0"},
                "file", segment, filename=segment.name,
                headers={"Authorization": f"Bearer {key}"},
            )
            text = str(data.get("text") or "").strip()
            if text:
                parts.append(text)

    transcript = " ".join(parts).strip()
    if not transcript:
        raise ExtractionError(
            f"transcription returned no text for {p.name} — the file may contain "
            "no audible speech, or the audio track may be silent"
        )
    return transcript


# --------------------------------------------------------------- internals

def _api_key() -> str:
    """GROQ_API_KEY from the environment, the plugin's config slot, or the
    Hermes env file — in that order, so a host that keeps its keys in
    `$HERMES_HOME/.env` (the normal Hermes layout) works with no extra setup."""
    value = os.environ.get(API_KEY_ENV, "").strip()
    if value:
        return value
    configured = runtime.config(API_KEY_CONFIG, "")
    if str(configured or "").strip():
        return str(configured).strip()
    return _key_from_env_file()


def _key_from_env_file() -> str:
    """Read GROQ_API_KEY out of a Hermes `.env`. Never logs or returns the path's
    contents; a missing/unreadable file is simply "no key"."""
    homes = [
        os.environ.get("HERMES_HOME", ""),
        str(Path.home() / ".hermes"),
        str(Path.home() / ".hermes-webapp"),
    ]
    for home in homes:
        if not home:
            continue
        for name in (".env", "env"):
            path = Path(home) / name
            try:
                if not path.is_file() or path.stat().st_size > 200_000:
                    continue
                for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                    key, _, val = line.partition("=")
                    if key.strip() == API_KEY_ENV:
                        return val.strip().strip('"').strip("'")
            except OSError:
                continue
    return ""


def _ffmpeg_segments(path: Path, workdir: Path, *,
                     window_s: int = SEGMENT_SECONDS) -> list[Path]:
    """Decode *path* to mono 16 kHz mp3 windows of ~*window_s* seconds.

    The segment muxer splits on duration and stops at end-of-stream by itself —
    no duration probe, and no empty tail chunks (a per-window ``-ss`` seek past
    the end still writes a bare mp3 header).
    """
    exe = shutil.which("ffmpeg")
    if not exe:
        raise ExtractionError(
            "ffmpeg is required to transcribe audio/video sources — install it "
            "(e.g. 'sudo apt install ffmpeg') and re-add the file"
        )
    pattern = str(workdir / "segment-%04d.mp3")
    list_path = workdir / "segments.txt"
    cmd = [
        exe, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(path),
        "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-b:a", "32k",
        "-f", "segment", "-segment_format", "mp3",
        "-segment_time", str(window_s),
        "-segment_list", str(list_path), "-segment_list_type", "flat",
        "-reset_timestamps", "1", pattern,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
    if proc.returncode != 0:
        detail = (proc.stderr or "").strip().splitlines()[-1:] or ["unknown error"]
        raise ExtractionError(
            f"ffmpeg could not decode {path.name}: {detail[0][:200]}"
        )
    segments: list[Path] = []
    if list_path.exists():
        for line in list_path.read_text(encoding="utf-8", errors="replace").splitlines():
            name = line.split(",")[0].strip()
            if not name:
                continue
            candidate = workdir / Path(name).name
            if candidate.exists() and candidate.stat().st_size > 0:
                segments.append(candidate)
    if not segments:
        segments = sorted(
            p for p in workdir.glob("segment-*.mp3") if p.stat().st_size > 0
        )
    if not segments:
        raise ExtractionError(
            f"ffmpeg produced no audio from {path.name} — the file may have no "
            "audio track or be corrupt"
        )
    return segments


def _post_multipart(url: str, fields: dict[str, str], file_field: str,
                    file_path: Path, *, filename: str = "",
                    headers: dict[str, str] | None = None,
                    timeout: float = HTTP_TIMEOUT) -> dict:
    """POST a hand-built multipart/form-data body; parse the JSON response."""
    body, content_type = _encode_multipart(fields, file_field, file_path,
                                           filename or file_path.name)
    request_headers = {"Content-Type": content_type, "Accept": "application/json",
                       # Cloudflare fronts api.groq.com and answers the default
                       # "Python-urllib" signature with 1010 Access denied.
                       "User-Agent": USER_AGENT}
    request_headers.update(headers or {})
    req = urllib.request.Request(url, data=body, headers=request_headers,
                                 method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read(400).decode("utf-8", errors="replace").strip()
        except Exception:
            detail = ""
        raise ExtractionError(
            f"Groq transcription failed: HTTP {exc.code}"
            + (f" — {detail[:200]}" if detail else "")
        ) from exc
    except Exception as exc:
        raise ExtractionError(f"Groq transcription request failed: {exc}") from exc
    try:
        data = json.loads(raw.decode("utf-8", errors="replace"))
    except ValueError as exc:
        raise ExtractionError(
            f"Groq transcription returned non-JSON: {raw[:200]!r}"
        ) from exc
    if not isinstance(data, dict):
        raise ExtractionError("Groq transcription returned an unexpected payload")
    return data


def _encode_multipart(fields: dict[str, str], file_field: str,
                      file_path: Path, filename: str) -> tuple[bytes, str]:
    """(body, content_type) for one file plus plain string fields."""
    boundary = f"----HermesNotebook{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"'
            f"\r\n\r\n{value}\r\n".encode("utf-8")
        )
    safe_name = filename.replace('"', "_")
    chunks.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; '
        f'filename="{safe_name}"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode("utf-8")
    )
    chunks.append(file_path.read_bytes())
    chunks.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"
