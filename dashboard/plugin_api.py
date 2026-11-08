"""Hermes Notebook backend — the door between the studio page and the agent.

Mounted by the gateway at ``/api/plugins/hermes-notebook/`` and reached from the
desktop page as ``ctx.rest(...)``.

Why this exists at all: the page needs three things the renderer cannot do —
read the notebooks on disk, run a grounded answer through the *user's* model,
and drive the lab over ssh. Every route below is a thin call into code the
agent half already uses (``hermes_notebook.store`` / ``retrieve`` / ``artifacts``
/ ``audio`` / ``video``), so the page and the tools can never disagree: a
notebook generated in chat shows up in the studio and vice versa.

    GET  /health                     liveness + data root + model readiness
    GET  /state?notebook=<id|slug>   notebooks, sources, artifacts, thread, stats
    POST /notebook                   {title, description} -> create
    POST /source                     {notebook, path|url|text, title?} -> ingest
    POST /discover                   {notebook, query?, max_results?} -> web-search candidates
    POST /sources                    {notebook, urls[]} -> batch ingest the picked candidates
    POST /source_state               {notebook, source_id, enabled} -> include/exclude a source
    POST /note                       {notebook, text, title?} -> quick note as a source
    POST /suggest                    {notebook} -> questions/artifacts/gaps from the model
    POST /overview                   {notebook} -> one-paragraph executive summary
    POST /notebook/delete            {notebook, confirm} -> delete a notebook
    POST /ask                        {notebook, question, thread?} -> cited answer
    POST /generate                   {notebook, kind, focus?, count_hint?}
    POST /label                      {notebook, force?} -> auto-labels via the model
    GET  /artifact?notebook=&name=   media bytes (mp4/mp3/png/html) or text
    GET  /search?notebook=&q=        ranked hits with snippets
    POST /thread/clear               {notebook, thread?}

Ops deck (folded in from the homelab control deck, same audited transport):

    GET  /ops/fleet  /ops/services  /ops/docker  /ops/files  /ops/file
    GET  /ops/snapshots  /ops/audit  /ops/actions
    POST /ops/exec  /ops/action  /ops/service  /ops/snapshot

Nothing here invents a number: a route that cannot reach its data returns
``{"ok": false, "error": <real reason>}`` with a 5xx/4xx status and the page
renders that sentence.
"""

from __future__ import annotations

import base64
import io
import json
import mimetypes
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from starlette.concurrency import run_in_threadpool

