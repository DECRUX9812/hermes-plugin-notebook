"""Media sources: extension routing, ffmpeg segmentation, Groq upload.

Self-contained — no Hermes host. The network and ffmpeg layers are separate
module-level functions in hermes_notebook.media so everything here runs with
plain monkeypatching; the one test that shells out to ffmpeg skips when the
binary is absent.
"""

import email.message
import shutil
import subprocess
import urllib.error
from pathlib import Path

import pytest

from hermes_notebook import extract, ingest, media, runtime


EXPECTED_MEDIA = {
    ".mp3", ".m4a", ".wav", ".flac", ".ogg", ".oga", ".aac", ".opus",
    ".mp4", ".mov", ".m4v", ".webm", ".mkv",
}


def test_media_extension_sets():
    assert media.MEDIA_EXTS == EXPECTED_MEDIA
    assert extract.MEDIA_EXTS == EXPECTED_MEDIA
    for ext in EXPECTED_MEDIA:
        assert media.is_media_path(Path(f"clip{ext}"))
        assert media.is_media_path(Path(f"clip{ext.upper()}"))
    for name in ["notes.txt", "a.pdf", "b.png", "noext", "x.m4b"]:
        assert not media.is_media_path(Path(name))


def test_kind_for_path_routes_media(tmp_path):
    cases = {
        "a.mp3": "audio", "b.wav": "audio", "c.flac": "audio", "d.opus": "audio",
        "e.oga": "audio", "f.m4a": "audio",
        "g.mp4": "video", "h.mov": "video", "i.webm": "video", "j.mkv": "video",
    }
    for name, want in cases.items():
        p = tmp_path / name
        assert extract.kind_for_path(p) == want, name
        assert extract.is_supported_path(p), name
    assert extract.kind_for_path(tmp_path / "z.bin") == "unknown"


def test_extract_file_refuses_media_with_guidance(tmp_path):
    p = tmp_path / "interview.mp3"
    p.write_bytes(b"\x00")
    with pytest.raises(extract.ExtractionError) as info:
        extract.extract_file(p)
    assert "transcri" in str(info.value) and "media" in str(info.value)


def test_transcribe_joins_stripped_chunks(tmp_path, monkeypatch):
    source = tmp_path / "talk.mp3"
    source.write_bytes(b"fake audio")
    chunk_a = tmp_path / "segment-0000.mp3"
    chunk_b = tmp_path / "segment-0001.mp3"
    chunk_a.write_bytes(b"a")
    chunk_b.write_bytes(b"b")
    posted = []

    monkeypatch.setenv(media.API_KEY_ENV, "test-key")
    monkeypatch.setattr(media, "_ffmpeg_segments",
                        lambda path, workdir, **kw: [chunk_a, chunk_b])

    def fake_post(url, fields, file_field, file_path, **kw):
        posted.append({"url": url, "fields": fields, "file": file_path.name, **kw})
        return {"text": "  hello there  " if chunk_a == file_path else "general kenobi "}

    monkeypatch.setattr(media, "_post_multipart", fake_post)

    assert media.transcribe(source) == "hello there general kenobi"
    assert len(posted) == 2
    assert all(p["url"] == media.TRANSCRIBE_URL for p in posted)
    assert posted[0]["fields"]["model"] == media.TRANSCRIBE_MODEL
    assert posted[0]["headers"]["Authorization"] == "Bearer test-key"


def test_transcribe_missing_key_raises_before_ffmpeg(tmp_path, monkeypatch):
    source = tmp_path / "talk.mp3"
    source.write_bytes(b"fake audio")
    monkeypatch.delenv(media.API_KEY_ENV, raising=False)
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "no-home"))
    monkeypatch.setattr(runtime, "config", lambda *a, **kw: "")
    # the env-file fallback must not find the developer's own key either
    monkeypatch.setattr(media, "_key_from_env_file", lambda: "")
    monkeypatch.setattr(media, "_ffmpeg_segments",
                        lambda *a, **kw: pytest.fail("ffmpeg must not run without a key"))
    with pytest.raises(extract.ExtractionError) as info:
        media.transcribe(source)
    assert "Groq API key" in str(info.value)
    assert media.API_KEY_ENV in str(info.value)


