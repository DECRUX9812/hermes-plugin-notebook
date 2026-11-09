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
STRUCT_KINDS = ("mind_map", "flashcards", "quiz", "slides", "infographic", "data_table",
                # a five-zone engineering poster is its own artifact, not an
                # infographic with a different template: it has its own schema,
                # its own label and its own viewer expectations
                "blueprint_evolution")
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
    "blueprint_evolution": "Architecture Blueprint",
}

from . import artifact_prompts as prompts

#: The per-kind instructions and schemas live in `artifact_prompts` now — one
#: registry that states the shape of every output (citation contract, tension
#: ledger, KPI strip, slide archetypes, node/edge graph). This module keeps the
#: short aliases the rest of the plugin and the preview harness read.
_PROMPTS = prompts.INSTRUCTIONS
_STRUCT_INSTRUCTIONS = {k: prompts.build_instructions(k, mode="struct")
                        for k in STRUCT_KINDS}
_STRUCT_SCHEMAS = {k: prompts.SCHEMAS[k] for k in STRUCT_KINDS}


def _ledger_for(nb_id: str, language: str = "") -> dict:
    """The tension audit for this notebook, cached per source-state.

    Every artifact gets the same ledger, so a notebook's ten outputs cost one
    audit rather than ten. A failed audit degrades to the measured independence
    alone — an artifact with fewer conflict notes still beats no artifact."""
    try:
        return prompts.tensions_brief(nb_id, language=language)
    except Exception as exc:  # noqa: BLE001 - never fail a generation over an audit
        logger.warning("tension ledger unavailable: %s", exc)
        return {"text": "", "items": [], "independence": {}, "degraded": str(exc)}


def _meta(notebook_id: str) -> dict:
    return store.get_meta(notebook_id)


def _tension_brief(notebook_id: str) -> str:
    """The measured tension audit, formatted for the blueprint prompt.

    Deterministic half only (independence + the conflicts already computed on
    demand): the model must not be asked to audit its own evidence in the same
    call that consumes it. When there is nothing to report, the string is empty
    and the prompt is unchanged.
    """
    try:
        from . import tensions as tensions_mod
        indep = tensions_mod.independence(notebook_id)
    except Exception:
        return ""
    if not indep or not indep.get("sources"):
        return ""
    bits = [f"\nINDEPENDENCE AUDIT (measured from the text, not asked of you): "
            f"{indep['sources']} active sources, {indep.get('independent')} independent."]
    clusters = indep.get("clusters") or []
    for c in clusters[:3]:
        members = ", ".join(f"S{m}" for m in c.get("members") or [])
        bits.append(f"  {members} repeat the same opening text — treat their agreement as ONE voice.")
    known = ""
    try:
        from . import retrieve
        known = retrieve.notebook_digest(notebook_id, max_chars=6000)
    except Exception:
        known = ""
    if clusters and known:
        bits.append("  So a claim carried only by a cluster is weakly corroborated: "
                    "mark it as a gap rather than a target.")
    return "\n".join(bits) + "\n"


#: The image-generation route, as the plugin reaches it: Hermes' own
#: `image_generate` tool through the context dispatcher. Nothing is called
#: directly (the agent's modules are not importable from a plugin process) and
#: nothing is assumed about which backend answers.
IMAGE_TOOL = "image_generate"


def image_mode_available() -> bool:
    """Is there an image backend behind `image_generate` right now?

    Deliberately conservative and CHEAP. There is no probe endpoint that answers
    this without generating an image, and paying for a render just to light up a
    toggle would be a bug, so this reads the two things the host's own gate
    reads:

    * `image_gen.provider` in the host config (``nous`` / ``fal`` / a plugin), and
    * an API key in the environment for that provider.

    A False here is a hint, not a promise — `_image_blueprint` still attempts the
    dispatch and falls back to the vector engine if the host disagrees. Being
    wrong toward False only leaves the hand-drawn poster, which is the default
    anyway.
    """
    import os
    from pathlib import Path

    provider = ""
    for candidate in (Path.home() / ".hermes-webapp" / "config.yaml",
                      Path.home() / ".hermes" / "config.yaml"):
        try:
            text = candidate.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        block = text.split("image_gen:", 1)
        if len(block) < 2:
            continue
        for line in block[1].splitlines()[:6]:
            stripped = line.strip()
            if stripped.startswith("provider:"):
                provider = stripped.split(":", 1)[1].strip().strip("'\"") or provider
                break
        break
    if not provider:
        return False
    keys = ("FAL_KEY", "FAL_API_KEY", "OPENAI_API_KEY", "KREA_API_KEY", "NOUS_API_KEY")
    if any(os.getenv(k) for k in keys):
        return True
    # a managed host backend (provider: nous) bills through the gateway, not a
    # key in this process, so a configured provider is enough to try
    return provider in ("nous", "fal")