_PLUGIN_ROOT = str(Path(__file__).resolve().parent.parent)
_HERE = str(Path(__file__).resolve().parent)
for _p in (_PLUGIN_ROOT, _HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from hermes_notebook import runtime, store, artifacts as artifacts_mod  # noqa: E402
from hermes_notebook import gfx  # noqa: E402
from hermes_notebook.gfx import themes as gfx_themes  # noqa: E402

router = APIRouter(tags=["hermes-notebook"])

#: The twelve studio outputs, in the order the panel draws them. `group` decides
#: which filter chip a card falls under; `label` is what a person reads.
KINDS: List[Dict[str, Any]] = [
    {"id": "video_overview", "label": "Video Overview", "group": "media", "ext": "mp4",
     "blurb": "Narrated slideshow, cinematic or explainer", "secs": 60,
     "options": [{"id": "style", "label": "Style",
                  "choices": ["cinematic", "explainer"]},
                 {"id": "length", "label": "Length",
                  "choices": ["short", "medium", "long"]}]},
    {"id": "audio_overview", "label": "Audio Overview", "group": "media", "ext": "mp3",
     "blurb": "Hosts talking through the sources", "secs": 90,
     "options": [{"id": "format", "label": "Format",
                  "choices": ["deep_dive", "brief", "critique", "debate"]},
                 {"id": "length", "label": "Length",
                  "choices": ["short", "medium", "long"]},
                 {"id": "language", "label": "Language", "kind": "text",
                  "placeholder": "Auto (English)"}]},
    {"id": "summary", "label": "Summary", "group": "docs", "ext": "md",
     "blurb": "The notebook in a page", "secs": 12},
    {"id": "briefing_doc", "label": "Briefing Doc", "group": "docs", "ext": "md",
     "blurb": "Decisions, risks, what to do next", "secs": 18},
    {"id": "study_guide", "label": "Study Guide", "group": "study", "ext": "md",
     "blurb": "Concepts, questions, answers", "secs": 18},
    {"id": "faq", "label": "FAQ", "group": "docs", "ext": "md",
     "blurb": "The questions the sources answer", "secs": 14},
    {"id": "timeline", "label": "Timeline", "group": "docs", "ext": "md",
     "blurb": "Dated events in order", "secs": 14},
    {"id": "mind_map", "label": "Mind Map", "group": "visual", "ext": "md",
     "blurb": "Radial structure you can pan", "secs": 16},
    {"id": "flashcards", "label": "Flashcards", "group": "study", "ext": "md",
     "blurb": "Flip deck, Anki-ready export", "secs": 16},
    {"id": "quiz", "label": "Quiz", "group": "study", "ext": "md",
     "blurb": "Multiple choice with explanations", "secs": 16},
    {"id": "slides", "label": "Slides", "group": "visual", "ext": "html",
     "blurb": "Self-contained deck, arrow keys", "secs": 22},
    {"id": "infographic", "label": "Infographic", "group": "visual", "ext": "svg",
     "blurb": "Vector poster — 18 looks, 9 layouts", "secs": 20,
     "options": [
         {"id": "style", "label": "Look", "kind": "select",
          "default": gfx_themes.DEFAULT_PRESET,
          "choices": [s["id"] for s in gfx_themes.catalog()],
          "items": [{"id": s["id"], "label": s["label"], "blurb": s["blurb"],
                     "family": s["family"], "swatch": s["swatch"]}
                    for s in gfx_themes.catalog()]},
         {"id": "template", "label": "Layout", "kind": "select", "default": "infographic",
          "choices": ["infographic", "key_figure", "stat_grid", "timeline",
                      "comparison", "process", "quote_card", "cover", "illustration"],
          "items": [{"id": t, "label": t.replace("_", " ").title()}
                    for t in ["infographic", "key_figure", "stat_grid", "timeline",
                              "comparison", "process", "quote_card", "cover",
                              "illustration"]]},
         {"id": "orientation", "label": "Shape", "kind": "seg",
          "choices": ["landscape", "square", "portrait"]},
         {"id": "detail", "label": "Detail", "kind": "seg",
          "choices": ["concise", "standard", "detailed"]}]},
    {"id": "data_table", "label": "Data Table", "group": "docs", "ext": "csv",
     "blurb": "Structured rows, exports to Sheets", "secs": 14},
]
KIND_INDEX = {k["id"]: k for k in KINDS}
MEDIA_EXT = {"mp4": "video/mp4", "mp3": "audio/mpeg", "png": "image/png",
             "html": "text/html", "webm": "video/webm", "wav": "audio/wav",
             "svg": "image/svg+xml"}
TEXT_EXT = {"md", "txt", "json", "csv", "srt", "vtt"}


# ------------------------------------------------------------------ helpers

def _q(value: Any) -> str:
    """A query argument as text. FastAPI hands the default `Query(...)` object when a
    route is called directly (tests, dump scripts), which has no `.strip()`."""
    return value.strip() if isinstance(value, str) else ""


def _fail(message: str, status: int = 400, **extra: Any) -> JSONResponse:
    return JSONResponse(status_code=status, content={"ok": False, "error": message, **extra})


def _model_ready() -> bool:
    """The page must not offer a Generate button when no model is bound."""
    try:
        runtime.ctx()
        return True
    except Exception:
        return False


def _ensure_model() -> None:
    if not _model_ready():
        raise HTTPException(
            status_code=503,
            detail="the notebook backend is loaded but the agent half is not "
                   "registered in this process — enable the plugin and restart "
                   "the gateway, then reload the window",
        )


def _artifact_kind_of(name: str) -> str:
    """`20261105-165700-audio_overview.json` -> audio_overview."""
    stem = name.rsplit(".", 1)[0]
    parts = stem.split("-", 2)
    return parts[2] if len(parts) == 3 else stem


def _artifact_stamp(name: str) -> str:
    return name.split("-", 2)[0] if name.count("-") >= 2 else ""


def _collect_artifacts(notebook_id: str) -> List[Dict[str, Any]]:
    """One row per *generation*, not per file: a single audio run writes .mp3 +
    .txt + .json, and a panel that lists all three reads as a mess."""
    raw = store.list_artifacts(notebook_id)
    runs: Dict[str, Dict[str, Any]] = {}
    for item in raw:
        name = item["name"]
        kind = _artifact_kind_of(name)
        ext = name.rsplit(".", 1)[-1].lower()
        key = f"{_artifact_stamp(name)}-{kind}"
        run = runs.setdefault(key, {"key": key, "kind": kind, "files": [],
                                    "modified": item.get("modified", "")})
        run["files"].append({"name": name, "ext": ext, "size": item.get("size", 0)})
        if item.get("modified", "") > run["modified"]:
            run["modified"] = item["modified"]
    out = []
    for run in runs.values():
        exts = {f["ext"] for f in run["files"]}
        meta = KIND_INDEX.get(run["kind"], {})
        # prefer the richest representation: media, then html, then md, then json
        for want in ("mp4", "mp3", "png", "html", "csv", "md", "txt", "json"):
            if want in exts:
                primary = next(f for f in run["files"] if f["ext"] == want)
                break
        else:
            primary = run["files"][0]
        out.append({
            "key": run["key"],
            "kind": run["kind"],
            "label": meta.get("label") or run["kind"].replace("_", " ").title(),
            "group": meta.get("group", "docs"),
            "primary": primary["name"],
            "ext": primary["ext"],
            "media": primary["ext"] in MEDIA_EXT,
            "bytes": sum(f["size"] for f in run["files"]),
            "files": run["files"],
            "modified": run["modified"],
        })
    out.sort(key=lambda a: a["modified"], reverse=True)
    return out


def _source_row(source: Dict[str, Any], index: int, active: bool = True) -> Dict[str, Any]:
    return {
        "n": index + 1,
        "id": source.get("id", ""),
        "title": source.get("title") or source.get("id") or "untitled",
        "kind": source.get("kind", "text"),
        "origin": source.get("origin", ""),
        "chars": int(source.get("chars") or 0),
        "labels": [str(x) for x in (source.get("labels") or [])][:6],
        "summary": source.get("summary") or "",
        "added_at": source.get("added_at", ""),
        "refreshed_at": source.get("refreshed_at", ""),
        "active": bool(active),
    }


def _notebook_payload(notebook_id: str, thread: str = "") -> Dict[str, Any]:
    meta = store.get_meta(notebook_id)
    disabled = store.disabled_sources(notebook_id)
    sources = [_source_row(s, i, s.get("id") not in disabled)
               for i, s in enumerate(store.list_sources(notebook_id))]
    label_counts: Dict[str, int] = {}
    for s in sources:
        for label in s["labels"]:
            label_counts[label] = label_counts.get(label, 0) + 1
    labels = [{"label": k, "count": v}
              for k, v in sorted(label_counts.items(), key=lambda kv: (-kv[1], kv[0]))]
    arts = _collect_artifacts(notebook_id)
    threads = store.list_threads(notebook_id)
    wanted = _q(thread)
    names = {t["name"] for t in threads}
    active = wanted if wanted in names else (threads[0]["name"] if threads else store.DEFAULT_THREAD)
    open_thread = store.read_thread(notebook_id, active)
    msgs = open_thread["messages"][-24:]
    return {
        "id": meta.get("id", notebook_id),
        "title": meta.get("title") or notebook_id,
        "description": meta.get("description") or "",
        "created_at": meta.get("created_at", ""),
        "updated_at": meta.get("updated_at", ""),
        "sources": sources,
        "artifacts": arts,
        "labels": labels,
        "thread": msgs,
        "thread_name": open_thread["name"],
        "thread_title": open_thread["title"],
        "threads": threads,
        "stats": {
            "sources": len(sources),
            "chars": sum(s["chars"] for s in sources),
            "labels": len(labels),
            "unlabeled": sum(1 for s in sources if not s["labels"]),
            "active": sum(1 for s in sources if s["active"]),
            "artifacts": len(arts),
            "kinds": sorted({a["kind"] for a in arts}),
        },
        "options": dict(meta.get("options") or {}),
    }


# -------------------------------------------------------------------- state

@router.get("/health")
def health() -> Dict[str, Any]:
    root = None
    try:
        root = str(runtime.plugin_data())
    except Exception as exc:          # pragma: no cover - only outside the app
        root = f"unresolved: {exc}"
    return {"ok": True, "plugin": runtime.PLUGIN_ID, "data_root": root,
            "model_ready": _model_ready(), "kinds": [k["id"] for k in KINDS]}


@router.get("/infographic_styles")
def infographic_styles(previews: int = Query(0, description="1 = include SVG thumbnails"),
                       notebook: str = Query("", description="preview with this notebook's own last infographic")) -> Dict[str, Any]:
    """The graphics library as the picker needs it: every look, every layout, the
    shapes and detail levels, and optional previews.

    Previews are SVG data URLs drawn by the same renderer that draws the artifact —
    a few KB each instead of a 40 KB raster, and sharp at any size.
    """
    manifest = gfx.library_manifest()
    out: Dict[str, Any] = {
        "ok": True,
        "default": gfx_themes.DEFAULT_PRESET,
        "count": len(gfx_themes.PRESETS),
        "styles": gfx_themes.catalog(),
        "templates": manifest["templates"],
        "orientations": list(gfx.ORIENTATIONS),
        "detail": list(gfx.DETAIL_LEVELS),
    }
    if previews:
        data, title = _preview_source(notebook)
        out["previews"] = {s["id"]: _style_thumb(data, title, s["id"])
                           for s in out["styles"]}
    return out


@router.get("/graphics_library")
def graphics_library() -> Dict[str, Any]:
    """Machine-readable inventory of the graphics library (templates × presets ×
    orientations × detail levels) for host apps and agents."""
    return {"ok": True, **gfx.library_manifest()}


#: Style previews are deterministic for a (payload, preset) pair, so one render per
#: pair is enough per process.
_THUMB_CACHE: Dict[Tuple[str, str], str] = {}


def _preview_source(notebook: str) -> Tuple[Dict[str, Any], str]:
    """The payload previews are drawn from: the notebook's latest infographic JSON
    when it has one, otherwise the library's built-in sample."""
    sample = _SAMPLE_GRAPHIC
    try:
        nb_id = store.resolve_notebook(notebook) if (notebook or "").strip() else ""
        if nb_id:
            arts = store._nb_dir(nb_id) / "artifacts"
            if arts.is_dir():
                jsons = sorted(list(arts.glob("*-infographic.json")), reverse=True)
                if jsons:
                    data = json.loads(jsons[0].read_text(encoding="utf-8"))
                    if isinstance(data, dict) and data.get("stats"):
                        data.pop("_style", None)
                        data.pop("_graphic", None)
                        return data, str(data.get("title") or "Infographic")
    except Exception:
        pass
    return sample, "Tidal power"


_SAMPLE_GRAPHIC: Dict[str, Any] = gfx.samples.SAMPLE_GRAPHIC


def _style_thumb(data: Dict[str, Any], title: str, style_id: str) -> str:
    key = (style_id, str(abs(hash(json.dumps(data, sort_keys=True, default=str))))[-12:])
    hit = _THUMB_CACHE.get(key)
    if hit:
        return hit
    payload = dict(data)
    payload.setdefault("title", title)
    out = gfx.data_url(payload, template="infographic", preset=style_id,
                       orientation="landscape")
    if len(_THUMB_CACHE) > 96:
        _THUMB_CACHE.clear()
    _THUMB_CACHE[key] = out
    return out


@router.get("/state")
def state(notebook: str = Query("", description="notebook id, title or slug"),
          thread: str = Query("", description="thread name to open (default: most recent)")) -> Any:
    try:
        notebooks = store.list_notebooks()
    except Exception as exc:
        return _fail(f"cannot read the notebook root: {exc}", 500)
    active = None
    wanted = _q(notebook)
    try:
        if wanted:
            active = _notebook_payload(store.resolve_notebook(wanted), thread)
        elif notebooks:
            active = _notebook_payload(notebooks[0]["id"], thread)
    except Exception as exc:
        return _fail(str(exc), 404)
    cards = []
    for nb in notebooks:
        nb_id = nb.get("id") or ""
        try:
            payload_sources = store.list_sources(nb_id)
            # count GENERATIONS, not files: one run writes 2-3 files, and the card
            # beside the notebook must agree with the studio's "n of 12 ready"
            arts = _collect_artifacts(nb_id)
        except Exception:
            payload_sources, arts = [], []
        cards.append({
            "id": nb_id,
            "title": nb.get("title") or nb_id,
            "description": nb.get("description") or "",
            "updated_at": nb.get("updated_at", ""),
            "sources": len(payload_sources),
            "artifacts": len(arts),
            "chars": sum(int(s.get("chars") or 0) for s in payload_sources),
        })
    return {
        "ok": True,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model_ready": _model_ready(),
        "notebooks": cards,
        "notebook": active,
        "kinds": KINDS,
    }


@router.post("/notebook")
def create_notebook(payload: Dict[str, Any] = Body(...)) -> Any:
    title = str(payload.get("title") or "").strip()
    if not title:
        return _fail("a notebook needs a title")
    try:
        meta = store.create_notebook(title, str(payload.get("description") or ""))
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    return {**_notebook_payload(meta["id"]), "ok": True}


# ------------------------------------------------------------------ sources

@router.post("/source")
def add_source(payload: Dict[str, Any] = Body(...)) -> Any:
    from hermes_notebook import tools as tools_mod
    nb = str(payload.get("notebook") or "")
    args = {"notebook": nb}
    for key in ("path", "url", "text", "title"):
        if payload.get(key):
            args[key] = payload[key]
    if not any(args.get(k) for k in ("path", "url", "text")):
        return _fail("give me a file path, a URL or some text")
    _ensure_model()
    try:
        out = json.loads(tools_mod.notebook_add_source(args))
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    if not out.get("ok"):
        return _fail(out.get("error") or "ingest failed", 422, detail=out)
    return {"ok": True, "source": out, "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/discover")
def discover(payload: Dict[str, Any] = Body(...)) -> Any:
    """NotebookLM-style "describe it": web-search candidate sources for a query
    (empty query falls back to the notebook's own title + description inside
    the tool). Nothing is added — the page shows the candidates and the user
    picks, then POSTs the kept urls to /sources."""
    from hermes_notebook import tools as tools_mod
    nb = str(payload.get("notebook") or "")
    args: Dict[str, Any] = {"notebook": nb}
    query = str(payload.get("query") or "").strip()
    if query:
        args["query"] = query
    if payload.get("max_results"):
        args["max_results"] = int(payload["max_results"])
    _ensure_model()
    try:
        out = json.loads(tools_mod.notebook_discover(args))
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    if not out.get("ok"):
        return _fail(out.get("error") or "search failed", 422, detail=out)
    return {"ok": True, "query": out.get("query") or "",
            "candidates": out.get("candidates") or []}


@router.post("/sources")
def add_sources(payload: Dict[str, Any] = Body(...)) -> Any:
    """Batch-add the urls a discover pass produced. Each url goes through the
    same ingest path as POST /source (extract → dedupe → auto-label), and the
    reply says per-url what landed so the page can report it honestly."""
    from hermes_notebook import tools as tools_mod
    nb = str(payload.get("notebook") or "")
    urls = []
    for u in (payload.get("urls") or []):
        u = str(u or "").strip()
        if u and u not in urls:
            urls.append(u)
    urls = urls[:10]
    if not urls:
        return _fail("no urls to add")
    _ensure_model()
    results = []
    for url in urls:
        try:
            out = json.loads(tools_mod.notebook_add_source({"notebook": nb, "url": url}))
        except Exception as exc:
            results.append({"url": url, "ok": False,
                            "error": f"{type(exc).__name__}: {exc}"})
            continue
        if out.get("skipped") == "duplicate":
            results.append({"url": url, "ok": True, "duplicate": True,
                            "title": (out.get("duplicate_of") or {}).get("title") or url})
        elif out.get("ok"):
            results.append({"url": url, "ok": True, "duplicate": False,
                            "source_id": out.get("source_id"),
                            "title": out.get("title"), "kind": out.get("kind"),
                            "labels": out.get("labels") or []})
        else:
            results.append({"url": url, "ok": False,
                            "error": out.get("error") or "ingest failed"})
    added = sum(1 for r in results if r.get("ok") and not r.get("duplicate"))
    dupes = sum(1 for r in results if r.get("duplicate"))
    try:
        state = _notebook_payload(store.resolve_notebook(nb))
    except Exception:
        state = None
    return {"ok": True, "added": added, "duplicates": dupes,
            "results": results, "state": state}


@router.post("/source_state")
def source_state(payload: Dict[str, Any] = Body(...)) -> Any:
    """NotebookLM's per-source checkbox: active sources feed answers and
    generation; unchecked ones stay stored but out of the context window."""
    nb = str(payload.get("notebook") or "")
    sid = str(payload.get("source_id") or "")
    enabled = bool(payload.get("enabled", True))
    try:
        nb_id = store.resolve_notebook(nb)
        if not store.get_source(nb_id, sid):
            return _fail(f"source {sid!r} is not in this notebook", 404)
        store.set_source_enabled(nb_id, sid, enabled)
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    return {"ok": True, "source_id": sid, "active": enabled,
            "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/note")
def add_note(payload: Dict[str, Any] = Body(...)) -> Any:
    """Quick note → a first-class searchable source (kind='note'). No model
    needed — notes skip the auto-label pass by design."""
    from hermes_notebook import tools as tools_mod
    nb = str(payload.get("notebook") or "")
    args: Dict[str, Any] = {"notebook": nb, "text": str(payload.get("text") or "")}
    if str(payload.get("title") or "").strip():
        args["title"] = str(payload["title"]).strip()
    if not args["text"].strip():
        return _fail("note text is required")
    try:
        out = json.loads(tools_mod.notebook_note(args))
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    if not out.get("ok"):
        return _fail(out.get("error") or "could not save the note", 422, detail=out)
    return {"ok": True, "source": out,
            "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/suggest")
def suggest(payload: Dict[str, Any] = Body(...)) -> Any:
    """NotebookLM's 'what to ask next': questions, artifact ideas and source
    gaps, generated from the notebook digest by the model."""
    from hermes_notebook import tools as tools_mod
    nb = str(payload.get("notebook") or "")
    _ensure_model()
    try:
        out = json.loads(tools_mod.notebook_suggest({"notebook": nb}))
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    if not out.get("ok"):
        return _fail(out.get("error") or "no suggestions", 422, detail=out)
    return {"ok": True, "title": out.get("title"),
            "suggestions": out.get("suggestions") or {}}


@router.post("/overview")
async def overview(payload: Dict[str, Any] = Body(...)) -> Any:
    """The hero card's executive summary: one grounded paragraph over the
    ACTIVE sources only (unchecked ones stay out, like everywhere else)."""
    from hermes_notebook import llmio, retrieve
    nb = str(payload.get("notebook") or "")
    _ensure_model()
    try:
        nb_id = store.resolve_notebook(nb)
    except Exception as exc:
        return _fail(str(exc), 404)
    digest = retrieve.notebook_digest(nb_id, max_chars=16000)
    if not digest.strip():
        return _fail("no active sources to summarize — check some sources first", 422)
    started = time.time()

    def _run() -> str:
        return llmio.complete(
            [
                {"role": "system", "content": (
                    "You write the opening overview of a research notebook. One tight "
                    "paragraph of 3-5 sentences synthesizing what the sources actually "
                    "say — the thesis, the strongest findings, and what is contested. "
                    "Mark load-bearing terms with **bold** so they scan. No preamble, "
                    "no sign-off, no invented facts.")},
                {"role": "user", "content": f"Notebook source excerpts:\n\n{digest}"},
            ],
            purpose="hermes-notebook.overview",
            max_tokens=600, temperature=0.4,
        )

    try:
        text = await run_in_threadpool(_run)
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    return {"ok": True, "overview": (text or "").strip(),
            "seconds": round(time.time() - started, 1)}


@router.post("/options")
def set_options(payload: Dict[str, Any] = Body(...)) -> Any:
    """Per-notebook preferences — chat style/length today, generator options
    tomorrow. Stored on notebook.json so every surface agrees."""
    nb = str(payload.get("notebook") or "")
    opts = payload.get("options")
    if not isinstance(opts, dict):
        return _fail("options must be an object")
    try:
        nb_id = store.resolve_notebook(nb)
        merged = dict(store.get_meta(nb_id).get("options") or {})
        for key, value in opts.items():
            key = str(key)
            if value in (None, ""):
                merged.pop(key, None)
            else:
                merged[key] = value
        store.update_meta(nb_id, options=merged)
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    return {"ok": True, "options": merged,
            "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/notebook/update")
def update_notebook(payload: Dict[str, Any] = Body(...)) -> Any:
    """Rename / re-describe a notebook (NotebookLM's notebook settings)."""
    nb = str(payload.get("notebook") or "")
    title = payload.get("title")
    desc = payload.get("description")
    if title is None and desc is None:
        return _fail("give a title and/or description")
    try:
        meta = store.update_meta(
            nb,
            title=str(title) if title is not None else None,
            description=str(desc) if desc is not None else None)
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    return {"ok": True, "notebook": _notebook_payload(meta["id"])}


@router.post("/notebook/delete")
def delete_notebook(payload: Dict[str, Any] = Body(...)) -> Any:
    nb = str(payload.get("notebook") or "")
    if not payload.get("confirm"):
        return _fail("deletion needs confirm=true — confirm with the user first")
    try:
        out = store.delete_notebook(nb)
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    return {"ok": True, **out}


@router.post("/ask")
async def ask(payload: Dict[str, Any] = Body(...)) -> Any:
    from hermes_notebook import retrieve
    nb_arg = str(payload.get("notebook") or "")
    question = str(payload.get("question") or "").strip()
    if not question:
        return _fail("ask something")
    _ensure_model()
    try:
        nb_id = store.resolve_notebook(nb_arg)
    except Exception as exc:
        return _fail(str(exc), 404)
    started = time.time()

    def _run() -> Dict[str, Any]:
        from hermes_notebook import tools as tools_mod
        args = {"notebook": nb_id, "question": question,
                "thread": str(payload.get("thread") or store.DEFAULT_THREAD)}
        ids = payload.get("source_ids")
        if isinstance(ids, list) and ids:
            args["source_ids"] = [str(x) for x in ids][:12]
        out = json.loads(tools_mod.notebook_ask(args))
        return out

    try:
        out = await run_in_threadpool(_run)
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    if not out.get("ok"):
        return _fail(out.get("error") or "the model did not answer", 422, detail=out)
    # the citation rows the page renders: number, title, real origin
    used = []
    for i, src in enumerate(out.get("sources_used") or [], 1):
        used.append({
            "n": src.get("n", i),
            "title": src.get("title") or "source",
            "kind": src.get("kind", ""),
            "origin": src.get("origin", ""),
            "id": src.get("id", ""),
        })
    return {
        "ok": True,
        "notebook": nb_id,
        "question": question,
        "answer": out.get("answer", ""),
        "citations": used,
        "chunks_used": out.get("chunks_used"),
        "total_chunks": out.get("total_chunks"),
        "seconds": round(time.time() - started, 1),
        "thread": out.get("thread"),
        "thread_name": str(payload.get("thread") or store.DEFAULT_THREAD),
    }


@router.get("/source_text")
def source_text(notebook: str = Query(...), id: str = Query(...),
                chars: int = Query(24000)) -> Any:
    """The stored text of one source, for the page's source peek.

    Reads what `store.add_source` wrote — the same bytes retrieval scores — so a
    citation opens exactly what the answer was built from.
    """
    try:
        nb_id = store.resolve_notebook(notebook)
    except Exception as exc:
        return _fail(str(exc), 404)
    src = store.get_source(nb_id, id)
    if not src:
        return _fail(f"source {id!r} is not in this notebook", 404)
    try:
        text = store.read_source_text(nb_id, src)
    except Exception as exc:
        return _fail(f"source text unreadable: {exc}", 500)
    limit = max(500, min(200_000, int(chars or 24000)))
    return {"ok": True, "id": src.get("id", id), "title": src.get("title") or id,
            "kind": src.get("kind", ""), "origin": src.get("origin", ""),
            "chars": len(text), "truncated": len(text) > limit, "text": text[:limit]}


@router.post("/search")
def search(payload: Dict[str, Any] = Body(...)) -> Any:
    from hermes_notebook import tools as tools_mod
    out = json.loads(tools_mod.notebook_search(
        {"notebook": str(payload.get("notebook") or ""),
         "query": str(payload.get("query") or ""),
         "limit": int(payload.get("limit") or 12)}))
    return {"ok": bool(out.get("ok")), "result": out}


# --------------------------------------------------------------- generation

@router.post("/generate")
async def generate(payload: Dict[str, Any] = Body(...)) -> Any:
    nb_arg = str(payload.get("notebook") or "")
    kind = str(payload.get("kind") or "")
    if kind not in KIND_INDEX:
        return _fail(f"unknown artifact kind {kind!r}")
    _ensure_model()
    try:
        nb_id = store.resolve_notebook(nb_arg)
    except Exception as exc:
        return _fail(str(exc), 404)
    started = time.time()

    try:
        if kind == "audio_overview":
            from hermes_notebook import audio
            out = await audio.make_audio_overview(
                nb_id, length=str(payload.get("length") or "short"),
                fmt=str(payload.get("format") or "deep_dive"),
                language=str(payload.get("language") or ""))
        elif kind == "video_overview":
            from hermes_notebook import video
            out = await video.make_video_overview(
                nb_id, style=str(payload.get("style") or "cinematic"),
                length=str(payload.get("length") or "short"),
                notes=payload.get("notes") if isinstance(payload.get("notes"), dict) else None)
        else:
            out = await run_in_threadpool(
                lambda: artifacts_mod.generate(
                    nb_id, kind,
                    focus=str(payload.get("focus") or ""),
                    count_hint=str(payload.get("count_hint") or ""),
                    style=str(payload.get("style") or ""),
                    fmt=str(payload.get("template") or ""),
                    options={"orientation": payload.get("orientation") or "landscape",
                             "detail": payload.get("detail") or "standard"}))
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    payload_state = _notebook_payload(nb_id)
    return {"ok": True, "kind": kind, "result": out,
            "seconds": round(time.time() - started, 1),
            "artifacts": payload_state["artifacts"],
            "stats": payload_state["stats"]}


@router.post("/video_notes")
async def video_notes(payload: Dict[str, Any] = Body(...)) -> Any:
    """Producer notes for a video overview — headlines + narration BEFORE any
    frame is encoded. The page reviews them, then POSTs them back to /generate
    as `notes` and the render skips the script rewrite."""
    nb_arg = str(payload.get("notebook") or "")
    _ensure_model()
    try:
        nb_id = store.resolve_notebook(nb_arg)
    except Exception as exc:
        return _fail(str(exc), 404)
    from hermes_notebook import video
    try:
        out = await video.video_notes(
            nb_id,
            length=str(payload.get("length") or "") or None,
            style=str(payload.get("style") or "") or None,
            focus=str(payload.get("focus") or ""))
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    return {"ok": True, **out}


@router.post("/label")
async def label(payload: Dict[str, Any] = Body(...)) -> Any:
    """Auto-label anything that arrived without labels (the ingest path labels on
    the way in; this catches sources written by another tool)."""
    nb_arg = str(payload.get("notebook") or "")
    _ensure_model()
    try:
        nb_id = store.resolve_notebook(nb_arg)
    except Exception as exc:
        return _fail(str(exc), 404)

    def _run() -> Dict[str, Any]:
        from hermes_notebook import ingest
        done, failed = [], []
        for src in store.list_sources(nb_id):
            if src.get("labels") and not payload.get("force"):
                continue
            try:
                text = store.read_source_text(nb_id, src)
                labels, summary = ingest._auto_label(
                    src.get("title") or "", src.get("kind") or "text",
                    src.get("origin") or "", text)
                store.update_source(nb_id, src["id"], labels=labels, summary=summary)
                done.append({"id": src["id"], "labels": labels, "summary": summary})
            except Exception as exc:
                failed.append({"id": src.get("id"), "error": str(exc)})
        return {"labeled": done, "failed": failed}

    try:
        out = await run_in_threadpool(_run)
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    return {"ok": True, **out, "state": _notebook_payload(nb_id)}


@router.get("/threads")
def threads(notebook: str = Query("", description="notebook id, title or slug")) -> Any:
    """Every conversation in a notebook, most recently used first."""
    try:
        nb_id = store.resolve_notebook(notebook)
    except Exception as exc:
        return _fail(str(exc), 404)
    rows = store.list_threads(nb_id)
    return {"ok": True, "threads": rows, "count": len(rows),
            "default": rows[0]["name"] if rows else ""}


@router.post("/thread/new")
def new_thread(payload: Dict[str, Any] = Body(...)) -> Any:
    """Start a conversation. Its memory is separate from every other thread."""
    try:
        nb_id = store.resolve_notebook(str(payload.get("notebook") or ""))
    except Exception as exc:
        return _fail(str(exc), 404)
    try:
        created = store.create_thread(nb_id, title=str(payload.get("title") or ""),
                                      name=str(payload.get("name") or ""))
    except Exception as exc:
        return _fail(str(exc), 400)
    return {"ok": True, "thread": created, "threads": store.list_threads(nb_id)}


@router.post("/thread/rename")
def rename_thread(payload: Dict[str, Any] = Body(...)) -> Any:
    try:
        nb_id = store.resolve_notebook(str(payload.get("notebook") or ""))
    except Exception as exc:
        return _fail(str(exc), 404)
    try:
        out = store.rename_thread(nb_id, str(payload.get("thread") or ""),
                                  str(payload.get("title") or ""))
    except Exception as exc:
        return _fail(str(exc), 400)
    return {"ok": True, "thread": out, "threads": store.list_threads(nb_id)}


@router.post("/thread/delete")
def delete_thread(payload: Dict[str, Any] = Body(...)) -> Any:
    if not payload.get("confirm"):
        return _fail("deleting a conversation needs confirm=true", 400)
    try:
        nb_id = store.resolve_notebook(str(payload.get("notebook") or ""))
    except Exception as exc:
        return _fail(str(exc), 404)
    try:
        out = store.delete_thread(nb_id, str(payload.get("thread") or ""))
    except Exception as exc:
        return _fail(str(exc), 400)
    return {"ok": True, **out, "threads": store.list_threads(nb_id)}


@router.post("/thread/clear")
def clear_thread(payload: Dict[str, Any] = Body(default={})) -> Any:
    try:
        nb_id = store.resolve_notebook(str(payload.get("notebook") or ""))
    except Exception as exc:
        return _fail(str(exc), 404)
    return {"ok": True, "thread": store.clear_thread(nb_id, str(payload.get("thread") or "default"))}


# ---------------------------------------------------------------- artifacts

@router.get("/artifact")
def artifact(notebook: str = Query(...), name: str = Query(...),
             b64: int = Query(0, description="1 = return base64 JSON (the page's blob path)")) -> Any:
    """Serve one artifact. Media streams with range support (video scrubbing);
    text comes back as UTF-8 so the page can render markdown itself.

    ``b64=1`` exists because a renderer cannot put an auth header on
    ``<video src>``/``<img src>``: the page fetches the bytes through
    ``ctx.rest`` (which carries the grant) and hands them to a blob URL.
    """
    try:
        nb_id = store.resolve_notebook(notebook)
        path = store.artifact_path(nb_id, name)
    except Exception as exc:
        return _fail(str(exc), 404)
    if not path.exists():
        return _fail(f"{name} is not in this notebook", 404)
    ext = path.suffix.lstrip(".").lower()
    if b64:
        import base64 as _b64
        mime = MEDIA_EXT.get(ext) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if ext in TEXT_EXT:
            mime = "text/plain; charset=utf-8"
        return {"ok": True, "name": path.name, "ext": ext, "mime": mime,
                "bytes": path.stat().st_size,
                "b64": _b64.b64encode(path.read_bytes()).decode("ascii")}
    if ext in MEDIA_EXT:
        return FileResponse(str(path), media_type=MEDIA_EXT[ext], filename=path.name)
    if ext in TEXT_EXT:
        return PlainTextResponse(path.read_text(encoding="utf-8", errors="replace"),
                                 media_type="text/plain; charset=utf-8")
    guessed = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(str(path), media_type=guessed, filename=path.name)


# -------------------------------------------------------------- ops (folded)

def _mount_ops() -> None:
    """Fold the homelab control deck in as `/ops/*`, same audited transport."""
    try:
        import ops_api  # type: ignore  # sibling module in dashboard/
    except Exception as exc:          # pragma: no cover - missing copy
        import logging
        logging.getLogger(__name__).warning("notebook: ops deck unavailable (%s)", exc)
        return
    router.include_router(ops_api.router, prefix="/ops")


_mount_ops()
