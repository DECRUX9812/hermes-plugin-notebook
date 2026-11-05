"""Source ingestion: turn a user-supplied path / URL / text / YouTube link into
a stored, labeled source record.

Auto-labeling: after text extraction, a cheap structured LLM call assigns 2-5
short topic labels and a one-line summary (NotebookLM-style source chips). The
call is best-effort — a failure never blocks ingestion.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

from . import extract, runtime, store

MAX_TEXT_SOURCE_CHARS = 400_000
MAX_WEB_EXTRACT_CHARS = 120_000

_YT_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?[^#]*v=|youtu\.be/|youtube\.com/shorts/|youtube\.com/embed/|youtube\.com/live/)([\w-]{11})"),
    re.compile(r"youtube\.com/watch\?v=([\w-]{11})"),
]


def _yt_video_id(url: str) -> Optional[str]:
    for pat in _YT_PATTERNS:
        m = pat.search(url)
        if m:
            return m.group(1)
    return None


def _looks_like_url(s: str) -> bool:
    return bool(re.match(r"^https?://", s.strip(), re.IGNORECASE))


def _http_json(url: str, timeout: float = 10.0) -> Optional[dict]:
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HermesNotebook/0.1"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read(200_000).decode("utf-8", errors="replace"))
    except Exception:
        return None


def _youtube_title(video_id: str, url: str) -> str:
    meta = _http_json(f"https://www.youtube.com/oembed?url={url}&format=json")
    if isinstance(meta, dict) and meta.get("title"):
        return str(meta["title"])[:200]
    return f"YouTube video {video_id}"


def _youtube_transcript(video_id: str) -> str:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError as exc:
        raise extract.ExtractionError(
            "YouTube sources need the youtube-transcript-api package (declared plugin dependency)"
        ) from exc
    api = YouTubeTranscriptApi()
    try:
        transcript = api.fetch(video_id)
    except Exception:
        # 1.x fallback surface
        try:
            transcript = YouTubeTranscriptApi.get_transcript(video_id)
        except Exception as exc2:
            raise extract.ExtractionError(
                f"could not fetch YouTube transcript for {video_id}: {exc2} "
                "(video may have no captions or be region-locked)"
            ) from exc2
    parts = []
    for snippet in transcript:
        text = getattr(snippet, "text", None) or (snippet.get("text") if isinstance(snippet, dict) else "")
        if text:
            parts.append(str(text).strip())
    body = " ".join(parts).strip()
    if not body:
        raise extract.ExtractionError("YouTube transcript was empty")
    return body


# ------------------------------------------------------------- web_extract

def _web_extract(url: str) -> tuple[str, str]:
    """ctx.dispatch_tool('web_extract') → (title, text). Raises on failure."""
    raw = runtime.dispatch("web_extract", {"urls": [url], "char_limit": 60000})
    if isinstance(raw, dict):
        data = raw
    else:
        try:
            data = json.loads(raw)
        except (ValueError, TypeError) as exc:
            raise extract.ExtractionError(f"web_extract returned non-JSON: {str(raw)[:200]}") from exc
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list) or not results:
        err = data.get("error") if isinstance(data, dict) else None
        raise extract.ExtractionError(f"web_extract failed: {err or str(data)[:200]}")
    entry = results[0]
    if entry.get("error"):
        raise extract.ExtractionError(f"web_extract error: {entry['error']}")
    content = entry.get("content") or ""
    title = entry.get("title") or url
    # Large pages get truncated with "Full text saved to: <path>" — read the file.
    m = re.search(r"Full text saved to:\s*(\S+)", content)
    if m:
        try:
            full = Path(m.group(1)).read_text(encoding="utf-8", errors="replace")
            if len(full) > len(content):
                content = full
        except OSError:
            pass
    content = content.strip()
    if not content:
        raise extract.ExtractionError("web_extract returned empty content")
    return str(title)[:200], content[:MAX_WEB_EXTRACT_CHARS]


def _direct_fetch(url: str) -> tuple[str, str]:
    final_url, payload = extract.fetch_url_text(url)
    text = extract.html_to_text(payload)
    if not text.strip():
        # maybe it was plain text / markdown already
        text = payload.strip()
    title = extract.title_from_html(payload if "<" in payload[:5000] else "", final_url)
    return title[:200], text[:MAX_WEB_EXTRACT_CHARS]


def ingest_url(url: str) -> tuple[str, str, str]:
    """(title, kind, text) for a web URL."""
    vid = _yt_video_id(url)
    if vid:
        text = _youtube_transcript(vid)
        title = _youtube_title(vid, url)
        header = f"YouTube video: {url}\nTitle: {title}\nVideo ID: {vid}\n\n"
        return title, "youtube", header + text
    try:
        title, text = _web_extract(url)
    except extract.ExtractionError:
        title, text = _direct_fetch(url)
    header = f"Source URL: {url}\n\n"
    return title, "url", header + text


# ------------------------------------------------------------------ images

def _describe_image(path: Path) -> str:
    """Vision-describe an image into source text via ctx.llm (host credentials)."""
    data = path.read_bytes()
    if len(data) > 15_000_000:
        raise extract.ExtractionError("image too large (>15MB)")
    mime = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp",
        ".tiff": "image/tiff", ".tif": "image/tiff",
    }.get(path.suffix.lower(), "image/png")
    result = runtime.llm().complete_structured(
        instructions=(
            "Describe this image thoroughly for a knowledge base: what it shows, "
            "any text it contains (transcribe verbatim), diagrams, charts, UI, "
            "data, and context a reader would need. Write 2-6 paragraphs of plain "
            "descriptive text. If it is a document scan or slide, extract its "
            "structure and content."
        ),
        input=[{"type": "image", "data": data, "mime_type": mime, "file_name": path.name}],
        json_mode=False,
        purpose="hermes-notebook.describe_image",
        max_tokens=1200,
        temperature=0.2,
    )
    text = (result.text or "").strip()
    if not text:
        raise extract.ExtractionError("vision model returned an empty description")
    return f"Image file: {path.name}\n\n{text}"


# -------------------------------------------------------------------- main

def ingest(notebook: str, *, path: Optional[str] = None, url: Optional[str] = None,
           text: Optional[str] = None, title: Optional[str] = None,
           kind_hint: Optional[str] = None) -> dict:
    """Ingest one source into the notebook. Returns the stored index record."""
    nb_id = store.resolve_notebook(notebook)
    path = (path or "").strip()
    url = (url or "").strip()
    text = text if text is not None else None

    if path and (url or text):
        raise ValueError("pass only one of path / url / text")

    src_kind = ""
    origin = ""
    if path:
        p = Path(path).expanduser()
        if not p.is_absolute():
            # try cwd then hermes cwd
            p = Path(path).expanduser().resolve()
        if not p.exists():
            raise FileNotFoundError(f"source file not found: {path}")
        if not p.is_file():
            raise ValueError(f"not a file: {path}")
        fkind = extract.kind_for_path(p)
        origin = str(p)
        if fkind == "image":
            src_kind = "image"
            body = _describe_image(p)
            src_title = title or p.stem
        elif fkind == "unknown":
            raise extract.ExtractionError(
                f"unsupported file type {p.suffix!r} — supported: pdf, office docs "
                "(docx/pptx/xlsx/epub), notebooks, text/code/markup, images"
            )
        else:
            src_kind = fkind
            fkind, body = extract.extract_file(p)
            src_kind = fkind
            src_title = title or p.stem
    elif url:
        origin = url
        if kind_hint == "text" or not _looks_like_url(url):
            src_kind = "text"
            body = url
            src_title = title or url[:80]
        else:
            src_title, src_kind, body = ingest_url(url)
            src_title = title or src_title
    elif text is not None:
        src_kind = "text"
        origin = "pasted text"
        body = text
        src_title = title or (body.strip().splitlines() or ["pasted text"])[0][:80]
    else:
        raise ValueError("nothing to ingest — pass path, url, or text")

    body = (body or "").strip()
    if not body:
        raise extract.ExtractionError("source produced no text")
    if len(body) > MAX_TEXT_SOURCE_CHARS:
        body = body[:MAX_TEXT_SOURCE_CHARS] + "\n\n[... source truncated ...]"

    labels, summary = _auto_label(src_title, src_kind, origin, body)
    record = store.add_source(
        nb_id, title=src_title or src_kind, kind=src_kind, origin=origin,
        text=body, labels=labels, summary=summary,
    )
    return record


_LABEL_SCHEMA = {
    "type": "object",
    "properties": {
        "labels": {"type": "array", "items": {"type": "string"},
                   "description": "2-5 short topic tags (1-3 words each)"},
        "summary": {"type": "string",
                    "description": "One sentence (<= 160 chars) saying what this source is about"},
    },
    "required": ["labels", "summary"],
}


def _label_call(sample_input: list[dict], task: Optional[str]):
    return runtime.llm().complete_structured(
        instructions=(
            "Label this source for a notebook UI. Pick 2-5 short topic labels "
            "(1-3 words, like 'machine-learning', '19th-century-history') and "
            "write a one-sentence summary of what the source contains. "
            "Respond with ONLY the JSON object."
        ),
        input=sample_input,
        json_schema=_LABEL_SCHEMA,
        schema_name="source.labels",
        purpose="hermes-notebook.label_source",
        task=task,
        temperature=0.0,
        max_tokens=300,
    )


def _auto_label(title: str, kind: str, origin: str, body: str) -> tuple[list[str], str]:
    """Cheap structured LLM pass for source chips + one-line summary. Best-effort:
    tries the plugin's auxiliary slot first (users can pin a fast model there),
    then the main model, then a deterministic title-word fallback."""
    sample = body[:3500]
    user_input = [{"type": "text", "text":
                   f"Title: {title}\nKind: {kind}\nOrigin: {origin}\n\n{sample}"}]
    for task in ("notebook", None):
        try:
            result = _label_call(user_input, task)
            parsed = result.parsed if isinstance(result.parsed, dict) else None
            if parsed is None:
                # some aux models ignore response_format — try parsing raw text
                try:
                    parsed = json.loads(result.text)
                except (ValueError, TypeError):
                    parsed = None
            if isinstance(parsed, dict):
                labels = [str(x)[:40] for x in (parsed.get("labels") or []) if str(x).strip()][:5]
                summary = str(parsed.get("summary") or "").strip()[:300]
                if labels or summary:
                    return labels, summary
        except Exception as exc:
            runtime.logger.debug("auto-label attempt task=%r failed (non-fatal): %s", task, exc)
    # deterministic fallback: first meaningful words of title
    words = re.findall(r"[A-Za-z][A-Za-z0-9-]{2,}", title or "")[:3]
    return [w.lower() for w in words] or [kind], ""
