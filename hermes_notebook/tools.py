"""Tool handlers — JSON envelope on every path, never a raise into the agent loop."""

from __future__ import annotations

from typing import Any

from . import artifacts, audio, ingest, llmio, retrieve, runtime, store, video


def _notebook_brief(nb_id: str) -> dict:
    meta = store.get_meta(nb_id)
    sources = store.list_sources(nb_id)
    return {
        "id": nb_id,
        "title": meta.get("title"),
        "description": meta.get("description", ""),
        "dir": str(store._nb_dir(nb_id)),
        "sources": [{
            "id": s.get("id"), "title": s.get("title"), "kind": s.get("kind"),
            "origin": s.get("origin"), "chars": s.get("chars"),
            "labels": s.get("labels", []), "summary": s.get("summary", ""),
        } for s in sources],
        "artifacts": store.list_artifacts(nb_id),
    }


def notebook_list(args: dict, **kw) -> str:
    nb_arg = (args.get("notebook") or "").strip()
    if nb_arg:
        nb_id = store.resolve_notebook(nb_arg)
        brief = _notebook_brief(nb_id)
        if args.get("include_text"):
            for s in brief["sources"]:
                rec = store.get_source(nb_id, s["id"])
                if rec:
                    s["text"] = store.read_source_text(nb_id, rec)[:20000]
        return runtime.ok(**brief)
    nbs = store.list_notebooks()
    if not nbs:
        return runtime.ok(notebooks=[], hint="No notebooks yet — call notebook_create, then notebook_add_source.")
    return runtime.ok(notebooks=nbs)


def notebook_create(args: dict, **kw) -> str:
    title = (args.get("title") or "").strip()
    meta = store.create_notebook(title, args.get("description") or "")
    return runtime.ok(
        id=meta["id"], title=meta["title"], description=meta.get("description", ""),
        dir=meta["dir"],
        next="Add sources with notebook_add_source (path=, url=, or text=).",
    )


def notebook_add_source(args: dict, **kw) -> str:
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    rec = ingest.ingest(
        nb_id,
        path=args.get("path"),
        url=args.get("url"),
        text=args.get("text"),
        title=args.get("title"),
    )
    total = len(store.list_sources(nb_id))
    return runtime.ok(
        notebook=nb_id, source_id=rec["id"], title=rec["title"], kind=rec["kind"],
        origin=rec["origin"], chars=rec["chars"], labels=rec.get("labels", []),
        summary=rec.get("summary", ""), sources_in_notebook=total,
    )


_ASK_SYSTEM = (
    "You are the notebook's research assistant. Answer the user's question using "
    "ONLY the provided source excerpts. Rules:\n"
    "- Cite every factual claim with its source tag like [S1] or [S2].\n"
    "- If the sources don't contain the answer, say exactly that and suggest "
    "what's missing — never invent facts.\n"
    "- Be direct and well-organized: short answer first, then supporting detail.\n"
    "- When useful, end with 'Sources:' listing the cited source titles."
)


def notebook_ask(args: dict, **kw) -> str:
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    question = (args.get("question") or "").strip()
    if not question:
        raise ValueError("question is required")
    max_chars = int(args.get("max_chars") or runtime.config("ask_context_chars", default=28000))
    only = args.get("source_ids") or None
    if only is not None and not isinstance(only, list):
        only = [str(only)]
    result = retrieve.retrieve(nb_id, question, max_chars=max_chars, only_ids=only)
    if not result["context"]:
        return runtime.fail(
            "notebook has no readable sources",
            notebook=nb_id,
            hint="Add sources with notebook_add_source first.",
        )
    user = (
        f"Question: {question}\n\n"
        f"Source excerpts (tags [S1]…[Sn] map to sources):\n\n{result['context']}"
    )
    answer = llmio.complete(
        [{"role": "system", "content": _ASK_SYSTEM},
         {"role": "user", "content": user}],
        purpose="hermes-notebook.ask", max_tokens=4000, temperature=0.3,
    )
    return runtime.ok(
        notebook=nb_id, question=question, answer=answer,
        sources_used=result["sources_used"],
        chunks_used=result["chunks_used"], total_chunks=result["total_chunks"],
    )


