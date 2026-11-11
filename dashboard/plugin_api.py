"""Hermes Notebook backend — the door between the studio page and the agent.

Mounted by the gateway at ``/api/plugins/hermes-notebook/`` and reached from the
desktop page as ``ctx.rest(...)``.

Why this exists at all: the page needs two things the renderer cannot do —
read the notebooks on disk and run a grounded answer through the *user's*
model. Every route below is a thin call into code the
agent half already uses (``hermes_notebook.store`` / ``retrieve`` / ``artifacts``
/ ``audio`` / ``video``), so the page and the tools can never disagree: a
notebook generated in chat shows up in the studio and vice versa.

    GET  /health                     liveness + data root + model readiness
    GET  /state?notebook=<id|slug>   notebooks, sources, artifacts, thread, stats
    GET  /threads  /thread           the notebook's conversations, one transcript
    GET  /study?notebook=&limit=     today's spaced-repetition queue + mastery
    GET  /source_text?notebook=&id=  one source's stored text (chars= caps it)
    GET  /export?notebook=&b64=1     the whole notebook as a .zip
    GET  /graphics_library           the SVG template vocabulary
    GET  /infographic_styles?previews=1  the look catalogue (38 looks)
    POST /notebook                   {title, description} -> create
    POST /notebook/update            {notebook, title|description|emoji}
    POST /notebook/duplicate         {notebook} -> copy with sources + artifacts
    POST /notebook/delete            {notebook, confirm} -> delete a notebook
    POST /source                     {notebook, path|url|text, title?} -> ingest
    POST /sources                    {notebook, urls[]} -> batch ingest the picked candidates
    POST /source_state               {notebook, source_id|source_ids[], enabled} -> include/exclude
    POST /source/refresh             {notebook, source_id} -> re-fetch from its origin
    POST /source/delete              {notebook, source_id}
    POST /discover                   {notebook, query?, max_results?, deep?, rounds?} -> candidates
    POST /note                       {notebook, text, title?} -> quick note as a source
    POST /suggest                    {notebook} -> questions/artifacts/gaps from the model
    POST /overview                   {notebook} -> one-paragraph executive summary
    POST /ask                        {notebook, question, thread?, source_ids?} -> cited answer
    POST /generate                   {notebook, kind, focus?, count_hint?, style?, language?, …}
    POST /label                      {notebook, force?} -> auto-labels via the model
    POST /search                     {notebook, query|q, limit?} -> ranked hits with snippets
    GET  /agent/catalog?notebook=    the tables, tools and MCP servers agent mode can use
    POST /agent/run                  {notebook, question, mode} -> one grounded tool call + answer
    POST /agent/rerun                {notebook, tool, arguments} -> run one recorded action again
    POST /tensions                   {notebook, max_items?, language?} -> where the sources disagree
    POST /options                    {notebook, options{}} -> per-notebook preferences
    POST /study/review               {notebook, card, rating} -> schedule the next review
    POST /audio_render               {notebook, script} -> re-render an edited podcast script
    POST /video_notes                {notebook, focus?, length?, style?, language?}
    POST /thread/new  /thread/rename  /thread/delete  /thread/clear
    POST /artifact/rename  /artifact/delete  {notebook, key, title?}
    GET  /artifact?notebook=&name=   media bytes (mp4/mp3/png/html) or text
    GET  /artifact/xlsx?notebook=&name=  the table as a real workbook
    GET  /artifact/pptx?notebook=&name=  the deck as a real PowerPoint file

Nothing here invents a number: a route that cannot reach its data returns
``{"ok": false, "error": <real reason>}`` with a 5xx/4xx status and the page
renders that sentence.
"""

from __future__ import annotations

import json
import re
import mimetypes
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
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
                  "choices": ["short", "medium", "long"]},
                 {"id": "language", "label": "Language", "kind": "text",
                  "placeholder": "Auto (English)"}]},
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
     "blurb": "Vector poster — 38 looks, 9 layouts", "secs": 20,
     "options": [
         {"id": "style", "label": "Look", "kind": "select",
          "default": gfx_themes.DEFAULT_PRESET,
          "choices": [p["id"] for p in gfx_themes.catalog()],
          "items": [{"id": p["id"], "label": p["label"], "blurb": p["blurb"],
                     "family": p["family"], "swatch": p["swatch"]}
                    for p in gfx_themes.catalog()]},
         # "auto" lets the look choose its own composition — a cover look draws a
         # cover, a key-figure look draws its hero
         {"id": "template", "label": "Layout", "kind": "select", "default": "auto",
          "choices": ["auto", "infographic", "key_figure", "stat_grid", "timeline",
                      "comparison", "process", "quote_card", "cover", "illustration"],
          "items": [{"id": "auto", "label": "Auto · match the look"}] +
                   [{"id": t, "label": t.replace("_", " ").title()}
                    for t in ["infographic", "key_figure", "stat_grid", "timeline",
                              "comparison", "process", "quote_card", "cover",
                              "illustration"]]},
         {"id": "orientation", "label": "Shape", "kind": "seg",
          "choices": ["landscape", "square", "portrait"]},
         {"id": "detail", "label": "Detail", "kind": "seg",
          "choices": ["concise", "standard", "detailed"]}]},
    {"id": "blueprint_evolution", "label": "Architecture Blueprint", "group": "visual",
     "ext": "svg",
     "blurb": "Five-zone engineering poster: gaps → matrix → pillars", "secs": 38,
     "options": [
         {"id": "style", "label": "Look", "kind": "select",
          "default": "sections",
          "choices": ["sections", "blueprint", "swiss", "carbon", "dashboard",
                      "terminal", "mission", "hud"],
          "items": [{"id": i, "label": i.replace("_", " ").title()}
                    for i in ("sections", "blueprint", "swiss", "carbon", "dashboard",
                              "terminal", "mission", "hud")]},
         {"id": "orientation", "label": "Shape", "kind": "seg",
          "choices": ["landscape", "portrait", "square"],
          "hint": "the zone geometry scales, it does not reflow"},
         {"id": "detail", "label": "Detail", "kind": "seg",
          "choices": ["concise", "standard", "detailed"]},
         # Deterministic SVG is the default: text stays text, files are a few KB,
         # and a diffusion step cannot invent a number. The painted route is
         # opt-in and falls back to SVG when the host has no image backend.
         {"id": "engine", "label": "Engine", "kind": "seg", "default": "gfx",
          "choices": ["gfx", "imagen_blueprint"],
          "labels": {"gfx": "Vector · exact", "imagen_blueprint": "Painted · image model"}}]},
    {"id": "data_table", "label": "Data Table", "group": "docs", "ext": "csv",
     "blurb": "Structured rows, exports to Sheets", "secs": 14},
]
KIND_INDEX = {k["id"]: k for k in KINDS}

