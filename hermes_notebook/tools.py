"""Tool handlers — JSON envelope on every path, never a raise into the agent loop."""

from __future__ import annotations

import json
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


def notebook_add_source(args: dict, on_step=None, **kw) -> str:
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    rec = ingest.ingest(
        nb_id,
        path=args.get("path"),
        url=args.get("url"),
        text=args.get("text"),
        title=args.get("title"),
        on_step=on_step,
    )
    if isinstance(rec, dict) and rec.get("skipped") == "duplicate":
        dup = rec.get("duplicate_of") or {}
        return runtime.ok(
            notebook=nb_id, skipped="duplicate",
            duplicate_of=dup,
            hint="Identical content already in this notebook — nothing added.",
        )
    total = len(store.list_sources(nb_id))
    return runtime.ok(
        notebook=nb_id, source_id=rec["id"], title=rec["title"], kind=rec["kind"],
        origin=rec["origin"], chars=rec["chars"], labels=rec.get("labels", []),
        summary=rec.get("summary", ""), sources_in_notebook=total,
    )


def notebook_search(args: dict, **kw) -> str:
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    query = (args.get("query") or "").strip()
    if not query:
        raise ValueError("query is required")
    top_k = max(1, min(20, int(args.get("top_k") or 8)))
    out = retrieve.search(nb_id, query, top_k=top_k)
    if not out["hits"]:
        return runtime.ok(notebook=nb_id, query=query, hits=[],
                          hint="No matching passages — try different keywords or notebook_ask.")
    return runtime.ok(notebook=nb_id, **out)


def notebook_study(args: dict, **kw) -> str:
    """Spaced repetition over the notebook's own flashcards and quiz questions.

    action=queue (default) returns today's cards; action=review records a rating and
    returns the new schedule; action=stats reports mastery. The schedule lives in the
    notebook directory, so the page, the CLI and an agent all see the same memory.
    """
    from . import study as study_mod
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    action = (args.get("action") or "queue").strip().lower()
    if action == "review":
        card = (args.get("card") or "").strip()
        if not card:
            raise ValueError("card id is required for action=review")
        out = study_mod.review(nb_id, card, args.get("rating") or "good")
        return runtime.ok(notebook=nb_id, **out)
    if action == "stats":
        return runtime.ok(**study_mod.stats(nb_id))
    limit = max(1, min(60, int(args.get("limit") or 12)))
    return runtime.ok(notebook=nb_id, queue=study_mod.queue(nb_id, limit),
                      stats=study_mod.stats(nb_id))


def notebook_note(args: dict, **kw) -> str:
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    rec = ingest.add_note(nb_id, args.get("text") or "", args.get("title") or None)
    if isinstance(rec, dict) and rec.get("skipped") == "duplicate":
        return runtime.ok(notebook=nb_id, skipped="duplicate",
                          duplicate_of=rec.get("duplicate_of"))
    return runtime.ok(
        notebook=nb_id, source_id=rec["id"], title=rec["title"], kind="note",
        chars=rec["chars"], note="Stored as a searchable source — ask/search/generate see it.",
    )


def notebook_refresh(args: dict, **kw) -> str:
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    rec = ingest.refresh_source(nb_id, args.get("source_id") or "")
    return runtime.ok(
        notebook=nb_id, source_id=rec["id"], title=rec.get("title"),
        kind=rec.get("kind"), chars=rec.get("chars"),
        chars_delta=rec.get("chars_delta"), labels=rec.get("labels", []),
        summary=rec.get("summary", ""), refreshed_at=rec.get("refreshed_at"),
    )


def notebook_delete_source(args: dict, **kw) -> str:
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    out = store.remove_source(nb_id, args.get("source_id") or "")
    return runtime.ok(notebook=nb_id, **out)


def notebook_update(args: dict, **kw) -> str:
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    meta = store.update_meta(
        nb_id,
        title=args.get("title") if args.get("title") is not None else None,
        description=args.get("description") if args.get("description") is not None else None,
    )
    return runtime.ok(notebook=meta["id"], title=meta["title"],
                      description=meta.get("description", ""))