def _image_blueprint(parsed: Dict[str, Any], style_id: str,
                     notebook_id: str = "") -> Optional[str]:
    """Render a blueprint poster through the image model instead of the vector engine.

    Deterministic SVG is the default and stays the default: it is crisp at any
    size, a few KB, and its text cannot be hallucinated by a diffusion step.
    This path exists because a painted poster is a different product, and it is
    offered as an opt-in the caller must ask for.

    Returns the artefact path, or None when the backend refused — the caller
    then falls back to the vector render rather than failing the run.
    """
    prompt = _blueprint_image_prompt(parsed, style_id)
    try:
        from . import runtime
        raw = runtime.dispatch(IMAGE_TOOL, {"prompt": prompt, "aspect_ratio": "4:3"})
    except Exception:
        return None
    try:
        import json
        data = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return None
    if not isinstance(data, dict) or not data.get("success"):
        return None
    image = data.get("agent_visible_image") or data.get("image")
    if not image:
        return None
    image = str(image)
    # The backend hands back a CDN URL or a temp path. Neither survives: a URL
    # expires and a temp file is cleaned up, so the artifact would open as a
    # broken image tomorrow. Copy it into the notebook's artifacts directory and
    # return the local path, which is what every other writer here returns.
    try:
        return str(_keep_local_image(notebook_id, image))
    except Exception:
        return image


def _blueprint_image_prompt(parsed: Dict[str, Any], style_id: str) -> str:
    """The Master Blueprint Prompt: the structured JSON, restated as art direction.

    The poster's content is passed as an already-decided plan, not as a question:
    a diffusion model given fields to invent will invent them, and an invention
    in a technical poster is worse than a gap.
    """
    title = str(parsed.get("title") or "Architecture blueprint")
    sub = str(parsed.get("subtitle") or "").strip()
    gaps = [f"{g.get('title')}: {g.get('spec')}" for g in parsed.get("current_gaps") or []
            if isinstance(g, dict)]
    pillars = [f"{p.get('title')}: {p.get('concise_spec')}"
               for p in parsed.get("core_pillars") or [] if isinstance(p, dict)]
    matrix = [f"{m.get('domain')}: {m.get('before_label')} -> {m.get('after_label')}"
              for m in parsed.get("evolution_matrix") or [] if isinstance(m, dict)]
    lines = [
        f"Executive engineering poster, landscape 4:3, high-density technical "
        f"illustration. Title: {title}."]
    if sub:
        lines.append(f"Subtitle: {sub}.")
    lines += [
        "Left column: five stacked muted slate cards headed CURRENT GAPS, each with "
        "a small isometric wireframe icon: " + "; ".join(gaps) + ".",
        "Centre: a white comparison table card, rows domain, before -> after, with "
        "sankey ribbons passing behind it: " + "; ".join(matrix) + ".",
        "Right column: five pill-shaped colour-coded pillars in amber, purple, cyan, "
        "coral and emerald, each with a dark technical diagram pane: "
        + "; ".join(pillars) + ".",
        "Bottom: a progressive scale ladder on the left and a 2x2 validation bench "
        "grid on the right.",
        "Strict left-to-right saturation gradient: desaturated cool greys on the left, "
        "high-saturation functional colour on the right. Off-white background "
        "#F8FAFC, Inter typography, mathematically aligned grid, vector-crisp "
        "micro-labels, no photographic elements, no decorative flourishes, no "
        "invented numbers - only the text listed above.",
    ]
    return "\n".join(lines)


def _digest(notebook_id: str) -> str:
    budget = int(runtime.config("podcast_context_chars", default=42000))
    return retrieve.notebook_digest(notebook_id, max_chars=budget)