# Every generator accepts a free-text focus — surfaced as a universal option
# so each studio card's customize popover can narrow the run ("only costs").
_FOCUS_OPTION = {"id": "focus", "label": "Focus", "kind": "text",
                 "placeholder": "e.g. only the costs"}
_LANG_OPTION = {"id": "language", "label": "Language", "kind": "text",
                "placeholder": "e.g. French, Español"}
#: NotebookLM lets you turn the conversation you just had into an artifact. The
#: card's popover offers the same choice: the sources alone, or the open chat as
#: the brief (angle, audience, emphasis) with facts still coming from sources.
_FROM_CHAT_OPTION = {"id": "from_chat", "label": "Brief from", "kind": "seg",
                     "choices": ["sources", "chat"]}
_MEDIA_KINDS = {"video_overview", "audio_overview"}


def _kinds_payload() -> list:
    out = []
    for k in KINDS:
        kk = dict(k)
        opts = list(kk.get("options") or [])
        if not any(o.get("id") == "focus" for o in opts):
            opts.append(dict(_FOCUS_OPTION))
        if not any(o.get("id") == "language" for o in opts):
            opts.append(dict(_LANG_OPTION))
        if kk["id"] not in _MEDIA_KINDS and not any(o.get("id") == "from_chat" for o in opts):
            opts.append(dict(_FROM_CHAT_OPTION))
        kk["options"] = opts
        out.append(kk)
    return out


def _conversation_text(nb_id: str, thread: str, limit: int = 9000) -> str:
    """The open chat as a brief for an artifact (see store.thread_as_brief)."""
    return store.thread_as_brief(nb_id, thread, limit=limit)
MEDIA_EXT = {"mp4": "video/mp4", "mp3": "audio/mpeg", "png": "image/png",
             "html": "text/html", "webm": "video/webm", "wav": "audio/wav",
             "svg": "image/svg+xml"}
TEXT_EXT = {"md", "txt", "json", "csv", "srt", "vtt"}


# ------------------------------------------------------------------ helpers

def _q(value: Any) -> str:
    """A query argument as text. FastAPI hands the default `Query(...)` object when a
    route is called directly (tests, dump scripts), which has no `.strip()`."""
    return value.strip() if isinstance(value, str) else ""


def _why(exc: BaseException) -> str:
    """The sentence an exception carries, without the type prefix or the repr quotes.

    Two bugs came from hand-building this string 48 times:

    * ``str(KeyError("notebook not found: 'x'"))`` is ``'"notebook not found: \'x\'"'``
      — KeyError stringifies its argument as a repr, so the toast literally showed
      doubled quotes around the message;
    * ``f"{type(exc).__name__}: {exc}"`` prefixed a class name the reader cannot act
      on ("ValueError: ...") to sentences that were already written for a person.

    Every failing route now reports the same shape: one plain sentence.
    """
    if isinstance(exc, KeyError) and exc.args:
        return str(exc.args[0])
    text = str(exc).strip()
    return text or type(exc).__name__


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
    # filenames are <yyyymmdd>-<hhmmss>-<kind>.<ext> — the run key needs the
    # full stamp, not just the date, or same-day regenerations of one kind
    # collapse into a single row (and delete would eat both runs)
    parts = name.split("-", 2)
    return "-".join(parts[:2]) if len(parts) >= 3 else ""


def _fold_run(runs: Dict[str, Dict[str, Any]], kind: str, items: List[Dict[str, Any]]) -> None:
    """Append one cluster of same-kind files to the run it belongs to."""
    key = f"{_artifact_stamp(items[0]['name'])}-{kind}"
    run = runs.setdefault(key, {"key": key, "kind": kind, "files": [], "modified": ""})
    for item in items:
        name = item["name"]
        run["files"].append({"name": name, "ext": name.rsplit(".", 1)[-1].lower(),
                             "size": item.get("size", 0)})
        if item.get("modified", "") > run["modified"]:
            run["modified"] = item["modified"]


