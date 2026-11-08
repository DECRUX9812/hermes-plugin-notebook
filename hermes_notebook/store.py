"""Notebook persistence: one directory per notebook under the plugin data dir.

Layout::

    plugin-data/hermes-notebook/notebooks/<id>/
        notebook.json     {id, title, description, created_at, updated_at}
        sources/index.json  [{id, title, kind, origin, added_at, chars, labels, summary}]
        sources/<id>.txt    extracted plain text
        artifacts/<file>    generated outputs (.md / .json / .mp3 / .txt)
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Optional

from . import runtime

_NOTEBOOKS_DIRNAME = "notebooks"


def _root() -> Path:
    return runtime.plugin_data() / _NOTEBOOKS_DIRNAME


def _nb_dir(notebook_id: str) -> Path:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,80}", notebook_id or ""):
        raise ValueError(f"invalid notebook id {notebook_id!r}")
    return _root() / notebook_id


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def _now() -> float:
    return time.time()


def _iso(ts: float) -> str:
    import datetime
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------- notebooks

def list_notebooks() -> list[dict]:
    out = []
    root = _root()
    if not root.is_dir():
        return out
    for nb_json in sorted(root.glob("*/notebook.json")):
        meta = _read_json(nb_json, {})
        nb_id = nb_json.parent.name
        sources = list_sources(nb_id)
        artifacts = list_artifacts(nb_id)
        out.append({
            "id": nb_id,
            "title": meta.get("title") or nb_id,
            "description": meta.get("description", ""),
            "created_at": meta.get("created_at", ""),
            "updated_at": meta.get("updated_at", ""),
            "sources": len(sources),
            "artifacts": len(artifacts),
            "total_chars": sum(s.get("chars", 0) for s in sources),
            "dir": str(nb_json.parent),
        })
    out.sort(key=lambda n: n.get("updated_at") or "", reverse=True)
    return out


def create_notebook(title: str, description: str = "") -> dict:
    title = (title or "").strip()
    if not title:
        raise ValueError("notebook title is required")
    base = runtime.slugify(title)
    nb_id = base
    i = 2
    while (_nb_dir(nb_id) / "notebook.json").exists():
        nb_id = f"{base}-{i}"
        i += 1
    now = _now()
    meta = {
        "id": nb_id,
        "title": title,
        "description": (description or "").strip(),
        "created_at": _iso(now),
        "updated_at": _iso(now),
    }
    d = _nb_dir(nb_id)
    _write_json(d / "notebook.json", meta)
    (d / "sources").mkdir(parents=True, exist_ok=True)
    (d / "artifacts").mkdir(parents=True, exist_ok=True)
    meta["dir"] = str(d)
    meta["sources"] = 0
    meta["artifacts"] = 0
    return meta


def get_meta(notebook_id: str) -> dict:
    path = _nb_dir(notebook_id) / "notebook.json"
    meta = _read_json(path, None)
    if meta is None:
        raise KeyError(f"notebook not found: {notebook_id}")
    return meta


def touch(notebook_id: str) -> None:
    d = _nb_dir(notebook_id)
    meta = get_meta(notebook_id)
    meta["updated_at"] = _iso(_now())
    _write_json(d / "notebook.json", meta)


def resolve_notebook(arg: str) -> str:
    """Accept a notebook id, exact title, or unique title/id substring."""
    arg = (arg or "").strip()
    if not arg:
        default = runtime.config("default_notebook", default="")
        if default:
            arg = str(default)
        else:
            nbs = list_notebooks()
            if len(nbs) == 1:
                return nbs[0]["id"]
            raise ValueError(
                "no notebook specified — pass 'notebook' (id or title), or set "
                "plugins.entries.hermes-notebook.settings.default_notebook"
            )
    # exact id (only when the arg is id-shaped — titles may contain spaces/caps)
    if re.fullmatch(r"[a-z0-9][a-z0-9-]{0,80}", arg) and (_nb_dir(arg) / "notebook.json").exists():
        return arg
    # exact title
    for nb in list_notebooks():
        if nb["title"].lower() == arg.lower():
            return nb["id"]
    # unique substring over id + title
    arg_l = arg.lower()
    hits = [nb["id"] for nb in list_notebooks()
            if arg_l in nb["id"].lower() or arg_l in nb["title"].lower()]
    if len(hits) == 1:
        return hits[0]
    if not hits:
        raise KeyError(f"notebook not found: {arg!r}")
    raise ValueError(f"ambiguous notebook {arg!r}: {', '.join(hits)}")


def disabled_sources(notebook_id: str) -> set:
    """Source ids the user unchecked in the studio — excluded from answers and
    generation, exactly like NotebookLM's source selection."""
    try:
        meta = get_meta(notebook_id)
    except KeyError:
        return set()
    return {str(x) for x in (meta.get("disabled_sources") or [])}