def notebook_export(args: dict, **kw) -> str:
    out = store.export_notebook(args.get("notebook") or "")
    return runtime.ok(**out)


def notebook_discover(args: dict, **kw) -> str:
    if args.get("deep"):
        # Deep Research: plan → fan out → read the results → ask different
        # questions → merge and re-rank. Same candidates shape as the one-shot
        # pass, plus `gaps` and the queries it used.
        from . import discover as discover_mod
        nb_id = store.resolve_notebook(args.get("notebook") or "")
        out = discover_mod.discover(
            nb_id,
            query=str(args.get("query") or ""),
            max_results=max(4, min(20, int(args.get("max_results") or 10))),
            deep=True,
            rounds=int(args["rounds"]) if str(args.get("rounds") or "").isdigit() else None,
        )
        payload = dict(
            notebook=nb_id, query=out["query"], candidates=out["candidates"],
            gaps=out["gaps"], queries=out["queries"], rounds=out["rounds"],
            searched=out["searched"],
            hint="Add one with notebook_add_source url=<url> — nothing was added automatically.")
        if out.get("warning"):
            payload["warning"] = out["warning"]
        return runtime.ok(**payload)
    nb_id = store.resolve_notebook(args.get("notebook") or "")
    meta = store.get_meta(nb_id)
    query = (args.get("query") or "").strip() or (
        f"{meta.get('title', '')} {meta.get('description', '')}".strip())
    if not query:
        raise ValueError("no query and notebook has no title/description")
    limit = max(1, min(10, int(args.get("max_results") or 6)))
    raw = runtime.dispatch("web_search", {"query": query, "limit": limit})
    if runtime.unknown_tool(raw, "web_search"):
        raise RuntimeError(
            "web search is unavailable in this session: the host's web_search "
            "tool is not registered — run discover from a chat turn or the desktop page")
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except (ValueError, TypeError):
        raise RuntimeError(f"web_search returned non-JSON: {str(raw)[:200]}")
    if not isinstance(data, dict):
        raise RuntimeError("web_search returned unexpected payload")
    if data.get("success") is False:
        raise RuntimeError(f"web_search failed: {data.get('error') or 'unknown error'}")
    # web_search shape: {"success": true, "data": {"web": [{title,url,description,position}]}}
    inner = data.get("data") if isinstance(data.get("data"), dict) else data
    results = inner.get("web") or inner.get("results") or []
    if not isinstance(results, list):
        results = []
    # drop urls already in the notebook
    existing = {s.get("origin") for s in store.list_sources(nb_id)}
    cands = []
    for r in results[:limit]:
        if not isinstance(r, dict):
            continue
        url = str(r.get("url") or r.get("link") or "")
        if not url or url in existing:
            continue
        cands.append({
            "title": str(r.get("title") or url)[:200],
            "url": url,
            "snippet": str(r.get("description") or r.get("snippet") or "")[:400],
        })
    return runtime.ok(
        notebook=nb_id, query=query, candidates=cands,
        hint="Add a candidate with notebook_add_source url=<url> — nothing was added automatically.",
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


_ASK_LENGTH_TOKENS = {"short": 1500, "medium": 4000, "long": 7000}

_ASK_STYLES = {
    "learning_guide": (
        "- Teach, don't just answer: define each key term the first time it "
        "appears, use a concrete example from the sources, and end with 2-3 "
        "'Check your understanding' questions.\n"
    ),
}


def _ask_system(nb_id: str) -> tuple[str, int]:
    """Per-notebook chat options (notebook.json → options.chat_*): style adds a
    stance to the system prompt; length sets the answer's token budget."""
    try:
        opts = (store.get_meta(nb_id).get("options") or {})
    except Exception:
        opts = {}
    style = str(opts.get("chat_style") or "default")
    length = str(opts.get("chat_length") or "medium")
    system = _ASK_SYSTEM
    if style == "custom":
        custom = str(opts.get("chat_custom") or "").strip()
        if custom:
            system += ("\n- Additional instructions from the notebook owner "
                       f"(follow these unless they conflict with grounding): {custom}")
    else:
        system += _ASK_STYLES.get(style, "")
    tokens = _ASK_LENGTH_TOKENS.get(length, _ASK_LENGTH_TOKENS["medium"])
    return system, tokens


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
        f"Notebook sources (each <source id=\"S1\">…</source> block is tagged "
        f"[S1]…[Sn] for citation):\n\n{result['context']}"
    )
    # optional chat thread — prior exchanges ride along as context
    thread_name = (args.get("thread") or "").strip() or None
    if thread_name and args.get("retry"):
        # regenerate the last exchange rather than growing the thread
        store.pop_thread_exchange(nb_id, thread_name)
    system_prompt, max_tokens = _ask_system(nb_id)
    messages = [{"role": "system", "content": system_prompt}]
    if thread_name:
        history = store.get_thread(nb_id, thread_name)[-12:]
        for m in history:
            if m.get("role") in {"user", "assistant"} and m.get("content"):
                messages.append({"role": m["role"], "content": str(m["content"])[:4000]})
        messages.append({"role": "user", "content": user})
    else:
        messages += [{"role": "user", "content": user}]
    usage: list = []
    answer = llmio.complete(
        messages,
        purpose="hermes-notebook.ask", max_tokens=max_tokens, temperature=0.3,
        usage_out=usage,
    )
    if thread_name:
        store.append_thread(nb_id, thread_name, "user", question)
        # persist the citation rows so reloaded threads keep chips, hover
        # passages and click-to-source — same shape /ask returns live
        cites = [{
            "n": src.get("n", i), "title": src.get("title") or "source",
            "kind": src.get("kind", ""), "origin": src.get("origin", ""),
            "id": src.get("id", ""), "snippet": src.get("snippet", ""),
        } for i, src in enumerate(
            retrieve.cited_sources(result["sources_used"], answer), 1)]
        store.append_thread(nb_id, thread_name, "assistant", answer,
                            extra={"citations": cites} if cites else None)
    u = usage[0] if usage else None
    tokens = 0
    if u is not None:
        tokens = int(getattr(u, "total_tokens", 0) or 0) or int(
            getattr(u, "input_tokens", 0) or 0) + int(getattr(u, "output_tokens", 0) or 0)
    return runtime.ok(
        notebook=nb_id, question=question, answer=answer,
        thread=thread_name,
        sources_used=result["sources_used"],
        chunks_used=result["chunks_used"], total_chunks=result["total_chunks"],
        context_chars=len(result["context"]),
        tokens=tokens or None,
    )


