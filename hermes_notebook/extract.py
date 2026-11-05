"""File and HTML → plain text extraction.

Stdlib handles the zip-based Office formats and notebooks; optional declared
deps cover PDF (pypdf), spreadsheets (openpyxl) and article extraction
(trafilatura). Every extractor degrades to a clear error, never a raise past
the caller.
"""

from __future__ import annotations

import json
import re
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional

TEXT_EXTS = {
    ".txt", ".md", ".markdown", ".rst", ".org", ".json", ".jsonl", ".ndjson",
    ".csv", ".tsv", ".log", ".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs",
    ".java", ".c", ".h", ".cpp", ".hpp", ".rb", ".php", ".swift", ".kt",
    ".html", ".htm", ".xml", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".conf", ".sql", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat",
    ".tex", ".bib", ".srt", ".vtt", ".css", ".scss", ".env", ".gitignore",
    ".dockerfile", ".makefile", ".gradle", ".lua", ".pl", ".r", ".m",
}

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".tif"}

MAX_EXTRACT_CHARS = 2_000_000  # hard cap per source; larger docs get head+tail


class ExtractionError(ValueError):
    pass


def kind_for_path(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".pdf":
        return "pdf"
    if ext == ".docx":
        return "docx"
    if ext == ".pptx":
        return "pptx"
    if ext in {".xlsx", ".xlsm"}:
        return "xlsx"
    if ext == ".epub":
        return "epub"
    if ext == ".ipynb":
        return "ipynb"
    if ext in IMAGE_EXTS:
        return "image"
    if ext in TEXT_EXTS or not ext:
        return "text"
    return "unknown"


def is_supported_path(path: Path) -> bool:
    return kind_for_path(path) != "unknown"


def extract_file(path: Path) -> tuple[str, str]:
    """(kind, text) for a local file. Raises ExtractionError on failure."""
    kind = kind_for_path(path)
    if kind == "image":
        raise ExtractionError("image sources are described by the model, not text-extracted")
    if kind == "unknown":
        raise ExtractionError(f"unsupported file type {path.suffix!r}")
    fn = {
        "text": _extract_text,
        "pdf": _extract_pdf,
        "docx": _extract_ooxml_doc,
        "pptx": _extract_pptx,
        "xlsx": _extract_xlsx,
        "epub": _extract_epub,
        "ipynb": _extract_ipynb,
        "html": _extract_html_file,
    }.get(kind, _extract_text)
    if kind == "html":
        return kind, fn(path)
    text = fn(path)
    return kind, _cap(text)


def _cap(text: str) -> str:
    if len(text) <= MAX_EXTRACT_CHARS:
        return text
    head = text[: MAX_EXTRACT_CHARS * 2 // 3]
    tail = text[-(MAX_EXTRACT_CHARS // 3):]
    return f"{head}\n\n[... {len(text) - MAX_EXTRACT_CHARS:,} characters omitted ...]\n\n{tail}"


# ------------------------------------------------------------------ helpers

def _extract_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _xml_text(xml_bytes: bytes) -> str:
    """All <w:t>-style text runs joined with spaces, preserving paragraph-ish breaks."""
    try:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return re.sub(r"<[^>]+>", " ", xml_bytes.decode("utf-8", errors="replace"))
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"
    parts: list[str] = []
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag in {"t", "instrText"} and el.text:
            parts.append(el.text)
        elif tag in {"p", "tab", "br"}:
            parts.append("\n")
    text = "".join(parts)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _zip_xml_text(path: Path, member_pred) -> str:
    out: list[str] = []
    with zipfile.ZipFile(path) as zf:
        names = sorted(n for n in zf.namelist() if member_pred(n))
        for name in names:
            try:
                out.append(_xml_text(zf.read(name)))
            except (KeyError, zipfile.BadZipFile):
                continue
    return "\n\n".join(s for s in out if s.strip())


# ------------------------------------------------------------- per-format

def _extract_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise ExtractionError("PDF support needs the pypdf package (declared plugin dependency)") from exc
    try:
        reader = PdfReader(str(path))
        pages = []
        for i, page in enumerate(reader.pages):
            try:
                txt = page.extract_text() or ""
            except Exception:
                txt = ""
            pages.append(f"\n\n--- page {i + 1} ---\n{txt}")
        text = "".join(pages).strip()
    except ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError(f"could not read PDF: {exc}") from exc
    if not text:
        raise ExtractionError(
            "PDF has no extractable text layer (probably scanned images). "
            "OCR it first or add it as an image source."
        )
    return text


def _extract_ooxml_doc(path: Path) -> str:
    text = _zip_xml_text(path, lambda n: n == "word/document.xml")
    if not text:
        raise ExtractionError("docx contains no extractable text")
    return text


def _extract_pptx(path: Path) -> str:
    def is_slide(n: str) -> bool:
        return bool(re.fullmatch(r"ppt/slides/slide\d+\.xml", n))
    text = _zip_xml_text(path, is_slide)
    if not text:
        raise ExtractionError("pptx contains no extractable text")
    return text


def _extract_xlsx(path: Path) -> str:
    try:
        import openpyxl
    except ImportError as exc:
        raise ExtractionError("xlsx support needs the openpyxl package (declared plugin dependency)") from exc
    try:
        wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    except Exception as exc:
        raise ExtractionError(f"could not open xlsx: {exc}") from exc
    out: list[str] = []
    for ws in wb.worksheets:
        out.append(f"## sheet: {ws.title}")
        rows = 0
        for row in ws.iter_rows(values_only=True):
            cells = ["" if c is None else str(c) for c in row]
            line = " | ".join(cells).rstrip(" |")
            if line.strip():
                out.append(line)
                rows += 1
            if rows >= 5000:
                out.append("[sheet truncated at 5000 rows]")
                break
    wb.close()
    text = "\n".join(out).strip()
    if not text:
        raise ExtractionError("xlsx contains no cell data")
    return text


def _extract_epub(path: Path) -> str:
    parser = _TextHTMLParser()
    with zipfile.ZipFile(path) as zf:
        names = [n for n in zf.namelist()
                 if n.lower().endswith((".xhtml", ".html", ".htm"))
                 and not n.startswith("OEBPS/Images") and "/Images/" not in n]
        # spine order approximates reading order well enough
        for name in sorted(names):
            try:
                parser.feed(zf.read(name).decode("utf-8", errors="replace"))
                parser.text.append("\n\n")
            except (KeyError, zipfile.BadZipFile, UnicodeDecodeError):
                continue
    text = "".join(parser.text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        raise ExtractionError("epub contains no readable text")
    return text


def _extract_ipynb(path: Path) -> str:
    try:
        nb = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except ValueError as exc:
        raise ExtractionError(f"not a valid .ipynb JSON: {exc}") from exc
    parts: list[str] = []
    for cell in nb.get("cells", []):
        if cell.get("cell_type") not in {"code", "markdown", "raw"}:
            continue
        src = cell.get("source", "")
        if isinstance(src, list):
            src = "".join(src)
        outputs = cell.get("outputs", [])
        out_text = ""
        for o in outputs if isinstance(outputs, list) else []:
            data = o.get("data", {}) if isinstance(o, dict) else {}
            txt = data.get("text/plain") if isinstance(data, dict) else None
            if isinstance(txt, list):
                txt = "".join(txt)
            if txt:
                out_text += str(txt)[:4000] + "\n"
        body = f"```{cell.get('cell_type')}\n{src}\n```"
        if out_text.strip():
            body += f"\noutput:\n{out_text.strip()}"
        parts.append(body)
    text = "\n\n".join(parts).strip()
    if not text:
        raise ExtractionError("notebook has no cells")
    return text


def _extract_html_file(path: Path) -> str:
    raw = path.read_bytes()
    text = html_to_text(raw.decode("utf-8", errors="replace"))
    if not text.strip():
        raise ExtractionError("html file produced no text")
    return text


# --------------------------------------------------------------------- HTML

class _TextHTMLParser(HTMLParser):
    """Minimal HTML → text: drops script/style/tags, keeps block-ish breaks."""

    _SKIP = {"script", "style", "noscript", "svg", "canvas", "template", "head"}
    _BLOCK = {"p", "div", "br", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6",
              "tr", "table", "section", "article", "header", "footer", "blockquote",
              "pre", "hr", "dd", "dt", "figure", "figcaption"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag in self._BLOCK:
            self.text.append("\n")

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1
        elif tag in self._BLOCK:
            self.text.append("\n")

    def handle_data(self, data):
        if not self._skip_depth:
            self.text.append(data)


def html_to_text(html: str) -> str:
    """Article-quality text via trafilatura when importable, else the stdlib parser."""
    if not html or not html.strip():
        return ""
    try:
        import trafilatura
        extracted = trafilatura.extract(
            html, include_comments=False, include_tables=True,
            favor_recall=True, output_format="txt",
        )
        if extracted and len(extracted) > 200:
            return extracted.strip()
    except Exception:
        pass
    parser = _TextHTMLParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    text = "".join(parser.text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def assert_public_url(url: str) -> None:
    """Refuse URLs that resolve to private/loopback/link-local/reserved space —
    the same boundary web_extract enforces, applied to our direct-fetch path."""
    import ipaddress
    import socket
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ExtractionError(f"unsupported URL scheme/host: {url[:120]}")
    host = parsed.hostname
    if host.lower() in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
        raise ExtractionError(f"refusing local hostname: {host}")
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80),
                                   proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise ExtractionError(f"cannot resolve host {host}: {exc}") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast
                or ip.is_reserved or ip.is_unspecified):
            raise ExtractionError(f"refusing non-public address for {host}: {ip}")


def fetch_url_text(url: str, timeout: float = 20.0, max_bytes: int = 3_000_000) -> tuple[str, str]:
    """Direct HTTP GET → (final_url, html_or_text). Raises ExtractionError."""
    import urllib.request
    import urllib.error

    assert_public_url(url)
    req = urllib.request.Request(
        url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; HermesNotebook/0.1; +https://github.com/DECRUX9812/hermes-plugin-notebook)",
            "Accept": "text/html,application/xhtml+xml,text/plain,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            final_url = resp.geturl() or url
            ctype = (resp.headers.get("Content-Type") or "").lower()
            data = resp.read(max_bytes + 1)
    except urllib.error.HTTPError as exc:
        raise ExtractionError(f"HTTP {exc.code} fetching {url}") from exc
    except Exception as exc:
        raise ExtractionError(f"fetch failed for {url}: {exc}") from exc
    if len(data) > max_bytes:
        data = data[:max_bytes]
    if "pdf" in ctype or url.lower().split("?")[0].endswith(".pdf"):
        # PDF over HTTP: spool to a temp file for pypdf
        import tempfile
        suffix = ".pdf"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)
        try:
            return final_url, _extract_pdf(tmp_path)
        finally:
            tmp_path.unlink(missing_ok=True)
    charset = "utf-8"
    m = re.search(r"charset=([\w.-]+)", ctype)
    if m:
        charset = m.group(1)
    try:
        return final_url, data.decode(charset, errors="replace")
    except LookupError:
        return final_url, data.decode("utf-8", errors="replace")


def title_from_html(html: str, fallback_url: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html or "", re.IGNORECASE | re.DOTALL)
    if m:
        t = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(1))).strip()
        if t:
            return t[:200]
    return fallback_url