def set_source_enabled(notebook_id: str, source_id: str, enabled: bool) -> dict:
    """Flip one source's active flag; returns the notebook meta."""
    nb_id = resolve_notebook(notebook_id)
    d = _nb_dir(nb_id)
    meta = get_meta(nb_id)
    cur = {str(x) for x in (meta.get("disabled_sources") or [])}
    if enabled:
        cur.discard(source_id)
    else:
        cur.add(source_id)
    meta["disabled_sources"] = sorted(cur)
    meta["updated_at"] = _iso(_now())
    _write_json(d / "notebook.json", meta)
    return meta


def update_meta(notebook_id: str, *, title: Optional[str] = None,
                description: Optional[str] = None, **fields) -> dict:
    """Rename / re-describe a notebook, or shallow-merge extra fields
    (options, prefs, …). Only provided fields change."""
    nb_id = resolve_notebook(notebook_id)
    d = _nb_dir(nb_id)
    meta = get_meta(nb_id)
    if title is not None:
        t = title.strip()
        if not t:
            raise ValueError("title cannot be empty")
        meta["title"] = t[:200]
    if description is not None:
        meta["description"] = description.strip()[:1000]
    meta.update(fields)
    meta["updated_at"] = _iso(_now())
    _write_json(d / "notebook.json", meta)
    return meta


def duplicate_notebook(notebook_id: str) -> dict:
    """Copy a notebook — sources, artifacts, labels, options — under a fresh
    id and 'Copy of …' title. Chat threads do NOT carry over."""
    import shutil
    nb_id = resolve_notebook(notebook_id)
    src_dir = _nb_dir(nb_id)
    meta = get_meta(nb_id)
    new_meta = create_notebook(f"Copy of {meta.get('title') or nb_id}",
                               meta.get("description") or "")
    new_id = new_meta["id"]
    new_dir = _nb_dir(new_id)
    for sub in ("sources", "artifacts"):
        sdir = src_dir / sub
        if sdir.is_dir():
            shutil.copytree(sdir, new_dir / sub, dirs_exist_ok=True)
    # sources/index.json travels with the copy; notebook.json keeps the new id
    merged = get_meta(new_id)
    for k in ("options", "emoji"):
        if meta.get(k):
            merged[k] = meta[k]
    merged["updated_at"] = _iso(_now())
    _write_json(new_dir / "notebook.json", merged)
    return {"id": new_id, "title": merged["title"], "copied_from": nb_id}


def delete_notebook(notebook_id: str) -> dict:
    nb_id = resolve_notebook(notebook_id)
    d = _nb_dir(nb_id)
    meta = get_meta(nb_id)
    import shutil
    shutil.rmtree(d)
    return {"deleted": nb_id, "title": meta.get("title")}


# ------------------------------------------------------------------ sources

def _index_path(notebook_id: str) -> Path:
    return _nb_dir(notebook_id) / "sources" / "index.json"


def list_sources(notebook_id: str) -> list[dict]:
    return _read_json(_index_path(notebook_id), [])


def _save_index(notebook_id: str, sources: list[dict]) -> None:
    _write_json(_index_path(notebook_id), sources)


def get_source(notebook_id: str, source_id: str) -> Optional[dict]:
    for s in list_sources(notebook_id):
        if s.get("id") == source_id:
            return s
    return None