def notebook_generate(args: dict, **kw) -> str:
    """Generate one artifact. `thread=<name>` turns that conversation into the
    brief (NotebookLM's "turn this chat into a deck"); `language` localises the
    output. Both are optional and never override source grounding."""
    thread = str(args.get("thread") or "").strip()
    conversation = ""
    if thread:
        conversation = store.thread_as_brief(
            store.resolve_notebook(args.get("notebook") or ""), thread)
    out = artifacts.generate(
        args.get("notebook") or "",
        args.get("kind") or "",
        focus=args.get("focus") or "",
        count_hint=args.get("count_hint") or "",
        # `format` is the flashcards csv switch; `template` is the graphic layout
        fmt=args.get("format") or (args.get("template") if args.get("kind") == "infographic" else "") or "md",
        style=args.get("style") or "",
        conversation=conversation,
        language=args.get("language") or "",
        options={"orientation": args.get("orientation") or "landscape",
                 "detail": args.get("detail") or "standard"},
    )
    return runtime.ok(**out)


def notebook_threads(args: dict, **kw) -> str:
    """Conversations inside one notebook: list, start, rename, delete.

    A notebook is usually several lines of enquiry at once; each thread keeps its
    own memory, so an answer in "pricing" is not polluted by "history".
    """
    action = str(args.get("action") or "list").strip().lower()
    nb = store.resolve_notebook(args.get("notebook") or "")
    if action == "list":
        rows = store.list_threads(nb)
        return runtime.ok(notebook=nb, threads=rows, count=len(rows),
                          default=rows[0]["name"] if rows else "")
    if action == "new":
        created = store.create_thread(nb, title=str(args.get("title") or ""),
                                      name=str(args.get("name") or ""))
        return runtime.ok(notebook=nb, thread=created, threads=store.list_threads(nb))
    if action == "rename":
        name = str(args.get("thread") or "").strip()
        if not name:
            raise ValueError("rename needs the thread name")
        out = store.rename_thread(nb, name, str(args.get("title") or ""))
        return runtime.ok(notebook=nb, thread=out, threads=store.list_threads(nb))
    if action == "delete":
        name = str(args.get("thread") or "").strip()
        if not name:
            raise ValueError("delete needs the thread name")
        if not args.get("confirm"):
            raise ValueError("deleting a conversation is destructive — pass confirm=true")
        out = store.delete_thread(nb, name)
        return runtime.ok(notebook=nb, **out, threads=store.list_threads(nb))
    raise ValueError(f"unknown action {action!r} — list, new, rename or delete")