def notebook_generate(args: dict, **kw) -> str:
    out = artifacts.generate(
        args.get("notebook") or "",
        args.get("kind") or "",
        focus=args.get("focus") or "",
        count_hint=args.get("count_hint") or "",
    )
    return runtime.ok(**out)


async def notebook_video(args: dict, **kw) -> str:
    out = await video.make_video_overview(
        args.get("notebook") or "",
        length=args.get("length") or None,
        focus=args.get("focus") or "",
    )
    return runtime.ok(**{k: v for k, v in out.items() if k != "ok"})


async def notebook_audio(args: dict, **kw) -> str:
    out = await audio.make_audio_overview(
        args.get("notebook") or "",
        length=args.get("length") or None,
        focus=args.get("focus") or "",
    )
    return runtime.ok(**{k: v for k, v in out.items() if k != "ok"})


_SUGGEST_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {"type": "array", "items": {"type": "string"},
                      "description": "5-8 questions the user is likely to want answered from these sources"},
        "artifacts": {"type": "array", "items": {"type": "string"},
                      "description": "3-5 artifact kinds worth generating (summary|briefing_doc|study_guide|faq|timeline|mind_map|flashcards|quiz) with a one-line reason each, formatted 'kind: reason'"},
        "gaps": {"type": "array", "items": {"type": "string"},
                 "description": "2-4 source gaps — what to add to make the notebook stronger"},
    },
    "required": ["questions", "artifacts", "gaps"],
}


def notebook_suggest(args: dict, **kw) -> str:
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    meta = store.get_meta(nb_id)
    sources = store.list_sources(nb_id)
    if not sources:
        return runtime.fail("notebook has no sources yet", notebook=nb_id)
    digest = retrieve.notebook_digest(nb_id, max_chars=30000)
    src_lines = "\n".join(
        f"- {s.get('title')} ({s.get('kind')})" +
        (f" — labels: {', '.join(s.get('labels') or [])}" if s.get("labels") else "")
        for s in sources
    )
    parsed = llmio.structured(
        instructions=(
            "Suggest what a user should DO with this notebook, NotebookLM-style. "
            "Questions should be specific to the actual content. Artifact "
            "suggestions pick from: summary, briefing_doc, study_guide, faq, "
            "timeline, mind_map, flashcards, quiz. Gaps name concrete missing "
            "sources/topics."
        ),
        input=[{"type": "text", "text":
                f"Notebook: {meta.get('title')} — {meta.get('description', '')}\n"
                f"Sources:\n{src_lines}\n\nContent digest:\n{digest}"}],
        json_schema=_SUGGEST_SCHEMA,
        schema_name="notebook.suggestions",
        purpose="hermes-notebook.suggest",
        max_tokens=1500, temperature=0.5,
    )
    if parsed is None:
        return runtime.fail("model did not return suggestions JSON", notebook=nb_id)
    return runtime.ok(notebook=nb_id, title=meta.get("title"), suggestions=parsed)


def notebook_delete(args: dict, **kw) -> str:
    if not args.get("confirm"):
        return runtime.fail(
            "deletion needs confirm=true — confirm with the user first",
            notebook=args.get("notebook"),
        )
    out = store.delete_notebook(args.get("notebook") or "")
    return runtime.ok(**out)


HANDLERS = {
    "notebook_list": notebook_list,
    "notebook_create": notebook_create,
    "notebook_add_source": notebook_add_source,
    "notebook_ask": notebook_ask,
    "notebook_generate": notebook_generate,
    "notebook_audio": notebook_audio,
    "notebook_video": notebook_video,
    "notebook_suggest": notebook_suggest,
    "notebook_delete": notebook_delete,
}