def content_hash(text: str) -> str:
    """Stable hash of normalized source text — for duplicate detection."""
    import hashlib
    norm = re.sub(r"\s+", " ", (text or "").strip().lower())
    return hashlib.sha1(norm.encode("utf-8", errors="replace")).hexdigest()[:16]


def find_source_by_hash(notebook_id: str, digest: str) -> Optional[dict]:
    for s in list_sources(notebook_id):
        if s.get("content_hash") == digest:
            return s
    return None


def source_text_path(notebook_id: str, source_id: str) -> Path:
    return _nb_dir(notebook_id) / "sources" / f"{source_id}.txt"


def read_source_text(notebook_id: str, source: dict) -> str:
    return source_text_path(notebook_id, source["id"]).read_text(encoding="utf-8", errors="replace")


def add_source(notebook_id: str, *, title: str, kind: str, origin: str, text: str,
               labels: Optional[list[str]] = None, summary: str = "",
               locator: Optional[str] = None) -> dict:
    """Persist extracted source text + index entry. Returns the index record."""
    nb_id = resolve_notebook(notebook_id)
    d = _nb_dir(nb_id)
    sources = list_sources(nb_id)
    src_id = runtime.slugify(title or kind, 40) or "source"
    base, i = src_id, 2
    existing = {s.get("id") for s in sources}
    while src_id in existing:
        src_id = f"{base}-{i}"
        i += 1
    text = text or ""
    record = {
        "id": src_id,
        "title": (title or src_id).strip()[:200],
        "kind": kind,
        "origin": origin,
        "added_at": _iso(_now()),
        "chars": len(text),
        "labels": list(labels or []),
        "summary": (summary or "").strip()[:500],
        "content_hash": content_hash(text),
    }
    if locator:
        record["locator"] = locator[:1000]
    source_text_path(nb_id, src_id).write_text(text, encoding="utf-8")
    sources.append(record)
    _save_index(nb_id, sources)
    touch(nb_id)
    return record


def update_source(notebook_id: str, source_id: str, *, text: Optional[str] = None,
                  title: Optional[str] = None, labels: Optional[list[str]] = None,
                  summary: Optional[str] = None) -> dict:
    """Refresh a source's stored text/metadata in place (keeps its id)."""
    nb_id = resolve_notebook(notebook_id)
    sources = list_sources(nb_id)
    rec = next((s for s in sources if s.get("id") == source_id), None)
    if rec is None:
        raise KeyError(f"source not found: {source_id}")
    if text is not None:
        source_text_path(nb_id, source_id).write_text(text, encoding="utf-8")
        rec["chars"] = len(text)
        rec["content_hash"] = content_hash(text)
    if title is not None:
        rec["title"] = title.strip()[:200] or rec["title"]
    if labels is not None:
        rec["labels"] = list(labels)[:5]
    if summary is not None:
        rec["summary"] = summary.strip()[:500]
    rec["refreshed_at"] = _iso(_now())
    _save_index(nb_id, sources)
    touch(nb_id)
    return rec


def remove_source(notebook_id: str, source_id: str) -> dict:
    nb_id = resolve_notebook(notebook_id)
    sources = list_sources(nb_id)
    keep = [s for s in sources if s.get("id") != source_id]
    if len(keep) == len(sources):
        raise KeyError(f"source not found: {source_id}")
    _save_index(nb_id, keep)
    p = source_text_path(nb_id, source_id)
    if p.exists():
        p.unlink()
    touch(nb_id)
    return {"removed": source_id}


def all_source_texts(notebook_id: str) -> list[tuple[dict, str]]:
    """[(index_record, text)] for every source that has a text file."""
    out = []
    for s in list_sources(notebook_id):
        p = source_text_path(notebook_id, s["id"])
        if p.exists():
            out.append((s, p.read_text(encoding="utf-8", errors="replace")))
    return out


# ----------------------------------------------------------------- artifacts

