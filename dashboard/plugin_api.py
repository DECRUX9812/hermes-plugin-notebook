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

import json
import mimetypes
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from starlette.concurrency import run_in_threadpool

_PLUGIN_ROOT = str(Path(__file__).resolve().parent.parent)
_HERE = str(Path(__file__).resolve().parent)
for _p in (_PLUGIN_ROOT, _HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from hermes_notebook import runtime, store, artifacts as artifacts_mod  # noqa: E402

router = APIRouter(tags=["hermes-notebook"])

#: The twelve studio outputs, in the order the panel draws them. `group` decides
#: which filter chip a card falls under; `label` is what a person reads.
KINDS: List[Dict[str, Any]] = [
    {"id": "video_overview", "label": "Video Overview", "group": "media", "ext": "mp4",
     "blurb": "Narrated slideshow, cinematic or explainer", "secs": 60},
    {"id": "audio_overview", "label": "Audio Overview", "group": "media", "ext": "mp3",
     "blurb": "Two hosts talking through the sources", "secs": 90},
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
    {"id": "infographic", "label": "Infographic", "group": "visual", "ext": "png",
     "blurb": "One dense poster of the thesis", "secs": 20},
]
KIND_INDEX = {k["id"]: k for k in KINDS}
MEDIA_EXT = {"mp4": "video/mp4", "mp3": "audio/mpeg", "png": "image/png",
             "html": "text/html", "webm": "video/webm", "wav": "audio/wav"}
TEXT_EXT = {"md", "txt", "json", "csv", "srt", "vtt"}


# ------------------------------------------------------------------ helpers

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
        for want in ("mp4", "mp3", "png", "html", "md", "txt", "json"):
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


def _source_row(source: Dict[str, Any], index: int) -> Dict[str, Any]:
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
    }


def _notebook_payload(notebook_id: str) -> Dict[str, Any]:
    meta = store.get_meta(notebook_id)
    sources = [_source_row(s, i) for i, s in enumerate(store.list_sources(notebook_id))]
    label_counts: Dict[str, int] = {}
    for s in sources:
        for label in s["labels"]:
            label_counts[label] = label_counts.get(label, 0) + 1
    labels = [{"label": k, "count": v}
              for k, v in sorted(label_counts.items(), key=lambda kv: (-kv[1], kv[0]))]
    arts = _collect_artifacts(notebook_id)
    thread = store.get_thread(notebook_id, "default")[-24:]
    return {
        "id": meta.get("id", notebook_id),
        "title": meta.get("title") or notebook_id,
        "description": meta.get("description") or "",
        "created_at": meta.get("created_at", ""),
        "updated_at": meta.get("updated_at", ""),
        "sources": sources,
        "artifacts": arts,
        "labels": labels,
        "thread": thread,
        "stats": {
            "sources": len(sources),
            "chars": sum(s["chars"] for s in sources),
            "labels": len(labels),
            "unlabeled": sum(1 for s in sources if not s["labels"]),
            "artifacts": len(arts),
            "kinds": sorted({a["kind"] for a in arts}),
        },
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


@router.get("/state")
def state(notebook: str = Query("", description="notebook id, title or slug")) -> Any:
    try:
        notebooks = store.list_notebooks()
    except Exception as exc:
        return _fail(f"cannot read the notebook root: {exc}", 500)
    active = None
    wanted = (notebook or "").strip()
    try:
        if wanted:
            active = _notebook_payload(store.resolve_notebook(wanted))
        elif notebooks:
            active = _notebook_payload(notebooks[0]["id"])
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
        out = json.loads(tools_mod.notebook_ask(
            {"notebook": nb_id, "question": question, "thread": "default"}))
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
    }


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
                nb_id, length=str(payload.get("length") or "short"))
        elif kind == "video_overview":
            from hermes_notebook import video
            out = await video.make_video_overview(
                nb_id, style=str(payload.get("style") or "cinematic"),
                length=str(payload.get("length") or "short"))
        else:
            out = await run_in_threadpool(
                lambda: artifacts_mod.generate(
                    nb_id, kind,
                    focus=str(payload.get("focus") or ""),
                    count_hint=str(payload.get("count_hint") or "")))
    except Exception as exc:
        return _fail(f"{type(exc).__name__}: {exc}", 500)
    payload_state = _notebook_payload(nb_id)
    return {"ok": True, "kind": kind, "result": out,
            "seconds": round(time.time() - started, 1),
            "artifacts": payload_state["artifacts"],
            "stats": payload_state["stats"]}


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
