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
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).isoformat(timespec="microseconds")


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
#
# A notebook holds many named conversations, which is the thing people miss most
# when they compare this with a single-thread chat product: a research notebook is
# usually several lines of enquiry at once ("pricing", "history", "what changed in
# 2026"), and each line needs its own memory.
#
# On disk: threads/<slug>.json -> {"title", "created", "updated", "messages": [...]}.
# An older file that is a bare list of messages is still readable — the format grew
# a header, it did not change shape underneath existing notebooks.

_THREAD_CAP = 40          # messages kept per thread (user+assistant pairs)
_THREADS_MAX = 40         # threads a notebook may hold
DEFAULT_THREAD = "default"


def _thread_dir(notebook_id: str) -> Path:
    return _nb_dir(notebook_id) / "threads"


def _thread_path(notebook_id: str, name: str) -> Path:
    safe = runtime.slugify(name or DEFAULT_THREAD, 60)
    return _thread_dir(notebook_id) / f"{safe}.json"


def _thread_name_of(path: Path) -> str:
    return path.stem


def _read_thread_file(path: Path) -> dict:
    """(title, created, updated, messages) for one thread file, legacy or current."""
    raw = _read_json(path, [])
    if isinstance(raw, dict):
        msgs = raw.get("messages") if isinstance(raw.get("messages"), list) else []
        return {"title": str(raw.get("title") or "").strip(),
                "created": str(raw.get("created") or ""),
                "updated": str(raw.get("updated") or raw.get("created") or ""),
                "messages": [m for m in msgs if isinstance(m, dict)]}
    if isinstance(raw, list):
        msgs = [m for m in raw if isinstance(m, dict)]
        first_user = next((str(m.get("content") or "") for m in msgs
                           if m.get("role") == "user"), "")
        return {"title": _title_from(first_user), "created": "", "updated": "",
                "messages": msgs}
    return {"title": "", "created": "", "updated": "", "messages": []}


def _title_from(text: str, limit: int = 64) -> str:
    """A readable thread title from its first question — no model call, no surprises."""
    clean = " ".join(str(text or "").split())
    if not clean:
        return ""
    if len(clean) <= limit:
        return clean
    cut = clean[:limit].rsplit(" ", 1)[0].rstrip(" ,.;:-")
    return (cut or clean[:limit]) + "…"