def list_artifacts(notebook_id: str) -> list[dict]:
    d = _nb_dir(notebook_id) / "artifacts"
    if not d.is_dir():
        return []
    out = []
    for p in sorted(d.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_file():
            out.append({
                "name": p.name,
                "kind": p.suffix.lstrip("."),
                "size": p.stat().st_size,
                "path": str(p),
                "modified": _iso(p.stat().st_mtime),
            })
    return out


def artifact_path(notebook_id: str, filename: str) -> Path:
    """Resolve an artifact filename inside the notebook's artifacts dir (no traversal)."""
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise ValueError(f"invalid artifact name {filename!r}")
    p = (_nb_dir(notebook_id) / "artifacts" / filename).resolve()
    base = (_nb_dir(notebook_id) / "artifacts").resolve()
    if base not in p.parents and p != base:
        raise ValueError(f"artifact escapes notebook dir: {filename!r}")
    return p


# --------------------------------------------------------------- chat threads

_THREAD_CAP = 24  # messages kept per thread (user+assistant pairs)


def _thread_path(notebook_id: str, name: str) -> Path:
    safe = runtime.slugify(name or "default", 60)
    return _nb_dir(notebook_id) / "threads" / f"{safe}.json"


def get_thread(notebook_id: str, name: str = "default") -> list[dict]:
    return _read_json(_thread_path(notebook_id, name), [])


def append_thread(notebook_id: str, name: str, role: str, content: str,
                  extra: dict | None = None) -> list[dict]:
    """Append one message; returns the trimmed thread. ``extra`` carries
    per-message payload like an assistant answer's citations."""
    nb_id = resolve_notebook(notebook_id)
    msgs = get_thread(nb_id, name)
    msg = {"role": role, "content": content[:8000], "ts": _iso(_now())}
    if extra:
        msg.update(extra)
    msgs.append(msg)
    msgs = msgs[-_THREAD_CAP:]
    _write_json(_thread_path(nb_id, name), msgs)
    return msgs


def pop_thread_exchange(notebook_id: str, name: str = "default") -> list[dict]:
    """Drop the trailing assistant message and its user question — a retry
    regenerates the exchange instead of duplicating it."""
    nb_id = resolve_notebook(notebook_id)
    msgs = get_thread(nb_id, name)
    if msgs and msgs[-1].get("role") == "assistant":
        msgs.pop()
    if msgs and msgs[-1].get("role") == "user":
        msgs.pop()
    _write_json(_thread_path(nb_id, name), msgs)
    return msgs


def clear_thread(notebook_id: str, name: str = "default") -> dict:
    nb_id = resolve_notebook(notebook_id)
    p = _thread_path(nb_id, name)
    if p.exists():
        p.unlink()
    return {"cleared": name}


def list_threads(notebook_id: str) -> list[dict]:
    """Every saved conversation, newest first — title is the first question."""
    d = _nb_dir(notebook_id) / "threads"
    out = []
    if d.is_dir():
        for p in sorted(d.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            msgs = _read_json(p, [])
            title = ""
            for m in msgs:
                if m.get("role") == "user" and str(m.get("content") or "").strip():
                    title = re.sub(r"\s+", " ", str(m["content"])).strip()[:48]
                    break
            out.append({"name": p.stem, "title": title or p.stem,
                        "count": len(msgs), "updated": _iso(p.stat().st_mtime)})
    return out


# -------------------------------------------------------------------- export

def export_notebook(notebook_id: str, out_dir: Optional[Path] = None) -> dict:
    """Zip the whole notebook dir (sources + artifacts + threads + meta)."""
    import zipfile
    nb_id = resolve_notebook(notebook_id)
    src_dir = _nb_dir(nb_id)
    meta = get_meta(nb_id)
    out_dir = Path(out_dir) if out_dir else runtime.plugin_data() / "exports"
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"{nb_id}-{runtime.utc_stamp()}.zip"
    n_files = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(src_dir.rglob("*")):
            if p.is_file():
                zf.write(p, p.relative_to(src_dir.parent))
                n_files += 1
    return {"zip": str(zip_path), "files": n_files,
            "size_bytes": zip_path.stat().st_size,
            "title": meta.get("title")}