def _keep_local_image(notebook_id: str, image: str) -> "Any":
    """Copy a generated image into the notebook's artifacts dir, keep its bytes.

    A remote URL or a temp path is not an artifact. This downloads with the
    plugin's own HTTP client (no model call, no new dependency) and writes the
    same stamped filename the other writers use, so the image is discoverable by
    the artifact list, exportable, and still there next week.
    """
    import shutil
    from pathlib import Path

    nb_id = store.resolve_notebook(notebook_id)
    d = store._nb_dir(nb_id) / "artifacts"
    d.mkdir(parents=True, exist_ok=True)
    dest = d / f"{runtime.utc_stamp()}-blueprint_evolution.png"

    src = Path(image)
    if src.exists():
        shutil.copyfile(src, dest)
    else:
        import urllib.request
        req = urllib.request.Request(image, headers={"User-Agent": "hermes-notebook"})
        with urllib.request.urlopen(req, timeout=60) as response:  # noqa: S310
            data = response.read()
        if not data:
            raise RuntimeError("the image backend returned an empty body")
        dest.write_bytes(data)
    store.touch(nb_id)
    return dest


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
             f"Task: {prompts.BRIEFS[kind]}\n\nSources content:\n{digest}"},
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
    if kind in ("infographic", "blueprint_evolution"):
        from .gfx import themes as _themes
        # `igstyles.prompt_hint` was dropped by the gfx rewrite (4850aa0) but the
        # call was left behind, so every infographic generation raised NameError
        # at the model call — a 500 the tests never reached because they render
        # the library directly instead of generating through this path.
        from . import igstyles  # noqa: F401  (module is still the style source)
        style_spec = _themes.resolve(style)
        # The content shape follows the look: a dashboard wants measurable metrics,
        # an editorial page wants headline numbers. Same sources, different picks.
        hint = ""
        try:
            hint = " " + igstyles.prompt_hint(style_spec)
        except Exception:
            hint = ""  # the look still resolves; only its content hint is missing
        instructions += "\n\nVisual treatment: " + style_spec.blurb + hint
    extra = ""
    if kind == "blueprint_evolution":
        # "Current gaps vs target standard" must come from evidence, so the
        # measured tension audit goes in with the sources: a disagreement between
        # them IS a gap, and an independence cluster stops one wire story from
        # counting as corroboration across five pillars.
        extra = _tension_brief(nb_id)
    parsed = llmio.structured(
        instructions=instructions,
        input=[{"type": "text", "text":
                f"Notebook: {meta.get('title')}\nSources:\n{src_lines}\n"
                f"{focus_line}{count_line}{conv_line}{lang_line}{extra}"
                f"\nSources content:\n{digest}"}],
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

    if kind == "blueprint_evolution":
        from . import gfx
        style_spec = style_spec or gfx.resolve_preset("")
        parsed["_style"] = {"id": style_spec.id, "label": style_spec.label,
                            "family": style_spec.family}
        engine = str(options.get("engine") or "gfx").strip().lower()
        json_path = _write_artifact(nb_id, kind, "json",
                                    json.dumps(parsed, indent=2, ensure_ascii=False))

        # Opt-in only. The vector engine is the default because it is exact: the
        # text is the text, it is crisp at any size, and it is a few KB. A painted
        # poster is offered as `engine="imagen_blueprint"` and degrades back to the
        # vector render when the host has no image backend, so a demo cannot end
        # on a 500 because someone ticked a toggle.
        if engine == "imagen_blueprint":
            painted = _image_blueprint(parsed, style_spec.id, nb_id)
            if painted:
                return {"path": painted, "json": str(json_path), "kind": kind,
                        "style": style_spec.id, "style_label": style_spec.label,
                        "template": "blueprint_evolution", "format": "png",
                        "engine": "imagen_blueprint",
                        "preview": json.dumps(parsed, ensure_ascii=False)[:1200]}

        svg = gfx.render(parsed, template="blueprint_evolution", preset=style_spec.id,
                         orientation=str(options.get("orientation") or "landscape").lower(),
                         detail=str(options.get("detail") or "standard").lower())
        path = _write_artifact(nb_id, kind, "svg", svg)
        result = {"path": str(path), "json": str(json_path), "kind": kind,
                  "style": style_spec.id, "style_label": style_spec.label,
                  "template": "blueprint_evolution", "format": "svg",
                  "engine": "gfx",
                  "preview": json.dumps(parsed, ensure_ascii=False)[:1200]}
        if engine == "imagen_blueprint":
            # the fallback is stated, not silently swallowed
            result["engine_fallback"] = "the image backend did not return a render"
        return result

    if kind == "infographic":
        assert style_spec is not None
        from . import gfx
        # The graphic is vector now: text stays text, so a numeral from the sources
        # can never be re-typeset by accident, and the file is a few KB.
        template = (fmt or "").strip().lower()
        if template not in gfx.TEMPLATES:
            template = "auto"
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
