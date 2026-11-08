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
STRUCT_KINDS = ("mind_map", "flashcards", "quiz", "slides", "infographic", "data_table")
ALL_KINDS = MD_KINDS + STRUCT_KINDS

KIND_LABEL = {
    "summary": "Summary",
    "briefing_doc": "Briefing Doc",
    "study_guide": "Study Guide",
    "faq": "FAQ",
    "timeline": "Timeline",
    "mind_map": "Mind Map",
    "flashcards": "Flashcards",
    "quiz": "Quiz",
    "slides": "Slide Deck",
    "infographic": "Infographic",
    "data_table": "Data Table",
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
    "slides": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "deck title"},
            "slides": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "slide headline (<= 10 words)"},
                    "bullets": {"type": "array", "items": {"type": "string"},
                                "description": "3-6 punchy bullets, each <= 18 words"},
                    "note": {"type": "string", "description": "optional speaker note"},
                },
                "required": ["title", "bullets"],
            }},
        },
        "required": ["title", "slides"],
    },
    "infographic": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "takeaway": {"type": "string", "description": "one-line bottom-line takeaway"},
            "stats": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "value": {"type": "string", "description": "big number/short stat, e.g. '1789' or '3x'"},
                    "label": {"type": "string", "description": "what the stat means (<= 8 words)"},
                    "detail": {"type": "string", "description": "optional one-line source-backed detail"},
                },
                "required": ["value", "label"],
            }, "description": "3-6 headline stats/facts from the sources"},
            "quotes": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "a striking fact or near-quote from the sources"},
                    "source": {"type": "string"},
                },
                "required": ["text"],
            }, "description": "2-4 key facts worth highlighting"},
        },
        "required": ["title", "stats", "quotes", "takeaway"],
    },
    "data_table": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "what the table compares or lists"},
            "columns": {"type": "array", "items": {"type": "string"},
                        "description": "3-8 short column headers"},
            "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}},
                     "description": "5-15 data rows; every cell a short string from the sources"},
        },
        "required": ["title", "columns", "rows"],
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
    "slides": (
        "Design a SLIDE DECK from these sources: 8-14 slides. First slide = title "
        "+ one-line framing; last slide = key takeaways. Middle slides each cover "
        "one idea with a punchy headline (<=10 words) and 3-6 bullets of <=18 "
        "words. Order for narrative flow. Every bullet must be grounded in the "
        "sources — this is a presentation, not an essay."
    ),
    "infographic": (
        "Design an INFOGRAPHIC's content from these sources: pick the 3-6 most "
        "striking stats/facts/dates (the 'value' should be the number or short "
        "fact itself, e.g. '1789', '70%', '3 treaties'), 2-4 quotable key facts, "
        "and a one-line takeaway. All grounded in the sources."
    ),
    "data_table": (
        "Build a DATA TABLE from these sources: pick the comparison the material "
        "most supports (entities × attributes, events × dates, options × tradeoffs). "
        "3-8 columns with short headers, 5-15 rows. Every cell must be a short "
        "verbatim-ish fact from the sources — no invented numbers, no empty cells "
        "unless the source genuinely lacks the value."
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


MAX_CONVERSATION_CHARS = 9000


def generate(notebook: str, kind: str, *, focus: str = "", count_hint: str = "",
             fmt: str = "md", style: str = "", options: Optional[dict] = None,
             conversation: str = "", language: str = "") -> dict:
    """Generate one artifact; returns {path, kind, preview} or raises.
    fmt='csv' switches flashcards to an Anki-importable CSV.
    style picks the look of the visual kinds — see `hermes_notebook.igstyles`
    for the bundled infographic pack (16 styles, four layout families)."""
    options = options if isinstance(options, dict) else {}
    kind = (kind or "").strip().lower().replace("-", "_").replace(" ", "_")
    style = (style or "").strip().lower()
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
    conv_text = (conversation or "").strip()
    if len(conv_text) > MAX_CONVERSATION_CHARS:
        conv_text = conv_text[:MAX_CONVERSATION_CHARS] + "\n[... conversation trimmed ...]"
    conv_line = (
        "\nThe user worked this request out in a conversation with the notebook. "
        "Use it as the brief: it decides the angle, the audience and what to "
        "emphasise. Facts still come only from the sources — anything the "
        "conversation asserts that no source supports is the user's own position "
        "and must be attributed to them, never restated as fact.\n"
        f"CONVERSATION SO FAR:\n{conv_text}\n"
    ) if conv_text else ""
    lang_line = (
        f"\nWRITE THE ENTIRE OUTPUT IN {language.strip()}. Translate the task, "
        "headings and all prose into that language; keep source titles, "
        "identifiers and quoted strings in their original form.\n"
    ) if language.strip() else ""

    if kind in MD_KINDS:
        messages = [
            {"role": "system", "content":
             "You are an expert research analyst producing a polished document "
             "strictly from the provided sources. Never invent facts; if "
             "something is uncertain, say so. Markdown output only."},
            {"role": "user", "content":
             f"Notebook: {meta.get('title')}\nDescription: {meta.get('description', '')}\n"
             f"Sources:\n{src_lines}\n{focus_line}{count_line}{conv_line}{lang_line}\n"
             f"Task: {_MD_PROMPTS[kind]}\n\nSources content:\n{digest}"},
        ]
        text = llmio.complete(
            messages, purpose=f"hermes-notebook.generate.{kind}",
            max_tokens=6000, temperature=0.4,
        )
        if not text:
            raise RuntimeError("model returned empty artifact")
        header = f"# {meta.get('title')} — {KIND_LABEL[kind]}\n\n"
        if meta.get("description"):
            header += f"_{meta['description']}_\n\n"
        header += f"_Generated {runtime.utc_stamp()} · {len(sources)} sources_\n\n---\n\n"
        path = _write_artifact(nb_id, kind, "md", header + text)
        return {"path": str(path), "kind": kind, "preview": text[:1200]}

    # structured kinds
    instructions = _STRUCT_INSTRUCTIONS[kind]
    style_spec = None
    if kind == "infographic":
        from .gfx import themes as _themes
        style_spec = _themes.resolve(style)
        # The content shape follows the look: a dashboard wants measurable metrics,
        # an editorial page wants headline numbers. Same sources, different picks.
        instructions += ("\n\nVisual treatment: " + style_spec.blurb + " "
                         + igstyles.prompt_hint(style_spec))
    parsed = llmio.structured(
        instructions=instructions,
        input=[{"type": "text", "text":
                f"Notebook: {meta.get('title')}\nSources:\n{src_lines}\n"
                f"{focus_line}{count_line}{conv_line}{lang_line}\nSources content:\n{digest}"}],
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

    json_path = _write_artifact(nb_id, kind, "json", json.dumps(parsed, indent=2, ensure_ascii=False))
    header = f"# {meta.get('title')} — {KIND_LABEL[kind]}\n\n"
    header += f"_Generated {runtime.utc_stamp()} · {len(sources)} sources_\n\n---\n\n"

    if kind == "slides":
        html = _render_slides_html(parsed, meta.get("title") or nb_id)
        path = _write_artifact(nb_id, kind, "html", html)
        return {"path": str(path), "kind": kind, "preview": html[:1200]}

    if kind == "infographic":
        assert style_spec is not None
        from . import gfx
        # The graphic is vector now: text stays text, so a numeral from the sources
        # can never be re-typeset by accident, and the file is a few KB.
        template = (fmt or "").strip().lower()
        if template not in gfx.TEMPLATES:
            template = "infographic"
        orientation = str(options.get("orientation") or "landscape").lower()
        detail = str(options.get("detail") or "standard").lower()
        parsed["_style"] = {"id": style_spec.id, "label": style_spec.label,
                            "family": style_spec.family}
        parsed["_graphic"] = {"template": template, "orientation": orientation,
                              "detail": detail}
        json_path = _write_artifact(nb_id, kind, "json",
                                    json.dumps(parsed, indent=2, ensure_ascii=False))
        svg = gfx.render(parsed, template=template, preset=style_spec.id,
                         orientation=orientation, detail=detail)
        path = _write_artifact(nb_id, kind, "svg", svg)
        return {"path": str(path), "json": str(json_path), "kind": kind,
                "style": style_spec.id, "style_label": style_spec.label,
                "template": template, "orientation": orientation, "detail": detail,
                "preview": json.dumps(parsed, ensure_ascii=False)[:1200]}

    if kind == "data_table":
        csv_text = _render_data_table_csv(parsed)
        path = _write_artifact(nb_id, kind, "csv", csv_text)
        # the markdown twin keeps the artifact readable without a table parser
        cols = [str(c) for c in (parsed.get("columns") or [])]
        md_rows = ["| " + " | ".join(cols) + " |",
                   "|" + "---|" * len(cols)]
        for row in (parsed.get("rows") or []):
            if isinstance(row, list):
                cells = [str(c) for c in row[:len(cols)]]
                cells += [""] * (len(cols) - len(cells))
                md_rows.append("| " + " | ".join(cells) + " |")
        md = "\n".join(md_rows) + "\n"
        _write_artifact(nb_id, kind, "md",
                        header + f"_{parsed.get('title') or 'Data table'}_\n\n" + md)
        return {"path": str(path), "json": str(json_path), "kind": kind,
                "format": "csv", "preview": csv_text[:1200]}

    if kind == "mind_map":
        md = _render_mind_map(parsed)
    elif kind == "flashcards" and fmt == "csv":
        csv_text = _render_flashcards_csv(parsed)
        path = _write_artifact(nb_id, kind, "csv", csv_text)
        return {"path": str(path), "json": str(json_path), "kind": kind,
                "format": "csv", "preview": csv_text[:1200]}
    elif kind == "flashcards":
        md = _render_flashcards(parsed)
    else:
        md = _render_quiz(parsed)
    path = _write_artifact(nb_id, kind, "md", header + md)
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


def _render_flashcards_csv(data: dict) -> str:
    """Anki-importable CSV: front,back,source (semicolon-safe quoting)."""
    import csv
    import io
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["front", "back", "source"])
    for c in data.get("cards") or []:
        if isinstance(c, dict):
            w.writerow([str(c.get("front", "")).strip(),
                        str(c.get("back", "")).strip(),
                        str(c.get("source", "")).strip()])
    return buf.getvalue()


def _render_data_table_csv(data: dict) -> str:
    """Rectangular CSV: every row padded/trimmed to the header width, properly
    quoted — opens clean in Sheets/Excel/Anki-style importers."""
    import csv
    import io
    cols = [str(c).strip() for c in (data.get("columns") or []) if str(c).strip()]
    if not cols:
        cols = ["column_1"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    n = len(cols)
    for row in (data.get("rows") or []):
        cells = [str(c).strip() for c in (row if isinstance(row, list) else [row])]
        cells = (cells + [""] * n)[:n]
        w.writerow(cells)
    return buf.getvalue()


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _render_slides_html(data: dict, deck_title: str) -> str:
    """Self-contained HTML slide deck — arrow keys / click / space to navigate."""
    slides = [s for s in (data.get("slides") or []) if isinstance(s, dict)]
    if not slides:
        slides = [{"title": data.get("title") or deck_title, "bullets": []}]
    cards = []
    for i, s in enumerate(slides):
        title = _esc(str(s.get("title") or f"Slide {i + 1}"))
        note = _esc(str(s.get("note") or ""))
        lis = "".join(f"<li>{_esc(str(b))}</li>" for b in (s.get("bullets") or [])[:8])
        cards.append(
            f'<section class="slide{" title-slide" if i == 0 else ""}">'
            f'<div class="num">{i + 1:02d} / {len(slides):02d}</div>'
            f'<h1>{title}</h1><ul>{lis}</ul>'
            + (f'<div class="note">{note}</div>' if note else "")
            + "</section>")
    title_esc = _esc(data.get("title") or deck_title)
    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>{title_esc} — slides</title>
<style>
body{{margin:0;background:#0b0b14;color:#f4f4fa;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;overflow:hidden}}
.slide{{display:none;height:100vh;flex-direction:column;justify-content:center;padding:7vh 9vw;box-sizing:border-box}}
.slide.on{{display:flex}}
h1{{font-size:clamp(2rem,4.5vw,3.6rem);margin:0 0 4vh;line-height:1.12;font-weight:800}}
.title-slide h1{{font-size:clamp(2.6rem,6vw,4.6rem)}}
ul{{list-style:none;padding:0;margin:0}}
li{{font-size:clamp(1.1rem,2vw,1.6rem);line-height:1.5;padding:.55em 0 .55em 1.6em;position:relative;color:#d8d8ea}}
li::before{{content:"";position:absolute;left:0;top:.95em;width:.7em;height:.7em;border-radius:50%;background:#8b6cff}}
.num{{position:absolute;top:3vh;right:4vw;font-size:.85rem;letter-spacing:.2em;color:#8b6cff;font-weight:600}}
.note{{margin-top:5vh;font-size:.95rem;color:#8a8aa5;font-style:italic}}
.hint{{position:fixed;bottom:2.5vh;width:100%;text-align:center;font-size:.8rem;color:#55556e;letter-spacing:.15em}}
.bar{{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#8b6cff,#ec945c);transition:width .3s}}
</style></head><body>
<div class="bar" id="bar"></div>
{''.join(cards)}
<div class="hint">← → or space to navigate · esc for overview</div>
<script>
let i=0;const s=document.querySelectorAll('.slide');
function show(n){{i=Math.max(0,Math.min(s.length-1,n));s.forEach((e,j)=>e.classList.toggle('on',j===i));
 document.getElementById('bar').style.width=((i+1)/s.length*100)+'%';}}
addEventListener('keydown',e=>{{if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){{show(i+1);e.preventDefault();}}
 else if(e.key==='ArrowLeft'||e.key==='PageUp'){{show(i-1);e.preventDefault();}}
 else if(e.key==='Home')show(0);else if(e.key==='End')show(s.length-1);}});
addEventListener('click',e=>{{e.clientX>innerWidth/2?show(i+1):show(i-1);}});
show(0);
</script></body></html>"""


def _render_infographic(data: dict, title: str, *, style: str = "",
                        template: str = "infographic", orientation: str = "landscape",
                        detail: str = "standard") -> str:
    """SVG source for an infographic, drawn by `hermes_notebook.gfx`.

    The vector library replaced the Pillow renderer here: same payload, same style
    catalog, but text stays text and the artifact weighs kilobytes. `igrender` is
    kept as the raster fallback for callers that need a PNG with no browser around.
    """
    from . import gfx
    payload = dict(data) if isinstance(data, dict) else {}
    payload.setdefault("title", title)
    return gfx.render(payload, template=template, preset=style, orientation=orientation,
                      detail=detail)


def _raster_infographic(data: dict, title: str, *, style: str = ""):
    """Pillow fallback: a PIL image of the same payload (no browser required)."""
    from . import igrender
    return igrender.render(data, title, style)


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