async def notebook_video(args: dict, **kw) -> str:
    out = await video.make_video_overview(
        args.get("notebook") or "",
        length=args.get("length") or None,
        focus=args.get("focus") or "",
        style=args.get("style") or None,
        language=args.get("language") or "",
    )
    return runtime.ok(**{k: v for k, v in out.items() if k != "ok"})


async def notebook_audio(args: dict, **kw) -> str:
    out = await audio.make_audio_overview(
        args.get("notebook") or "",
        length=args.get("length") or None,
        focus=args.get("focus") or "",
        fmt=args.get("format") or "deep_dive",
        language=args.get("language") or "",
    )
    return runtime.ok(**{k: v for k, v in out.items() if k != "ok"})


_SUGGEST_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {"type": "array", "items": {"type": "string"},
                      "description": "5-8 questions the user is likely to want answered from these sources"},
        "artifacts": {"type": "array", "items": {"type": "string"},
                      "description": "3-5 artifact kinds worth generating (video_overview|audio_overview|summary|briefing_doc|study_guide|faq|timeline|mind_map|flashcards|quiz|slides|infographic|data_table) with a one-line reason each, formatted 'kind: reason'"},
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
            "suggestions pick from: video_overview, audio_overview, summary, "
            "briefing_doc, study_guide, faq, timeline, mind_map, flashcards, "
            "quiz, slides, infographic, data_table. Gaps name concrete missing "
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


def notebook_tensions(args: dict, **kw) -> str:
    """Where the sources disagree, and how independent they really are."""
    from . import tensions as tensions_mod
    out = tensions_mod.analyze(
        args.get("notebook") or "",
        max_items=max(1, min(10, int(args.get("max_items") or 6))),
        language=str(args.get("language") or ""),
    )
    return runtime.ok(**{k: v for k, v in out.items() if k != "ok"})

HANDLERS = {
    "notebook_list": notebook_list,
    "notebook_create": notebook_create,
    "notebook_add_source": notebook_add_source,
    "notebook_ask": notebook_ask,
    "notebook_generate": notebook_generate,
    "notebook_audio": notebook_audio,
    "notebook_threads": notebook_threads,
    "notebook_video": notebook_video,
    "notebook_suggest": notebook_suggest,
    "notebook_search": notebook_search,
    "notebook_study": notebook_study,
    "notebook_note": notebook_note,
    "notebook_refresh": notebook_refresh,
    "notebook_delete_source": notebook_delete_source,
    "notebook_update": notebook_update,
    "notebook_export": notebook_export,
    "notebook_discover": notebook_discover,
    "notebook_delete": notebook_delete,
    "notebook_tensions": notebook_tensions,
}