def _collect_artifacts(notebook_id: str) -> List[Dict[str, Any]]:
    """One row per *generation*, not per file: a single audio run writes .mp3 +
    .txt + .json, and a panel that lists all three reads as a mess."""
    raw = store.list_artifacts(notebook_id)
    titles = (store.get_meta(notebook_id).get("artifact_titles") or {})
    gen_opts = (store.get_meta(notebook_id).get("artifact_opts") or {})
    runs: Dict[str, Dict[str, Any]] = {}

    # A run's files are stamped when each one is WRITTEN, so a poster that takes
    # a second to render lands a second after its own JSON:
    #   20261109-173411-infographic.json + 20261109-173412-infographic.svg
    # Keying on the exact stamp split that into two artifacts — one with only the
    # image, one with only the data — and the viewer, which needs both, showed a
    # poster and no numbers. Files of one kind whose stamps are within ten
    # seconds of each other are one run (a render writes its JSON and its poster
    # a second or two apart; separate generations of the same kind are minutes
    # apart, and this notebook's bulk smoke runs are >=16s apart).
    def _stamp_dt(name: str):
        try:
            return time.mktime(time.strptime(_artifact_stamp(name), "%Y%m%d-%H%M%S"))
        except Exception:
            return None

    by_kind: Dict[str, List[Dict[str, Any]]] = {}
    for item in raw:
        by_kind.setdefault(_artifact_kind_of(item["name"]), []).append(item)

    for kind, items in by_kind.items():
        items.sort(key=lambda it: (_stamp_dt(it["name"]) or 0))
        cluster: List[Dict[str, Any]] = []
        last = None
        for item in items:
            at = _stamp_dt(item["name"])
            if cluster and at is not None and last is not None and at - last > 10:
                _fold_run(runs, kind, cluster)
                cluster = []
            cluster.append(item)
            last = at if at is not None else last
        if cluster:
            _fold_run(runs, kind, cluster)
    out = []
    legacy_used = set()
    for run in runs.values():
        exts = {f["ext"] for f in run["files"]}
        meta = KIND_INDEX.get(run["kind"], {})
        # Prefer the richest representation that actually renders: media, then a
        # vector poster, then a raster one, then html, then text, then json.
        # `svg` was missing from this list, so a vector poster fell through to
        # "whatever file the run listed first" — and for the blueprint that was
        # its .json, which the viewer then tried to open as an image.
        for want in ("mp4", "mp3", "png", "svg", "html", "csv", "md", "txt", "json"):
            if want in exts:
                primary = next(f for f in run["files"] if f["ext"] == want)
                break
        else:
            primary = run["files"][0]
        # titles renamed before the stamp fix live under the date-only key —
        # the newest run of that day+kind inherits it (files arrive newest-first)
        legacy_key = f"{run['key'].split('-', 1)[0]}-{run['kind']}"
        title = titles.get(run["key"], "")
        if not title and legacy_key not in legacy_used:
            title = titles.get(legacy_key, "")
            if title:
                legacy_used.add(legacy_key)
        out.append({
            "key": run["key"],
            "kind": run["kind"],
            "title": title,
            "opts": gen_opts.get(run["key"], {}),
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
    threads = store.list_threads(notebook_id)
    return {
        "id": meta.get("id", notebook_id),
        "title": meta.get("title") or notebook_id,
        "description": meta.get("description") or "",
        "emoji": meta.get("emoji") or "",
        "created_at": meta.get("created_at", ""),
        "updated_at": meta.get("updated_at", ""),
        "sources": sources,
        "artifacts": arts,
        "labels": labels,
        "thread": open_thread["messages"][-24:],
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

@router.get("/study")
def study_queue(notebook: str = Query("", description="Notebook id or title"),
                limit: int = Query(12, description="Cards to return (1-60)")) -> Any:
    """Today's study queue plus the notebook's mastery counts."""
    from hermes_notebook import study as study_mod
    try:
        nb = store.resolve_notebook(_q(notebook))
        return {"ok": True, "notebook": nb,
                "queue": study_mod.queue(nb, limit), "stats": study_mod.stats(nb)}
    except Exception as exc:
        return _fail(_why(exc), 400)


@router.post("/study/review")
def study_review(payload: Dict[str, Any] = Body(...)) -> Any:
    """Record one rating (again|hard|good|easy) and return the new schedule."""
    from hermes_notebook import study as study_mod
    try:
        nb = store.resolve_notebook(str(payload.get("notebook") or ""))
        out = study_mod.review(nb, str(payload.get("card") or ""),
                               str(payload.get("rating") or "good"))
        return {"ok": True, "notebook": nb, "result": out, "stats": study_mod.stats(nb)}
    except Exception as exc:
        return _fail(_why(exc), 400)


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
    shapes and detail levels, and optional previews drawn by the real renderer."""
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
    """Machine-readable inventory of the graphics library for host apps and agents."""
    return {"ok": True, **gfx.library_manifest()}


#: Style previews are deterministic for a (payload, preset) pair.
_THUMB_CACHE: Dict[Tuple[str, str], str] = {}


def _preview_source(notebook: str) -> Tuple[Dict[str, Any], str]:
    """The payload previews are drawn from: the notebook's latest infographic JSON,
    otherwise the library's built-in sample."""
    sample = gfx.samples.SAMPLE_GRAPHIC
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
        return _fail(_why(exc), 404)
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
        "kinds": _kinds_payload(),
    }


@router.post("/notebook")
def create_notebook(payload: Dict[str, Any] = Body(...)) -> Any:
    title = str(payload.get("title") or "").strip()
    if not title:
        return _fail("a notebook needs a title")
    try:
        meta = store.create_notebook(title, str(payload.get("description") or ""))
    except Exception as exc:
        return _fail(_why(exc), 500)
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
        return _fail(_why(exc), 500)
    if not out.get("ok"):
        return _fail(out.get("error") or "ingest failed", 422, detail=out)
    return {"ok": True, "source": out, "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/discover")
def discover(payload: Dict[str, Any] = Body(...)) -> Any:
    """A discovery pass that knows the notebook: plan queries from its gaps, fan
    out across the search providers, rank with a per-domain cap, and explain each
    candidate. Nothing is added — the page shows the cards and the person picks,
    then POSTs the kept urls to /sources.
    """
    from hermes_notebook import discover as discover_mod
    nb_arg = str(payload.get("notebook") or "")
    try:
        nb_id = store.resolve_notebook(nb_arg)
    except Exception as exc:
        return _fail(_why(exc), 404)
    _ensure_model()
    try:
        out = discover_mod.discover(
            nb_id,
            query=str(payload.get("query") or ""),
            max_results=max(4, min(30, int(payload.get("max_results") or 12))),
            per_domain=max(1, min(4, int(payload.get("per_domain") or 2))),
            plan=bool(payload.get("plan", True)),
            deep=bool(payload.get("deep", False)),
            rounds=int(payload["rounds"]) if str(payload.get("rounds") or "").isdigit() else None,
        )
    except Exception as exc:
        return _fail(_why(exc), 500)
    return out


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
    generation; unchecked ones stay stored but out of the context window.
    `source_ids` (list) bulk-toggles a whole folder/group in one call."""
    nb = str(payload.get("notebook") or "")
    enabled = bool(payload.get("enabled", True))
    try:
        nb_id = store.resolve_notebook(nb)
        sids = payload.get("source_ids")
        if isinstance(sids, list) and sids:
            ids = [str(x) for x in sids]
            known = {s.get("id") for s in store.list_sources(nb_id)}
            missing = [x for x in ids if x not in known]
            if missing:
                return _fail(f"sources not in this notebook: {missing[:3]}", 404)
            for sid in ids:
                store.set_source_enabled(nb_id, sid, enabled)
            return {"ok": True, "active": enabled, "count": len(ids),
                    "state": _notebook_payload(store.resolve_notebook(nb))}
        sid = str(payload.get("source_id") or "")
        if not store.get_source(nb_id, sid):
            return _fail(f"source {sid!r} is not in this notebook", 404)
        store.set_source_enabled(nb_id, sid, enabled)
    except Exception as exc:
        return _fail(_why(exc), 500)
    return {"ok": True, "source_id": sid, "active": enabled,
            "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/source/delete")
def delete_source(payload: Dict[str, Any] = Body(...)) -> Any:
    """Remove a source entirely — index entry + stored text."""
    nb = str(payload.get("notebook") or "")
    sid = str(payload.get("source_id") or "")
    try:
        nb_id = store.resolve_notebook(nb)
        store.remove_source(nb_id, sid)
    except KeyError as exc:
        return _fail(_why(exc), 404)
    except Exception as exc:
        return _fail(_why(exc), 500)
    return {"ok": True, "source_id": sid,
            "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/artifact/delete")
def delete_artifact(payload: Dict[str, Any] = Body(...)) -> Any:
    """Delete one generated run — every file sharing its stamp+kind prefix."""
    nb = str(payload.get("notebook") or "")
    key = str(payload.get("key") or "")
    try:
        nb_id = store.resolve_notebook(nb)
    except Exception as exc:
        return _fail(_why(exc), 404)
    run = next((a for a in _collect_artifacts(nb_id) if a["key"] == key), None)
    if not run:
        return _fail(f"artifact {key!r} is not in this notebook", 404)
    removed = []
    for f in run["files"]:
        try:
            p = store.artifact_path(nb_id, f["name"])
            if p.exists():
                p.unlink()
                removed.append(f["name"])
        except Exception:
            continue
    if not removed:
        return _fail("could not remove the artifact files", 500)
    return {"ok": True, "removed": removed,
            "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/artifact/rename")
def rename_artifact(payload: Dict[str, Any] = Body(...)) -> Any:
    """Display title for a generated run — filenames encode stamp+kind, so the
    override lives in notebook meta keyed by the run key. Empty title resets."""
    nb = str(payload.get("notebook") or "")
    key = str(payload.get("key") or "")
    title = str(payload.get("title") or "").strip()[:120]
    try:
        nb_id = store.resolve_notebook(nb)
    except Exception as exc:
        return _fail(_why(exc), 404)
    run = next((a for a in _collect_artifacts(nb_id) if a["key"] == key), None)
    if not run:
        return _fail(f"artifact {key!r} is not in this notebook", 404)
    titles = dict(store.get_meta(nb_id).get("artifact_titles") or {})
    if title:
        titles[key] = title
    else:
        titles.pop(key, None)
    store.update_meta(nb_id, artifact_titles=titles)
    return {"ok": True, "title": titles.get(key, ""),
            "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/source/refresh")
async def refresh_source(payload: Dict[str, Any] = Body(...)) -> Any:
    """Re-fetch a url/file source from its locator and update it in place —
    labels and summary are regenerated to match the new text."""
    nb = str(payload.get("notebook") or "")
    sid = str(payload.get("source_id") or "")
    try:
        nb_id = store.resolve_notebook(nb)
        if not store.get_source(nb_id, sid):
            return _fail(f"source {sid!r} is not in this notebook", 404)
        from hermes_notebook import ingest
        updated = await run_in_threadpool(ingest.refresh_source, nb_id, sid)
    except KeyError as exc:
        return _fail(_why(exc), 404)
    except Exception as exc:
        return _fail(_why(exc), 422)
    return {"ok": True, "source": updated,
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
        return _fail(_why(exc), 500)
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
        return _fail(_why(exc), 500)
    if not out.get("ok"):
        return _fail(out.get("error") or "no suggestions", 422, detail=out)
    return {"ok": True, "title": out.get("title"),
            "suggestions": out.get("suggestions") or {}}



@router.post("/tensions")
def tensions(payload: Dict[str, Any] = Body(...)) -> Any:
    """Where the sources disagree, plus how independent they really are.

    The independence half is deterministic (text overlap), so it answers even
    when the model is not bound; only the conflict audit needs the model."""
    from hermes_notebook import tensions as tensions_mod
    nb = str(payload.get("notebook") or "")
    try:
        nb_id = store.resolve_notebook(nb)
    except Exception as exc:
        return _fail(_why(exc), 404)
    indep = tensions_mod.independence(nb_id)
    try:
        _ensure_model()
        out = tensions_mod.analyze(
            nb_id,
            max_items=max(1, min(10, int(payload.get("max_items") or 6))),
            language=str(payload.get("language") or ""))
    except Exception as exc:
        # Honest degradation: the measured half is still worth showing.
        return {"ok": True, "notebook": nb_id, "items": [], "agreements": [],
                "independence": indep, "sources": indep.get("sources", 0),
                "degraded": _why(exc)}
    out.pop("ok", None)
    return {"ok": True, **out}


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
        return _fail(_why(exc), 404)
    digest = retrieve.notebook_digest(nb_id, max_chars=16000, cited=True)
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
                    "Mark load-bearing terms with **bold** so they scan, and cite the "
                    "source behind each load-bearing claim inline as [S<n>] using the "
                    "numbers in the excerpt headers. No preamble, no sign-off, no "
                    "invented facts.")},
                {"role": "user", "content": f"Notebook source excerpts:\n\n{digest}"},
            ],
            purpose="hermes-notebook.overview",
            max_tokens=600, temperature=0.4,
        )

    try:
        text = await run_in_threadpool(_run)
    except Exception as exc:
        return _fail(_why(exc), 500)
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
        return _fail(_why(exc), 500)
    return {"ok": True, "options": merged,
            "state": _notebook_payload(store.resolve_notebook(nb))}


@router.post("/notebook/update")
def update_notebook(payload: Dict[str, Any] = Body(...)) -> Any:
    """Rename / re-describe / re-icon a notebook (NotebookLM's notebook settings)."""
    nb = str(payload.get("notebook") or "")
    title = payload.get("title")
    desc = payload.get("description")
    emoji = payload.get("emoji")
    if title is None and desc is None and emoji is None:
        return _fail("give a title, description and/or emoji")
    try:
        meta = store.update_meta(
            nb,
            title=str(title) if title is not None else None,
            description=str(desc) if desc is not None else None,
            **({"emoji": str(emoji)[:16]} if emoji is not None else {}))
    except Exception as exc:
        return _fail(_why(exc), 500)
    return {"ok": True, "notebook": _notebook_payload(meta["id"])}


@router.post("/notebook/duplicate")
def duplicate_notebook(payload: Dict[str, Any] = Body(...)) -> Any:
    """Copy a notebook — sources, artifacts, labels and options, fresh chat."""
    nb = str(payload.get("notebook") or "")
    try:
        out = store.duplicate_notebook(nb)
    except Exception as exc:
        return _fail(_why(exc), 500)
    return {"ok": True, "notebook": out}


@router.post("/notebook/delete")
def delete_notebook(payload: Dict[str, Any] = Body(...)) -> Any:
    nb = str(payload.get("notebook") or "")
    if not payload.get("confirm"):
        return _fail("deletion needs confirm=true — confirm with the user first")
    try:
        out = store.delete_notebook(nb)
    except Exception as exc:
        return _fail(_why(exc), 500)
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
        return _fail(_why(exc), 404)
    started = time.time()

    def _run() -> Dict[str, Any]:
        from hermes_notebook import tools as tools_mod
        args = {"notebook": nb_id, "question": question,
                "thread": runtime.slugify(str(payload.get("thread") or "default"), 60) or "default"}
        ids = payload.get("source_ids")
        if isinstance(ids, list) and ids:
            args["source_ids"] = [str(x) for x in ids][:12]
        if payload.get("retry"):
            args["retry"] = True
        out = json.loads(tools_mod.notebook_ask(args))
        return out

    try:
        out = await run_in_threadpool(_run)
    except Exception as exc:
        return _fail(_why(exc), 500)
    if not out.get("ok"):
        return _fail(out.get("error") or "the model did not answer", 422, detail=out)
    # the citation rows the page renders: number, title, real origin — only
    # the sources the answer actually cites (full-context puts them all in
    # context, so sources_used alone would chip every source on every answer)
    from hermes_notebook import retrieve as retrieve_mod
    used = []
    for i, src in enumerate(
            retrieve_mod.cited_sources(out.get("sources_used") or [],
                                       out.get("answer", "")), 1):
        used.append({
            "n": src.get("n", i),
            "title": src.get("title") or "source",
            "kind": src.get("kind", ""),
            "origin": src.get("origin", ""),
            "id": src.get("id", ""),
            "snippet": src.get("snippet", ""),
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
        return _fail(_why(exc), 404)
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


@router.get("/agent/catalog")
def agent_catalog(notebook: str = Query("", description="notebook id or title")) -> Any:
    """What agent mode can actually do here: the tables, the tools, the MCP servers."""
    from hermes_notebook import agent_tools
    nb = str(notebook or "")
    try:
        nb_id = store.resolve_notebook(nb) if nb else ""
    except Exception as exc:
        return _fail(_why(exc), 404)
    out = agent_tools.catalog(nb_id) if nb_id else {
        "ok": True, "engine": agent_tools.engine_name(), "tools": agent_tools.TOOLS,
        "tables": [], "mcp": []}
    out["model_ready"] = _model_ready()
    return out


@router.post("/agent/run")
def agent_run(payload: Dict[str, Any] = Body(...)) -> Any:
    """One grounded tool call, then an answer made from its real output.

    ``mode`` is the composer's pill: ``agent`` plans and may execute,
    ``council`` answers then re-reads the passages trying to refute the answer,
    ``grounded`` answers from the sources only (no tool is run even if asked).
    """
    from hermes_notebook import agent
    nb = str(payload.get("notebook") or "")
    question = str(payload.get("question") or "")
    if not question.strip():
        return _fail("ask something first")
    try:
        nb_id = store.resolve_notebook(nb)
    except Exception as exc:
        return _fail(_why(exc), 404)
    _ensure_model()
    asked = str(payload.get("mode") or "agent")
    mode = asked if asked in ("agent", "council") else "grounded"
    try:
        out = agent.run(nb_id, question, thread=str(payload.get("thread") or ""), mode=mode)
    except Exception as exc:
        return _fail(_why(exc), 500)
    if not out.get("ok"):
        return _fail(str(out.get("error") or "the agent did not answer"),
                     extra={"actions": out.get("actions") or []})
    return {"ok": True, "notebook": nb_id, "answer": out.get("answer", ""),
            "citations": out.get("citations") or [], "actions": out.get("actions") or [],
            "council": out.get("council"), "mode": out.get("mode"),
            "seconds": out.get("seconds")}


@router.post("/agent/rerun")
def agent_rerun(payload: Dict[str, Any] = Body(...)) -> Any:
    """Re-run one recorded action verbatim — the card's ⚡ Re-run button."""
    from hermes_notebook import agent
    tool = str(payload.get("tool") or "")
    if tool not in agent.RERUNNABLE:
        return _fail(f"cannot re-run {tool!r}", 400)
    try:
        nb_id = store.resolve_notebook(str(payload.get("notebook") or ""))
    except Exception as exc:
        return _fail(_why(exc), 404)
    out = agent.rerun(nb_id, tool,
                      payload.get("arguments") if isinstance(payload.get("arguments"), dict) else {})
    if not out.get("ok"):
        return _fail(str(out.get("error") or "that action did not run"), 400, action=out.get("action"))
    return {"ok": True, "action": out["action"]}


@router.post("/search")
def search(payload: Dict[str, Any] = Body(...)) -> Any:
    """Ranked hits inside one notebook. An empty query is a 400 with a sentence,
    not a 500: ``notebook_search`` raises ValueError for it, and the page used
    to get FastAPI's bare "Internal Server Error" instead of anything it could
    show the reader. ``q`` is accepted beside ``query`` because every other
    search surface in the app spells it that way."""
    from hermes_notebook import tools as tools_mod
    query = str(payload.get("query") or payload.get("q") or "").strip()
    if not query:
        return _fail("type something to search for")
    try:
        limit = max(1, min(50, int(payload.get("limit") or 12)))
    except (TypeError, ValueError):
        limit = 12
    try:
        out = json.loads(tools_mod.notebook_search(
            {"notebook": str(payload.get("notebook") or ""),
             "query": query,
             "limit": limit}))
    except Exception as exc:
        return _fail(_why(exc))
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
        return _fail(_why(exc), 404)
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
                language=str(payload.get("language") or ""),
                notes=payload.get("notes") if isinstance(payload.get("notes"), dict) else None)
        else:
            conversation = ""
            if str(payload.get("from_chat") or "") in ("chat", "conversation"):
                conversation = _conversation_text(nb_id, str(payload.get("thread") or ""))
            out = await run_in_threadpool(
                lambda: artifacts_mod.generate(
                    nb_id, kind,
                    focus=str(payload.get("focus") or ""),
                    count_hint=str(payload.get("count_hint") or ""),
                    style=str(payload.get("style") or ""),
                    fmt=str(payload.get("template") or ""),
                    conversation=conversation,
                    language=str(payload.get("language") or ""),
                    options={"orientation": payload.get("orientation") or "landscape",
                             "detail": payload.get("detail") or "standard",
                             # `engine` decides vector vs painted for the blueprint.
                             # Dropping it here made the Studio toggle a no-op: it
                             # saved the choice and generated the default anyway.
                             "engine": (payload.get("options") or {}).get("engine")
                                       or payload.get("engine") or "gfx"}))
    except Exception as exc:
        return _fail(_why(exc), 500)
    # remember the knobs this run used — regenerate reuses them and the row
    # can show the artifact was tailored
    opts_used = {k: str(payload.get(k) or "").strip()
                 for k in ("focus", "count_hint", "format", "length", "language", "style",
                           "template", "orientation", "detail", "engine", "from_chat")}
    opts_used = {k: v for k, v in opts_used.items() if v}
    if opts_used:
        try:
            src = out.get("path") or out.get("audio") or out.get("video") or ""
            fname = str(src).replace("\\", "/").rsplit("/", 1)[-1]
            key = f"{_artifact_stamp(fname)}-{kind}" if fname else ""
            if key:
                aopts = dict(store.get_meta(nb_id).get("artifact_opts") or {})
                aopts[key] = opts_used
                store.update_meta(nb_id, artifact_opts=aopts)
        except Exception:
            pass
    payload_state = _notebook_payload(nb_id)
    return {"ok": True, "kind": kind, "result": out,
            "seconds": round(time.time() - started, 1),
            "artifacts": payload_state["artifacts"],
            "stats": payload_state["stats"]}


@router.post("/audio_render")
async def audio_render(payload: Dict[str, Any] = Body(...)) -> Any:
    """Re-voice an edited podcast script — the Studio's script stage. Takes the
    script JSON shape the audio sidecar already stores ({title, segments:
    [{speaker, text}], voices?}) and runs the same TTS pipeline as generation,
    minus the model call. Output lands as a new timestamped run."""
    nb_arg = str(payload.get("notebook") or "")
    try:
        nb_id = store.resolve_notebook(nb_arg)
    except Exception as exc:
        return _fail(_why(exc), 404)
    from hermes_notebook import audio
    script = payload.get("script") if isinstance(payload.get("script"), dict) else payload
    started = time.time()
    try:
        out = await audio.render_audio_script(nb_id, script)
    except Exception as exc:
        return _fail(_why(exc), 500)
    return {"ok": True, "result": out,
            "seconds": round(time.time() - started, 1)}


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
        return _fail(_why(exc), 404)
    from hermes_notebook import video
    try:
        out = await video.video_notes(
            nb_id,
            length=str(payload.get("length") or "") or None,
            style=str(payload.get("style") or "") or None,
            language=str(payload.get("language") or ""),
            focus=str(payload.get("focus") or ""))
    except Exception as exc:
        return _fail(_why(exc), 500)
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
        return _fail(_why(exc), 404)

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
        return _fail(_why(exc), 500)
    return {"ok": True, **out, "state": _notebook_payload(nb_id)}


@router.get("/thread")
def get_thread(notebook: str = Query(...), name: str = Query("default")) -> Any:
    """One conversation's messages — the page fetches non-default threads on
    demand instead of shipping every thread in /state."""
    try:
        nb_id = store.resolve_notebook(notebook)
    except Exception as exc:
        return _fail(_why(exc), 404)
    safe = runtime.slugify(name or "default", 60) or "default"
    return {"ok": True, "thread": safe,
            "messages": store.get_thread(nb_id, safe)[-48:]}


@router.get("/threads")
def threads(notebook: str = Query("", description="notebook id, title or slug")) -> Any:
    """Every conversation in a notebook, most recently used first."""
    try:
        nb_id = store.resolve_notebook(notebook)
    except Exception as exc:
        return _fail(_why(exc), 404)
    rows = store.list_threads(nb_id)
    return {"ok": True, "threads": rows, "count": len(rows),
            "default": rows[0]["name"] if rows else ""}


@router.post("/thread/new")
def new_thread(payload: Dict[str, Any] = Body(...)) -> Any:
    """Start a conversation. Its memory is separate from every other thread."""
    try:
        nb_id = store.resolve_notebook(str(payload.get("notebook") or ""))
    except Exception as exc:
        return _fail(_why(exc), 404)
    try:
        created = store.create_thread(nb_id, title=str(payload.get("title") or ""),
                                      name=str(payload.get("name") or ""))
    except Exception as exc:
        return _fail(_why(exc), 400)
    return {"ok": True, "thread": created, "threads": store.list_threads(nb_id)}


@router.post("/thread/rename")
def rename_thread(payload: Dict[str, Any] = Body(...)) -> Any:
    try:
        nb_id = store.resolve_notebook(str(payload.get("notebook") or ""))
    except Exception as exc:
        return _fail(_why(exc), 404)
    try:
        out = store.rename_thread(nb_id, str(payload.get("thread") or ""),
                                  str(payload.get("title") or ""))
    except Exception as exc:
        return _fail(_why(exc), 400)
    return {"ok": True, "thread": out, "threads": store.list_threads(nb_id)}


@router.post("/thread/delete")
def delete_thread(payload: Dict[str, Any] = Body(...)) -> Any:
    if not payload.get("confirm"):
        return _fail("deleting a conversation needs confirm=true", 400)
    try:
        nb_id = store.resolve_notebook(str(payload.get("notebook") or ""))
    except Exception as exc:
        return _fail(_why(exc), 404)
    try:
        out = store.delete_thread(nb_id, str(payload.get("thread") or ""))
    except Exception as exc:
        return _fail(_why(exc), 400)
    return {"ok": True, **out, "threads": store.list_threads(nb_id)}


@router.post("/thread/clear")
def clear_thread(payload: Dict[str, Any] = Body(default={})) -> Any:
    try:
        nb_id = store.resolve_notebook(str(payload.get("notebook") or ""))
    except Exception as exc:
        return _fail(_why(exc), 404)
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
        return _fail(_why(exc), 404)
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


@router.get("/artifact/xlsx")
def artifact_xlsx(notebook: str = Query(...), name: str = Query(...),
                  b64: int = Query(0, description="1 = return base64 JSON (the page's blob path")) -> Any:
    """A data table as a real .xlsx.

    The CSV is the interchange format and stays the artifact; a spreadsheet with
    typed columns, a frozen header row and an auto-filter is what someone
    actually pivots. Built from the SAME stored JSON the viewer reads, so the
    workbook cannot disagree with the table on screen.
    """
    from hermes_notebook import xlsx_export
    try:
        nb_id = store.resolve_notebook(notebook)
        path = store.artifact_path(nb_id, name)
    except Exception as exc:
        return _fail(_why(exc), 404)
    if not path.exists():
        return _fail(f"{name} is not in this notebook", 404)
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except ValueError:
        return _fail(f"{name} is not table JSON — open the artifact's events file", 400)
    try:
        blob = xlsx_export.workbook(data)
    except Exception as exc:  # openpyxl missing or a malformed table
        return _fail(_why(exc), 500)
    out_name = re.sub(r"\.json$", "", path.name) + ".xlsx"
    if b64:
        import base64 as _b64
        return {"ok": True, "name": out_name, "ext": "xlsx",
                "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "bytes": len(blob), "b64": _b64.b64encode(blob).decode("ascii")}
    from fastapi import Response
    return Response(content=blob, media_type=(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'})


@router.get("/artifact/pptx")
def artifact_pptx(notebook: str = Query(...), name: str = Query(...),
                  b64: int = Query(0, description="1 = return base64 JSON (the page's blob path")) -> Any:
    """The slide deck as a real .pptx — NotebookLM ships PPTX/Slides export and a
    deck that can only be presented inside Hermes is half a deliverable.

    Built from the stored deck JSON by `hermes_notebook.pptx_export`, so the
    file always matches what the viewer shows (no second model pass, no drift).
    """
    from hermes_notebook import pptx_export
    try:
        nb_id = store.resolve_notebook(notebook)
        path = store.artifact_path(nb_id, name)
    except Exception as exc:
        return _fail(_why(exc), 404)
    if not path.exists():
        return _fail(f"{name} is not in this notebook", 404)
    try:
        deck = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except ValueError:
        return _fail(f"{name} is not deck JSON — open the slides artifact's events file", 400)
    slides = deck.get("slides") if isinstance(deck, dict) else None
    if not isinstance(slides, list) or not slides:
        return _fail(f"{name} has no slides to export", 400)
    meta = store.get_meta(nb_id)
    title = str(deck.get("title") or meta.get("title") or nb_id)
    subtitle = str(deck.get("subtitle") or deck.get("framing") or meta.get("description") or "")
    data = pptx_export.build_pptx(title, slides, subtitle=subtitle)
    filename = runtime.slugify(title, limit=40) + ".pptx"
    mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    if b64:
        import base64 as _b64
        return {"ok": True, "name": filename, "ext": "pptx", "mime": mime,
                "bytes": len(data), "b64": _b64.b64encode(data).decode("ascii")}
    return Response(content=data, media_type=mime,
                    headers={"content-disposition": f'attachment; filename="{filename}"'})


@router.get("/export")
def export_nb(notebook: str = Query(...),
              b64: int = Query(0, description="1 = base64 JSON (the page's blob path)")) -> Any:
    """Whole-notebook zip: sources + artifacts + threads + meta. ``b64=1``
    matches /artifact — the page fetches through ctx.rest and downloads a blob."""
    try:
        nb_id = store.resolve_notebook(notebook)
        meta = store.get_meta(nb_id)
        out = store.export_notebook(nb_id)
    except Exception as exc:
        return _fail(_why(exc), 404)
    zp = Path(out["zip"])
    name = f"{nb_id}-notebook.zip"
    if b64:
        import base64 as _b64
        return {"ok": True, "name": name, "bytes": out["size_bytes"], "files": out["files"],
                "b64": _b64.b64encode(zp.read_bytes()).decode("ascii")}
    return FileResponse(str(zp), media_type="application/zip", filename=name)