def test_transcribe_falls_back_to_plugin_config(tmp_path, monkeypatch):
    source = tmp_path / "talk.mp3"
    source.write_bytes(b"fake audio")
    monkeypatch.delenv(media.API_KEY_ENV, raising=False)
    monkeypatch.setattr(runtime, "config",
                        lambda key, default=None: "cfg-key" if key == media.API_KEY_CONFIG else default)
    chunk = tmp_path / "seg.mp3"
    chunk.write_bytes(b"a")
    monkeypatch.setattr(media, "_ffmpeg_segments", lambda *a, **kw: [chunk])
    monkeypatch.setattr(media, "_post_multipart",
                        lambda *a, **kw: {"text": "from config"})
    assert media.transcribe(source) == "from config"


def test_transcribe_empty_transcript_raises(tmp_path, monkeypatch):
    source = tmp_path / "silence.m4a"
    source.write_bytes(b"fake audio")
    chunk = tmp_path / "seg.mp3"
    chunk.write_bytes(b"a")
    monkeypatch.setenv(media.API_KEY_ENV, "test-key")
    monkeypatch.setattr(media, "_ffmpeg_segments", lambda *a, **kw: [chunk])
    monkeypatch.setattr(media, "_post_multipart", lambda *a, **kw: {"text": " \n\t "})
    with pytest.raises(extract.ExtractionError) as info:
        media.transcribe(source)
    assert "no text" in str(info.value)


def test_missing_ffmpeg_raises(tmp_path, monkeypatch):
    source = tmp_path / "talk.mp3"
    source.write_bytes(b"fake audio")
    monkeypatch.setattr(media.shutil, "which", lambda name: None)
    with pytest.raises(extract.ExtractionError) as info:
        media._ffmpeg_segments(source, tmp_path)
    assert "ffmpeg" in str(info.value)


def test_http_error_reports_status_and_body(tmp_path, monkeypatch):
    payload = tmp_path / "seg.mp3"
    payload.write_bytes(b"audio")

    class ErrorWithBody:
        def read(self, n=-1):
            return b'{"error": "invalid api key"}'

        def close(self):
            pass

    headers = email.message.Message()

    def urlopen(req, timeout=None):
        raise urllib.error.HTTPError(media.TRANSCRIBE_URL, 401, "Unauthorized", headers,
                                     ErrorWithBody())

    monkeypatch.setattr(media.urllib.request, "urlopen", urlopen)
    with pytest.raises(extract.ExtractionError) as info:
        media._post_multipart(media.TRANSCRIBE_URL, {"model": "m"}, "file", payload,
                              headers={"Authorization": "Bearer x"})
    message = str(info.value)
    assert "HTTP 401" in message and "invalid api key" in message


def test_multipart_body_is_well_formed(tmp_path):
    payload = tmp_path / "seg.mp3"
    payload.write_bytes(b"AUDIO-BYTES")
    body, content_type = media._encode_multipart(
        {"model": "whisper-large-v3-turbo", "response_format": "json"},
        "file", payload, "seg.mp3")
    boundary = content_type.split("boundary=", 1)[1]
    assert content_type.startswith("multipart/form-data")
    assert body.startswith(f"--{boundary}".encode())
    assert body.endswith(f"--{boundary}--\r\n".encode())
    assert b'name="model"' in body and b"whisper-large-v3-turbo" in body
    assert b'AUDIO-BYTES' in body
    assert f'name="file"; filename="seg.mp3"'.encode() in body


def test_ingest_routes_media_through_transcribe(tmp_path, monkeypatch):
    audio = tmp_path / "episode 1.mp3"
    audio.write_bytes(b"\x00")
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"\x00")
    monkeypatch.setattr(media, "transcribe", lambda path: f"transcript of {path.name}")

    title, kind, origin, body = ingest._extract_any(path=str(audio))
    assert title == "episode 1"
    assert kind == "audio"
    assert origin == str(audio)
    assert body == "Media file: episode 1.mp3\nDuration: n/a\n\ntranscript of episode 1.mp3"

    title, kind, origin, body = ingest._extract_any(path=str(video))
    assert (title, kind) == ("clip", "video")
    assert body.startswith("Media file: clip.mp4\nDuration: n/a\n\n")


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_ffmpeg_segments_produces_audio_windows(tmp_path):
    source = tmp_path / "sine.wav"
    proc = subprocess.run(
        ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=2.5",
         "-ac", "1", "-ar", "16000", str(source)],
        capture_output=True, text=True, timeout=120)
    assert proc.returncode == 0, proc.stderr
    segments = media._ffmpeg_segments(source, tmp_path, window_s=1)
    assert 2 <= len(segments) <= 4
    assert all(seg.exists() and seg.stat().st_size > 0 for seg in segments)