def _write_thread_file(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _write_json(path, {"title": doc.get("title") or "", "created": doc.get("created") or "",
                       "updated": doc.get("updated") or _iso(_now()),
                       "messages": list(doc.get("messages") or [])[-_THREAD_CAP:]})


def thread_exists(notebook_id: str, name: str) -> bool:
    return _thread_path(notebook_id, name).exists()


def get_thread(notebook_id: str, name: str = DEFAULT_THREAD) -> list[dict]:
    """Messages only — the shape the tools and older callers expect."""
    return _read_thread_file(_thread_path(notebook_id, name))["messages"]


def read_thread(notebook_id: str, name: str = DEFAULT_THREAD) -> dict:
    """One thread with its header: {name, title, created, updated, messages}."""
    nb_id = resolve_notebook(notebook_id)
    path = _thread_path(nb_id, name)
    doc = _read_thread_file(path)
    doc["name"] = _thread_name_of(path)
    doc["messages"] = doc["messages"][-_THREAD_CAP:]
    if not doc["title"]:
        doc["title"] = _title_from(next((str(m.get("content") or "") for m in doc["messages"]
                                         if m.get("role") == "user"), "")) or "New chat"
    return doc


def append_thread(notebook_id: str, name: str, role: str, content: str) -> list[dict]:
    """Append one message; titles the thread from its first question. Returns messages."""
    nb_id = resolve_notebook(notebook_id)
    path = _thread_path(nb_id, name)
    doc = _read_thread_file(path)
    if not doc["created"]:
        doc["created"] = _iso(_now())
    msgs = doc["messages"]
    msgs.append({"role": role, "content": str(content)[:8000], "ts": _iso(_now())})
    doc["messages"] = msgs[-_THREAD_CAP:]
    doc["updated"] = _iso(_now())
    if role == "user" and not doc["title"]:
        doc["title"] = _title_from(content)
    _write_thread_file(path, doc)
    return doc["messages"]


def list_threads(notebook_id: str) -> list[dict]:
    """Every thread in the notebook, most recently used first."""
    nb_id = resolve_notebook(notebook_id)
    d = _thread_dir(nb_id)
    out: list[dict] = []
    if d.is_dir():
        for path in sorted(d.glob("*.json")):
            try:
                doc = _read_thread_file(path)
            except Exception:
                continue
            msgs = doc["messages"]
            out.append({
                "name": _thread_name_of(path),
                "title": doc["title"] or _title_from(next(
                    (str(m.get("content") or "") for m in msgs
                     if m.get("role") == "user"), "")) or "New chat",
                "created": doc["created"],
                "updated": doc["updated"] or (msgs[-1].get("ts") if msgs else ""),
                "messages": len(msgs),
                "preview": next((str(m.get("content") or "")[:160] for m in reversed(msgs)
                                 if m.get("role") == "assistant"), ""),
            })
    # most recently used first; ties fall back to creation, then name, so the order
    # is stable rather than whatever the filesystem returned
    out.sort(key=lambda t: (t.get("updated") or "", t.get("created") or "", t.get("name") or ""),
             reverse=True)
    return out


def create_thread(notebook_id: str, title: str = "", name: str = "") -> dict:
    """A new, empty thread. The name is a stable id; the title is what people read."""
    nb_id = resolve_notebook(notebook_id)
    existing = {t["name"] for t in list_threads(nb_id)}
    if len(existing) >= _THREADS_MAX:
        raise ValueError(f"this notebook already has {len(existing)} threads — "
                         f"delete one before starting another")
    base = runtime.slugify(name or "chat", 40) or "chat"
    candidate, n = base, 2
    while candidate in existing or candidate == "":
        candidate = f"{base}-{n}"
        n += 1
    doc = {"title": str(title or "").strip()[:80], "created": _iso(_now()),
           "updated": _iso(_now()), "messages": []}
    _write_thread_file(_thread_path(nb_id, candidate), doc)
    return {"name": candidate, "title": doc["title"] or "New chat", "messages": 0,
            "created": doc["created"], "updated": doc["updated"]}


def rename_thread(notebook_id: str, name: str, title: str) -> dict:
    nb_id = resolve_notebook(notebook_id)
    path = _thread_path(nb_id, name)
    if not path.exists():
        raise ValueError(f"no thread named {name!r} in this notebook")
    doc = _read_thread_file(path)
    doc["title"] = str(title or "").strip()[:80]
    doc["updated"] = _iso(_now())
    _write_thread_file(path, doc)
    return {"name": _thread_name_of(path), "title": doc["title"]}


def delete_thread(notebook_id: str, name: str) -> dict:
    nb_id = resolve_notebook(notebook_id)
    path = _thread_path(nb_id, name)
    if not path.exists():
        raise ValueError(f"no thread named {name!r} in this notebook")
    path.unlink()
    remaining = list_threads(nb_id)
    return {"deleted": _thread_name_of(path),
            "next": remaining[0]["name"] if remaining else ""}


def clear_thread(notebook_id: str, name: str = DEFAULT_THREAD) -> dict:
    """Empty a thread but keep it (and its title) — "clear this chat", not "delete it"."""
    nb_id = resolve_notebook(notebook_id)
    path = _thread_path(nb_id, name)
    if path.exists():
        doc = _read_thread_file(path)
        doc["messages"] = []
        doc["updated"] = _iso(_now())
        _write_thread_file(path, doc)
        return {"cleared": _thread_name_of(path)}
    return {"cleared": name}


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
