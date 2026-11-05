"""Artifact generation — the NotebookLM "click to create" outputs.

Markdown kinds go through ctx.llm.complete with per-kind prompts; structured
kinds (mind_map, flashcards, quiz) go through complete_structured with a JSON
schema, then render to Markdown + keep the raw JSON beside it.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from . import llmio, retrieve, runtime, store

MD_KINDS = ("summary", "briefing_doc", "study_guide", "faq", "timeline")
STRUCT_KINDS = ("mind_map", "flashcards", "quiz")
ALL_KINDS = MD_KINDS + STRUCT_KINDS

_KIND_LABEL = {
    "summary": "Summary",
    "briefing_doc": "Briefing Doc",
    "study_guide": "Study Guide",
    "faq": "FAQ",
    "timeline": "Timeline",
    "mind_map": "Mind Map",
    "flashcards": "Flashcards",
    "quiz": "Quiz",
}

_MD_PROMPTS = {
    "summary": (
        "Write a concise SUMMARY of this notebook's sources. Structure: a 2-3 "
        "sentence overview, then 'Key points' bullets (5-10), then 'Notable "
        "details' bullets. Attribute claims to sources by name in brackets like "
        "[Source title]. Plain markdown, no preamble."
    ),
    "briefing_doc": (
        "Write a detailed BRIEFING DOC from these sources. Sections: Context & "
        "background, Key facts, Developments & details, Implications & "
        "takeaways, Open questions. Use headings, bullets and short paragraphs. "
        "Cite source names in brackets. This should read like a polished analyst "
        "brief — thorough but skimmable."
    ),
    "study_guide": (
        "Write a STUDY GUIDE from these sources, organized for learning: "
        "Learning objectives, Core concepts (each with a plain-language "
        "explanation + example from the sources), Key terms glossary, Practice "
        "questions (with answers in a collapsed-style 'Answer:' line), and a "
        "'Remember' recap. Markdown."
    ),
    "faq": (
        "Write an FAQ document: the 10-15 questions a reader would most likely "
        "ask about this material, each answered accurately from the sources in "
        "2-5 sentences. Format: '## Q: ...' then the answer. Ground every "
        "answer in the sources; if the sources can't answer a natural question, "
        "skip it."
    ),
    "timeline": (
        "Write a TIMELINE of the events, periods, developments or steps covered "
        "by these sources, in chronological order. Format: '## <date/period>' "
        "then 1-3 bullets of what happened and which source covers it. If the "
        "material isn't chronological, organize it as a logical progression "
        "instead and title the doc accordingly."
    ),
}

_STRUCT_SCHEMAS = {
    "mind_map": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "children": {"type": "array", "items": {"$ref": "#/$defs/node"}},
        },
        "required": ["title", "children"],
        "$defs": {
            "node": {
                "type": "object",
                "properties": {
                    "label": {"type": "string", "description": "short node label (<= 8 words)"},
                    "detail": {"type": "string", "description": "optional one-line detail"},
                    "children": {"type": "array", "items": {"$ref": "#/$defs/node"}},
                },
                "required": ["label"],
            }
        },
    },
    "flashcards": {
        "type": "object",
        "properties": {
            "cards": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "front": {"type": "string", "description": "question or prompt"},
                    "back": {"type": "string", "description": "concise answer from the sources"},
                    "source": {"type": "string", "description": "source title it came from"},
                },
                "required": ["front", "back"],
            }},
        },
        "required": ["cards"],
    },
    "quiz": {
        "type": "object",
        "properties": {
            "questions": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "choices": {"type": "array", "items": {"type": "string"},
                                "description": "optional 4 options for multiple-choice"},
                    "answer": {"type": "string", "description": "correct answer (option letter or text)"},
                    "explanation": {"type": "string"},
                },
                "required": ["question", "answer"],
            }},
        },
        "required": ["questions"],
    },
}

_STRUCT_INSTRUCTIONS = {
    "mind_map": (
        "Build a MIND MAP of this material as a nested JSON tree. The root is the "
        "notebook's central topic; branches are major themes; leaves are specific "
        "facts/concepts. 3 levels deep max, 15-40 nodes total. Labels <= 8 words."
    ),
    "flashcards": (
        "Create STUDY FLASHCARDS from these sources: 12-20 cards. Front = a "
        "question or 'what/why/how' prompt; back = a concise answer (1-3 "
        "sentences) grounded in the sources. Include the source title when a "
        "card is source-specific."
    ),
    "quiz": (
        "Create a PRACTICE QUIZ from these sources: 8-12 questions. Mix formats — "
        "some multiple-choice (4 choices), some short-answer. Every answer must "
        "be verifiable from the sources; include a one-line explanation."
    ),
}


def _meta(notebook_id: str) -> dict:
    return store.get_meta(notebook_id)


def _digest(notebook_id: str) -> str:
    budget = int(runtime.config("podcast_context_chars", default=42000))
    return retrieve.notebook_digest(notebook_id, max_chars=budget)


def _write_artifact(notebook_id: str, kind: str, ext: str, content: str) -> Path:
    nb_id = store.resolve_notebook(notebook_id)
    d = store._nb_dir(nb_id) / "artifacts"
    d.mkdir(parents=True, exist_ok=True)
    path = d / f"{runtime.utc_stamp()}-{kind}.{ext}"
    path.write_text(content, encoding="utf-8")
    store.touch(nb_id)
    return path


def generate(notebook: str, kind: str, *, focus: str = "", count_hint: str = "") -> dict:
    """Generate one artifact; returns {path, kind, preview} or raises."""
    kind = (kind or "").strip().lower().replace("-", "_").replace(" ", "_")
    if kind not in ALL_KINDS:
        raise ValueError(
            f"unknown artifact kind {kind!r} — one of: {', '.join(ALL_KINDS)}"
        )
    nb_id = store.resolve_notebook(notebook)
    meta = _meta(nb_id)
    sources = store.list_sources(nb_id)
    if not sources:
        raise ValueError(f"notebook {nb_id!r} has no sources — add some first")

    digest = _digest(nb_id)
    src_lines = "\n".join(
        f"- {s.get('title')} ({s.get('kind')})" + (f" — {s.get('origin')}" if s.get('origin') and s.get('kind') in {'url', 'youtube'} else "")
        for s in sources
    )
    focus_line = f"\nFocus/topic requested by the user: {focus.strip()}\n" if focus.strip() else ""
    count_line = f"\nRequested amount: {count_hint.strip()}\n" if count_hint.strip() else ""

    if kind in MD_KINDS:
        messages = [
            {"role": "system", "content":
             "You are an expert research analyst producing a polished document "
             "strictly from the provided sources. Never invent facts; if "
             "something is uncertain, say so. Markdown output only."},
            {"role": "user", "content":
             f"Notebook: {meta.get('title')}\nDescription: {meta.get('description', '')}\n"
             f"Sources:\n{src_lines}\n{focus_line}{count_line}\n"
             f"Task: {_MD_PROMPTS[kind]}\n\nSources content:\n{digest}"},
        ]
        text = llmio.complete(
            messages, purpose=f"hermes-notebook.generate.{kind}",
            max_tokens=6000, temperature=0.4,
        )
        if not text:
            raise RuntimeError("model returned empty artifact")
        header = f"# {meta.get('title')} — {_KIND_LABEL[kind]}\n\n"
        if meta.get("description"):
            header += f"_{meta['description']}_\n\n"
        header += f"_Generated {runtime.utc_stamp()} · {len(sources)} sources_\n\n---\n\n"
        path = _write_artifact(nb_id, kind, "md", header + text)
        return {"path": str(path), "kind": kind, "preview": text[:1200]}

    # structured kinds
    parsed = llmio.structured(
        instructions=_STRUCT_INSTRUCTIONS[kind],
        input=[{"type": "text", "text":
                f"Notebook: {meta.get('title')}\nSources:\n{src_lines}\n"
                f"{focus_line}{count_line}\nSources content:\n{digest}"}],
        json_schema=_STRUCT_SCHEMAS[kind],
        schema_name=f"notebook.{kind}",
        system_prompt=(
            "You produce structured study material strictly from the provided "
            "sources. Every item must be grounded in them."
        ),
        purpose=f"hermes-notebook.generate.{kind}",
        max_tokens=8000, temperature=0.3,
    )
    if parsed is None:
        raise RuntimeError("model did not return valid JSON for this artifact")

    if kind == "mind_map":
        md = _render_mind_map(parsed)
    elif kind == "flashcards":
        md = _render_flashcards(parsed)
    else:
        md = _render_quiz(parsed)
    header = f"# {meta.get('title')} — {_KIND_LABEL[kind]}\n\n"
    header += f"_Generated {runtime.utc_stamp()} · {len(sources)} sources_\n\n---\n\n"
    path = _write_artifact(nb_id, kind, "md", header + md)
    json_path = _write_artifact(nb_id, kind, "json", json.dumps(parsed, indent=2, ensure_ascii=False))
    return {"path": str(path), "json": str(json_path), "kind": kind, "preview": md[:1200]}


# ------------------------------------------------------------- renderers

def _render_mind_map(data: dict) -> str:
    lines = [f"## {data.get('title') or 'Mind Map'}", ""]

    def walk(node: dict, depth: int):
        label = str(node.get("label", "")).strip() or "(untitled)"
        detail = str(node.get("detail") or "").strip()
        prefix = "  " * depth + ("- " if depth else "- ")
        lines.append(prefix + label + (f" — {detail}" if detail else ""))
        for child in (node.get("children") or [])[:30]:
            if isinstance(child, dict):
                walk(child, depth + 1)

    for child in (data.get("children") or [])[:40]:
        if isinstance(child, dict):
            walk(child, 0)
    lines += ["", "```mermaid", "mindmap", f"  root(({data.get('title') or 'Notebook'}))"]
    def mermaid(node: dict, parent: str, counter: list[int]):
        counter[0] += 1
        nid = f"n{counter[0]}"
        label = str(node.get("label", "")).strip()[:40].replace('"', "'")
        lines.append(f"    {parent} --> {nid}({label})")
        for c in (node.get("children") or [])[:20]:
            if isinstance(c, dict):
                mermaid(c, nid, counter)
    counter = [0]
    for child in (data.get("children") or [])[:30]:
        if isinstance(child, dict):
            mermaid(child, "root", counter)
    lines.append("```")
    return "\n".join(lines)


def _render_flashcards(data: dict) -> str:
    cards = data.get("cards") or []
    lines = [f"_{len(cards)} cards_"]
    for i, c in enumerate(cards, 1):
        if not isinstance(c, dict):
            continue
        front = str(c.get("front", "")).strip()
        back = str(c.get("back", "")).strip()
        src = str(c.get("source") or "").strip()
        lines += ["", f"**Card {i}**" + (f" · _{src}_" if src else ""), "", f"**Q:** {front}", "", f"**A:** {back}"]
    return "\n".join(lines)


def _render_quiz(data: dict) -> str:
    questions = data.get("questions") or []
    lines = [f"_{len(questions)} questions_"]
    for i, q in enumerate(questions, 1):
        if not isinstance(q, dict):
            continue
        lines += ["", f"### Q{i}. {q.get('question', '')}"]
        for j, choice in enumerate(q.get("choices") or []):
            lines.append(f"{chr(65 + j)}. {choice}")
        lines += ["", f"**Answer:** {q.get('answer', '')}"]
        if q.get("explanation"):
            lines.append(f"_{q['explanation']}_")
    return "\n".join(lines)
