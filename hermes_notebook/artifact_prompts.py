"""The artifact prompt registry — one place that decides what each Studio output
is asked to be.

Before this module the prompts lived as one-line strings inside `artifacts.py`:
a summary was "a concise SUMMARY", a mind map was "a nested JSON tree". That is
how every Studio artifact came out as the same wall of markdown. A generated
artifact is not prose with a heading; it is a *document with a shape*, and the
shape has to be stated before the model writes it:

* **Citations** — every claim carries a real ``[S<n>]`` marker, and the numbering
  is the page's own (see `retrieve.notebook_digest(cited=True)`), so a chip in
  the viewer opens the source it names.
* **Tensions** — the notebook already audits where its sources disagree
  (`tensions.analyze`) and how many are actually independent (measured, no
  model). That audit is injected here, so an artifact says "S1 and S4 disagree
  on this" instead of quietly presenting one side as consensus.
* **Structure** — each kind has a written schema: a KPI strip, a BLUF banner, an
  archetype per slide, a node/edge graph, per-distractor rationales. The viewer
  renders those fields; a model that ignores them degrades to markdown rather
  than to a worse product.

Nothing here calls a model. `tensions_brief` may, once per source-state, and it
caches the result next to the notebook, so a notebook's ten artifacts share one
audit instead of paying for ten.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from . import runtime, store

#: Bumped when a cached audit's shape changes, so stale caches are not reused.
CACHE_VERSION = 2
CACHE_NAME = "tensions-cache.json"
MAX_TENSION_CHARS = 4200


# --------------------------------------------------------------------- shared

CITATION_RULES = (
    "CITATION CONTRACT — this decides whether the output is usable:\n"
    "- Every factual claim, number, date or quote ends with the S<n> marker of "
    "the source that carries it, e.g. 'raised $4.48B [S2]'. Multiple: [S1][S4].\n"
    "- Use ONLY the S numbers given in SOURCES below. Never invent a marker, "
    "never cite a source that is not in the list.\n"
    "- A number may be quoted exactly as the source states it. Never round, "
    "never convert units, never compute a new figure from two sources unless the "
    "source itself does the arithmetic — and then say so.\n"
    "- If the sources do not answer something, write that they do not. 'The "
    "sources do not settle this' is a correct sentence; a plausible invented "
    "figure is the one failure that gets a document thrown away."
)

TENSION_RULES = (
    "TENSION LEDGER — the sources have already been audited against each other.\n"
    "- Where the ledger shows a conflict, the output must SHOW it rather than "
    "pick a side: name both positions with their markers ('S1 puts cumulative "
    "private investment near $9B; S2 counts $14.24B').\n"
    "- Where the ledger shows agreement, treat it as the stable ground and say "
    "so once, not on every line.\n"
    "- Where independence is low (a source repeats another's text), agreement "
    "between them is one voice, not corroboration. Say which numbers repeat.\n"
    "- If the ledger is empty, do not manufacture a disagreement to seem "
    "rigorous."
)


def _ledger_text(ledger: Optional[Dict[str, Any]]) -> str:
    """Render the audit as a compact block the model can reason over."""
    if not ledger:
        return ""
    bits: List[str] = []
    items = ledger.get("items") or []
    for i, it in enumerate(items[:5], 1):
        topic = str(it.get("topic") or "").strip()
        sides = []
        for side in (it.get("sides") or []):
            claim = str(side.get("claim") or "").strip()
            nums = "".join(f"[S{n}]" for n in (side.get("sources") or []) if n)
            if claim:
                sides.append(f"{claim} {nums}".strip())
        if topic and sides:
            bits.append(f"{i}. {topic}: " + " vs ".join(sides))
        res = str(it.get("resolution") or "").strip()
        if res and topic:
            bits.append(f"   weighs to: {res}")
    agreements = [str(a.get("claim") or "").strip()
                  for a in (ledger.get("agreements") or []) if a.get("claim")]
    for claim in agreements[:3]:
        bits.append(f"· agreed: {claim}")
    indep = ledger.get("independence") or {}
    total = indep.get("sources") or ledger.get("sources") or 0
    independent = indep.get("independent") or total
    if total:
        line = f"Independence: {total} active sources, {independent} independent"
        clusters = indep.get("clusters") or []
        if clusters:
            groups = ", ".join("+".join(f"S{m}" for m in (c.get("members") or []))
                               for c in clusters)
            line += f" — {groups} repeat the same text, so their agreement is one voice"
        bits.insert(0, line + ".")
    if not bits:
        return ""
    text = "\n".join(bits)
    return text[:MAX_TENSION_CHARS]


def _source_state(notebook_id: str) -> tuple[str, int, int]:
    """Fingerprint the active sources so a cache is invalidated by real edits."""
    import hashlib
    pairs = store.all_source_texts(notebook_id)
    off = store.disabled_sources(notebook_id)
    if off:
        pairs = [(r, t) for r, t in pairs if r.get("id") not in off]
    h = hashlib.sha1()
    for rec, text in pairs:
        h.update(str(rec.get("id") or "").encode("utf-8"))
        h.update(str(len(text or "")).encode("utf-8"))
        h.update((text or "")[:400].encode("utf-8"))
    return h.hexdigest(), len(pairs), sum(len(t or "") for _r, t in pairs)


def _cache_path(notebook_id: str):
    return store._nb_dir(notebook_id) / CACHE_NAME


def _read_cache(notebook_id: str) -> Optional[Dict[str, Any]]:
    try:
        data = json.loads(_cache_path(notebook_id).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or data.get("v") != CACHE_VERSION:
        return None
    return data


def _write_cache(notebook_id: str, state: tuple[str, int, int],
                 ledger: Dict[str, Any]) -> None:
    try:
        _cache_path(notebook_id).write_text(json.dumps({
            "v": CACHE_VERSION,
            "state": {"hash": state[0], "sources": state[1], "chars": state[2]},
            "ledger": ledger,
        }, indent=1, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass  # a cache miss only costs one model call


def tensions_brief(notebook_id: str, *, language: str = "",
                   refresh: bool = False) -> Dict[str, Any]:
    """The tension ledger for this notebook's current sources.

    Cached per source-state, so ten artifacts pay for one audit. When the model
    is unavailable or the audit fails, this degrades to the MEASURED half
    (independence) rather than blocking the artifact — an artifact with fewer
    citations is worse than no artifact at all.
    """
    from . import tensions as tensions_mod

    state = _source_state(notebook_id)
    if not state[1]:
        return {"text": "", "items": [], "independence": {}, "degraded": "no sources"}
    if int(state[1]) < 2:
        indep = tensions_mod.independence(notebook_id)
        return {"text": _ledger_text({"independence": indep}),
                "items": [], "independence": indep, "degraded": "fewer than two sources"}

    if not refresh:
        cached = _read_cache(notebook_id)
        if cached and (cached.get("state") or {}).get("hash") == state[0]:
            ledger = cached.get("ledger") or {}
            return {"text": _ledger_text(ledger), "items": ledger.get("items") or [],
                    "independence": ledger.get("independence") or {},
                    "cached": True, "degraded": ""}

    indep = tensions_mod.independence(notebook_id)
    try:
        ledger = tensions_mod.analyze(notebook_id, max_items=5, language=language)
    except Exception as exc:  # noqa: BLE001 - a failed audit must not fail the artifact
        ledger = {"items": [], "agreements": [], "independence": indep, "sources": state[1]}
        _write_cache(notebook_id, state, ledger)
        return {"text": _ledger_text(ledger), "items": [],
                "independence": indep, "degraded": f"{type(exc).__name__}: {exc}"}
    ledger = {k: v for k, v in (ledger or {}).items() if k != "ok"}
    _write_cache(notebook_id, state, ledger)
    return {"text": _ledger_text(ledger), "items": ledger.get("items") or [],
            "independence": ledger.get("independence") or indep, "degraded": ""}


# ------------------------------------------------------------- document kinds

#: Markdown kinds. Each brief states the exact skeleton the viewer parses; the
#: viewer falls back to plain markdown, so a model that ignores it is readable
#: but not indistinguishable from a good document.
_BRIEFS: Dict[str, str] = {
    "summary": (
        "Write a ONE-PAGE EXECUTIVE SYNTHESIS in this exact skeleton — no other "
        "headings, no preamble:\n"
        "\n"
        "`> **Bottom line:** <2 sentences: what this corpus proves, builds or "
        "decides, with [S#] on the claims that carry it.>`\n"
        "\n"
        "`## Key metrics`\n"
        "A markdown table, 3-5 rows, exactly 4 columns: "
        "`| Metric | Value | Context | Source |`. Value is the hardest number "
        "in the corpus with its unit (e.g. `$4.48B`), Context is <= 12 words "
        "saying what it measures or against what baseline, Source is `[S1]`. "
        "If the corpus has no real numbers, use the 3-5 hardest comparable "
        "facts and keep the same four columns.\n"
        "\n"
        "`## What the sources establish`\n"
        "3-5 blocks. Each block is `**<bold lead-in, <= 8 words>**` followed by "
        "2 tight sentences: the mechanism, architecture or finding, not the "
        "topic. Cite each block at least once.\n"
        "\n"
        "`## Consensus and disagreement`\n"
        "Two sub-bullets: `Agreement:` one sentence on what the sources state "
        "the same way; `Divergence:` one sentence on the real conflict, gap or "
        "unresolved question — or 'the sources do not overlap, so agreement is "
        "thin' if that is the truth.\n"
        "\n"
        "Banned: 'This document summarizes', 'In today's world', restating the "
        "notebook title as a finding, and any sentence with no claim in it."
    ),
    "briefing_doc": (
        "Write a PRINCIPAL DECISION MEMO that a C-suite reader can act on in one "
        "sitting. Exact sections:\n"
        "\n"
        "`## Decision required` — what is on the table, why now, and what "
        "happens if nothing is decided. <= 90 words, cited.\n"
        "\n"
        "`## Options` — a markdown table `| Option | Upside | Bottleneck or cost "
        "| Evidence |` with 2-4 real options the sources support. Bottleneck "
        "cells name a concrete constraint (money, schedule, physics, "
        "qualification), never 'various challenges'.\n"
        "\n"
        "`## Risks` — 3-5 rows. Each risk opens with a severity badge in "
        "brackets, exactly one of `[CRITICAL]`, `[MODERATE]`, `[LOW]`, then "
        "bold title — root cause (<= 18 words) — mitigation as a protocol with "
        "an owner role and a verification criterion. Cite the evidence.\n"
        "\n"
        "`## Open tensions and blind spots` — bullets that name the conflicting "
        "markers explicitly (`[S1] vs [S3]`) and the assumptions nobody in the "
        "sources verifies.\n"
        "\n"
        "`## 30-60-90` — three bullets, each `30 days:`/`60 days:`/`90 days:` "
        "with the action, the owner role, and how completion is verified.\n"
        "\n"
        "A memo with no decision in it is a summary and belongs in the other "
        "card."
    ),
    "faq": (
        "Write an ADVERSARIAL, DEEP-DIVE FAQ: the 8-12 questions a skeptical "
        "senior engineer, investor or auditor asks *after* reading the sources "
        "themselves. Structure it as exactly three sections:\n"
        "\n"
        "`## Foundational mechanics`\n"
        "`## Edge cases and bottlenecks`\n"
        "`## Contradictions and unresolved questions`\n"
        "\n"
        "Each question is its own heading line `### <question, <= 14 words, "
        "ending in ?>`, and each answer has exactly three parts:\n"
        "1. A verdict sentence: `**Yes — <claim>.**`, `**No — <claim>.**`, or "
        "the exact figure with its unit and meaning. No hedging opener.\n"
        "2. Two or three sentences of technical breakdown: the actual mechanism, "
        "constraint or number, with [S#] on each.\n"
        "3. A caveat line starting `Caveat:` — state whether one source alone "
        "backs it, whether two sources disagree (name both), or that the "
        "sources are silent.\n"
        "\n"
        "Section three must contain at least one question the sources genuinely "
        "cannot answer, answered with what is missing rather than a guess."
    ),
    "timeline": (
        "Write a CHRONOLOGY where each row carries its category and its "
        "consequence. One exact line format per event, no paragraphs:\n"
        "\n"
        "`- **<YYYY | YYYY-MM | YYYY-MM-DD | Phase 1>** | <category> | <headline, "
        "4-7 words> | <what changed and why it matters, <= 25 words> [S#] | "
        "<what this made possible or unblocked, <= 18 words>`\n"
        "\n"
        "`<category>` is exactly one of: `Milestone`, `Bottleneck`, "
        "`Architecture shift`, `External event`, `Target deadline`. Use "
        "Bottleneck only where something was actively blocked, and use it at "
        "least once when the sources report a constraint.\n"
        "Order strictly chronological. Where a relative phase appears, keep the "
        "source's own label (`Phase 2`, `T+90 days`). Where the material is not "
        "chronological, organise it as a dependency sequence and say so in the "
        "consequence column.\n"
        "Never merge two dates into one row and never invent a date the sources "
        "do not print — an undated development goes in the order its source "
        "places it, labelled with the source's own period."
    ),
    "study_guide": (
        "Write a MASTERY-LEVEL STUDY GUIDE. Exact skeleton:\n"
        "\n"
        "`## Mental model` — how the 5 key concepts connect as a system: "
        "inputs -> transformations -> outputs, one flow sentence and 3 bullets "
        "naming what each stage consumes and produces. Cite.\n"
        "\n"
        "`## Concept cards` — 4-6 cards, each `### <term>` followed by exactly "
        "four labelled lines: `**Definition:**`, `**Mechanism:**` (how it "
        "actually works underneath), `**Failure mode:**` (the concrete way it "
        "breaks in practice), `**Source:** [S#]`. Every term must be a real "
        "term from the sources.\n"
        "\n"
        "`## Trap alerts` — 3-5 rows, each exactly `**Novice assumption:** <what "
        "a beginner believes> / **What the sources show:** <the correction with "
        "its mechanism and [S#]>.` This is the section people screenshot; make "
        "each correction specific, not 'it depends'.\n"
        "\n"
        "`## Socratic prompts` — 3 open design/scenario prompts, each followed "
        "by `Rubric:` and 3 criteria a strong answer must satisfy, drawn from "
        "the sources' own constraints."
    ),
}

#: Structured kinds: what the model is told to produce, in words.
_STRUCT_INSTRUCTIONS: Dict[str, str] = {
    "mind_map": (
        "Build a SYSTEMS TOPOLOGY of this material as a directed knowledge graph "
        "— not a word-cloud tree.\n"
        "- 12-20 nodes across 3 levels: the core thesis, its subsystems, and "
        "the evidence/risks/actions underneath. Cross-link branches so the graph "
        "has more than one path to the middle.\n"
        "- Every node names its `node_type`: core_thesis, subsystem, "
        "metric_proof, risk_bottleneck, tension_conflict, action_item.\n"
        "- `key_stat` only when a real number belongs on the node (e.g. "
        "'$4.48B', '6 of 9'); otherwise omit it. `summary` is <= 15 words a "
        "reader can hover. `citations` holds the S numbers, never invented.\n"
        "- Every edge carries `relation` — one of depends on, mitigates, "
        "contradicts, replaces, measures, produces — and a `style`: solid, "
        "dashed_tension, or thick_flow. Use dashed_tension ONLY where the "
        "sources genuinely conflict, and put at least one such edge in a "
        "notebook whose sources disagree.\n"
        "- Label <= 4 words. Ids are short slugs (`money`, `iter-assembly`)."
    ),
    "flashcards": (
        "Write an ACTIVE-RECALL deck of 15-25 cards for spaced repetition. No "
        "yes/no cards, no trivia that a search engine answers in one word.\n"
        "Mix three card kinds, and set `card_type` on each:\n"
        "- `mechanism` — 'Why does X fail when Y exceeds Z?' or 'What makes X "
        "work?' — the answer names the mechanism.\n"
        "- `cloze` — one sentence with `{{c1::…}}` and where useful `{{c2::…}}` "
        "deletions; the sentence must be true as written.\n"
        "- `contrast` — 'Distinguish A from B across <2-3 named axes>'.\n"
        "Each card: `front` (<= 22 words), `back` (1-2 sentences plus one "
        "bulleted key spec line where a number exists), `mnemonic` (a hook that "
        "is actually memorable, <= 12 words), `difficulty` 1-3, `tags` (2-3 "
        "short lowercase labels), `citations` (S numbers). Cite the source the "
        "answer comes from, not the topic."
    ),
    "quiz": (
        "Write a DIAGNOSTIC assessment of 8-12 questions that test applied "
        "judgement, not recall. Every question is a realistic scenario, edge "
        "case or troubleshooting decision drawn from the sources.\n"
        "- `stem` states the situation in <= 45 words and ends with the question.\n"
        "- Exactly 4 `choices`. Every DISTRACTOR must be one of: a plausible "
        "misconception, an outdated baseline the sources themselves report, or "
        "a real number applied to the wrong component. Never a joke option.\n"
        "- `answer` is the exact text of one choice.\n"
        "- `rationales` has 4 entries in choice order: one sentence each saying "
        "why that option works or fails, with [S#] where a source decides it.\n"
        "- `explanation` is the one-line takeaway of the question's lesson.\n"
        "- `difficulty` is Foundational, Applied or Systems-level synthesis, and "
        "the set must include at least one of the last."
    ),
    "slides": (
        "Design a PRESENTATION DECK of 10-12 slides where every slide uses a "
        "DIFFERENT layout archetype. Two consecutive slides may never share one.\n"
        "Allowed `archetype` values, in a sensible order for a deck:\n"
        "`title_hero` (thesis + subtitle + metadata badges), `executive_bluf` "
        "(3 KPI stats + one takeaway banner), `problem_gap` (left: current "
        "bottleneck, right: target state, split), `architecture_bento` (3-5 "
        "cards with a micro-spec each), `process_pipeline` (3-5 ordered stages "
        "with a transformation each), `deep_dive_comparison` (a dense comparison "
        "table), `tension_audit` (source agreement vs contradiction, naming "
        "markers), `roadmap` (timeline swimlanes with owners), then optionally "
        "`closing`.\n"
        "Each slide: `title` <= 10 words (a claim, not a topic label), "
        "`bullets` 0-4 items of <= 16 words EACH — max 35 words total on the "
        "canvas — `stats` only on slides that show numbers, "
        "`columns` for the split archetypes (`{left:[...], right:[...]}`), "
        "`stages` for the pipeline archetype, `citations`, and `notes` "
        "carrying the narrative detail and [S#] that must NOT be on the slide.\n"
        "The first slide is title_hero and the last is roadmap or closing."
    ),
    "data_table": (
        "Build a NORMALISED relational dataset from the sources, ready for a "
        "spreadsheet pivot — never a two-column toy table.\n"
        "- 5-8 columns. Design them as typed fields, e.g. Entity, Category, "
        "Metric, Value, Unit, Baseline or target, Status or risk, Source.\n"
        "- Every numeric cell keeps the number and the unit in separate columns "
        "where the source states them separately; never write a paragraph into "
        "a cell. A missing value is `—`, never invented.\n"
        "- 8-20 rows, one entity/decision per row, no duplicates.\n"
        "- `summary` is a list of 2-4 computed aggregates over the numeric "
        "columns (total, mean, min/max range, count by category), each as a "
        "`<label>` and a `<value>` string; compute only from rows you wrote and "
        "say the basis.\n"
        "- `citations` per row is the S numbers that back that row."
    ),
    "blueprint_evolution": (
        "Produce an ENGINEERING GAP ANALYSIS poster: a five-zone architecture "
        "blueprint, not a summary. Read like a senior systems architect writing "
        "for other engineers.\n"
        "- Exactly 5 current_gaps, 5 evolution_matrix rows, 5 core_pillars, 4 "
        "expansion_stages, 4 validation_benches. A short array leaves a zone "
        "visibly empty.\n"
        "- Use EXACT domain nouns: name the solver, protocol, file format, frame "
        "budget, sample rate, tolerance. Never 'improves performance' - write "
        "'replaces manual sliders with Jacobian IK solvers at 240 Hz'.\n"
        "- current_gaps states what the SOURCES say is missing or weak TODAY. "
        "Where the tension ledger shows a conflict, that conflict IS a gap: say "
        "in the spec what is unresolved, and cite both positions.\n"
        "- evolution_matrix gives before -> after -> the replacement that bridges "
        "them. before_label is the legacy mechanism; after_label is the target.\n"
        "- core_pillars are the target architecture's five areas, each with a "
        "10-word specification. diagram_type picks the illustration that fits it.\n"
        "- expansion_stages go micro -> macro and each carries a measurable value.\n"
        "- validation_benches state a PASS CONDITION WITH A NUMBER in it.\n"
        "- If the sources do not cover a zone, say what is unknown in that zone's "
        "text rather than inventing a protocol."
    ),
    "infographic": (
        "Design an INFOGRAPHIC's content from these sources: pick the 3-6 most "
        "striking measurable facts (the `value` is the number or short fact "
        "itself, e.g. '1789', '70%', '6 of 9'), 2-4 quotable key facts with "
        "their source, and a one-line takeaway that states the conclusion, not "
        "the topic. All grounded; no invented figures."
    ),
}

#: The full markdown briefs, public. `artifacts.generate` interpolates the brief
#: for a markdown kind into its user message; when this was private the module
#: still called `_MD_PROMPTS[kind]` and every summary, briefing or FAQ raised
#: NameError before it reached the model.
BRIEFS: Dict[str, str] = _BRIEFS

#: The one-line opener kept for callers that only want the "what".
INSTRUCTIONS: Dict[str, str] = {
    k: v.strip().split("\n")[0] for k, v in _STRUCT_INSTRUCTIONS.items()
}


# ------------------------------------------------------------------ schemas

_CITES = {"type": "array", "items": {"type": "integer"},
          "description": "source numbers (S<n>) backing this item"}


#: The isometric vocabulary, imported from the renderer so a schema can never
#: list an icon the drawing code does not have (or miss one it does).
def _iso_kinds():
    """The renderer is the source of truth for the icon vocabulary."""
    try:
        from .gfx import isometrics
        return tuple(isometrics.KINDS)
    except Exception:                       # a schema must load without gfx
        return ("iso_grid_cube", "kinematic_node_graph", "oscilloscope_trace",
                "file_pipeline_nodes", "test_ramp_and_rig")


ISO_KINDS = _iso_kinds()


def _enum(values: List[str], desc: str) -> Dict[str, Any]:
    return {"type": "string", "enum": values, "description": desc}


SCHEMAS: Dict[str, Dict[str, Any]] = {
    "mind_map": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "root": {"type": "string", "description": "node id of the core thesis"},
            "nodes": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "short slug, unique"},
                    "label": {"type": "string", "description": "<= 4 words"},
                    "node_type": _enum(["core_thesis", "subsystem", "metric_proof",
                                        "risk_bottleneck", "tension_conflict",
                                        "action_item"], "what this node is"),
                    "summary": {"type": "string", "description": "<= 15 words, shown on hover"},
                    "key_stat": {"type": "string", "description": "optional badge, e.g. '$4.48B'"},
                    "citations": _CITES,
                },
                "required": ["id", "label", "node_type"],
            }},
            "edges": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "target": {"type": "string"},
                    "relation": _enum(["depends on", "mitigates", "contradicts",
                                       "replaces", "measures", "produces"],
                                      "how the target relates to the source"),
                    "style": _enum(["solid", "dashed_tension", "thick_flow"],
                                   "dashed only for a real conflict"),
                },
                "required": ["source", "target", "relation"],
            }},
            # legacy nested tree, still accepted so an older prompt path works
            "children": {"type": "array", "items": {"$ref": "#/$defs/node"}},
        },
        "required": ["title"],
        "$defs": {"node": {
            "type": "object",
            "properties": {"label": {"type": "string"},
                           "detail": {"type": "string"},
                           "children": {"type": "array", "items": {"$ref": "#/$defs/node"}}},
            "required": ["label"],
        }},
    },
    "flashcards": {
        "type": "object",
        "properties": {
            "cards": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "front": {"type": "string", "description": "question or cloze sentence"},
                    "back": {"type": "string", "description": "answer: 1-2 sentences"},
                    "card_type": _enum(["mechanism", "cloze", "contrast"],
                                       "the retrieval style of this card"),
                    "mnemonic": {"type": "string", "description": "<= 12 word hook"},
                    "difficulty": {"type": "integer", "minimum": 1, "maximum": 3},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "citations": _CITES,
                    "source": {"type": "string", "description": "optional source title"},
                },
                "required": ["front", "back"],
            }},
        },
        "required": ["cards"],
    },
    "quiz": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "questions": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "stem": {"type": "string", "description": "the scenario, <= 45 words"},
                    "question": {"type": "string", "description": "alias for stem"},
                    "choices": {"type": "array", "items": {"type": "string"},
                                "description": "exactly 4 options"},
                    "answer": {"type": "string", "description": "exact text of one choice"},
                    "rationales": {"type": "array", "items": {"type": "string"},
                                   "description": "one sentence per choice, in order"},
                    "explanation": {"type": "string", "description": "one-line lesson"},
                    "difficulty": _enum(["Foundational", "Applied",
                                         "Systems-level synthesis"], "tier"),
                    "citations": _CITES,
                },
                "required": ["answer"],
            }},
        },
        "required": ["questions"],
    },
    "slides": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "deck title"},
            "subtitle": {"type": "string", "description": "one-line framing"},
            "slides": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "archetype": _enum(["title_hero", "executive_bluf", "problem_gap",
                                        "architecture_bento", "process_pipeline",
                                        "deep_dive_comparison", "tension_audit",
                                        "roadmap", "closing"], "layout for this slide"),
                    "title": {"type": "string", "description": "<= 10 words, a claim"},
                    "kicker": {"type": "string", "description": "optional <= 6 word label"},
                    "bullets": {"type": "array", "items": {"type": "string"},
                                "description": "0-4 items, <= 16 words each"},
                    "stats": {"type": "array", "items": {
                        "type": "object",
                        "properties": {"value": {"type": "string"},
                                       "label": {"type": "string"}},
                        "required": ["value", "label"],
                    }},
                    "columns": {"type": "object",
                                "properties": {"left": {"type": "array", "items": {"type": "string"}},
                                               "right": {"type": "array", "items": {"type": "string"}}}},
                    "stages": {"type": "array", "items": {
                        "type": "object",
                        "properties": {"label": {"type": "string"},
                                       "detail": {"type": "string"}},
                        "required": ["label"],
                    }},
                    "citations": _CITES,
                    "notes": {"type": "string", "description": "speaker notes with detail and [S#]"},
                    "note": {"type": "string", "description": "alias for notes"},
                },
                "required": ["title"],
            }},
        },
        "required": ["title", "slides"],
    },
    "data_table": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "what the table compares"},
            "columns": {"type": "array", "items": {"type": "string"},
                        "description": "5-8 typed column headers"},
            "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}},
                     "description": "8-20 rows; short typed cells, '—' when absent"},
            "summary": {"type": "array", "items": {
                "type": "object",
                "properties": {"label": {"type": "string"},
                               "value": {"type": "string"},
                               "basis": {"type": "string"}},
                "required": ["label", "value"],
            }, "description": "2-4 computed aggregates over the rows"},
            "citations": {"type": "array", "items": {"type": "array", "items": {"type": "integer"}},
                          "description": "per row: the S numbers that back it"},
        },
        "required": ["title", "columns", "rows"],
    },
    "blueprint_evolution": {
        "type": "object",
        "properties": {
            "title": {"type": "string",
                      "description": "the system and its architectural evolution, <= 12 words"},
            "subtitle": {"type": "string",
                         "description": "one line naming what changed and why it matters"},
            "current_gaps": {
                "type": "array",
                "description": "exactly 5 legacy limitations, most load-bearing first",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "short noun phrase, <= 5 words"},
                        "spec": {"type": "string",
                                 "description": "8-12 words, exact: name the protocol, solver, format or budget that is missing"},
                        "icon_type": _enum(list(ISO_KINDS), "the isometric diagram for this gap"),
                        "citations": {"type": "array", "items": {"type": "integer"},
                                      "description": "the S numbers this gap is evidenced by"},
                    },
                    "required": ["title", "spec", "icon_type"],
                },
            },
            "evolution_matrix": {
                "type": "array",
                "description": "exactly 5 rows: what a domain does now vs what it becomes",
                "items": {
                    "type": "object",
                    "properties": {
                        "domain": {"type": "string", "description": "one word or short phrase, <= 4 words"},
                        "before_label": {"type": "string", "description": "the legacy mechanism, <= 3 words"},
                        "after_label": {"type": "string", "description": "the target mechanism, <= 3 words"},
                        "key_upgrade": {"type": "string",
                                        "description": "one sentence naming the replacement, e.g. 'Replaces manual sliders with Jacobian IK solvers'"},
                    },
                    "required": ["domain", "before_label", "after_label", "key_upgrade"],
                },
            },
            "core_pillars": {
                "type": "array",
                "description": "exactly 5 target-state pillars; they inherit the poster's fixed signal order (amber, purple, cyan, coral, emerald)",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "area name, <= 4 words"},
                        "concise_spec": {"type": "string",
                                         "description": "10 words of specification: rates, budgets, protocols, formats"},
                        "diagram_type": _enum(list(ISO_KINDS), "the isometric diagram for this pillar"),
                        "accent_color": {"type": "string",
                                         "description": "advisory only - the poster's signal order fixes the colour"},
                        "citations": {"type": "array", "items": {"type": "integer"}},
                    },
                    "required": ["title", "concise_spec", "diagram_type"],
                },
            },
            "expansion_stages": {
                "type": "array",
                "description": "exactly 4 progressive deployment scales, micro -> macro",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string", "description": "stage name, e.g. Desktop / Studio / Fleet / Cloud"},
                        "detail": {"type": "string", "description": "what changes at this scale, <= 12 words"},
                        "value": {"type": "string", "description": "the measurable scale, e.g. '1 seat', '64 nodes'"},
                    },
                    "required": ["label", "detail"],
                },
            },
            "validation_benches": {
                "type": "array",
                "description": "exactly 4 verification scenarios",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "what is being proven, <= 4 words"},
                        "test_criteria": {"type": "string",
                                          "description": "10-12 words with a number in them: the pass condition"},
                        "bench_icon": _enum(list(ISO_KINDS), "the test-bench illustration"),
                    },
                    "required": ["title", "test_criteria", "bench_icon"],
                },
            },
        },
        "required": ["title", "current_gaps", "evolution_matrix", "core_pillars",
                     "expansion_stages", "validation_benches"],
    },
    "infographic": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "takeaway": {"type": "string", "description": "one-line bottom line"},
            "stats": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "value": {"type": "string", "description": "big number/short stat"},
                    "label": {"type": "string", "description": "<= 8 words"},
                    "detail": {"type": "string", "description": "optional one-line detail"},
                    "source": {"type": "string"},
                },
                "required": ["value", "label"],
            }, "description": "3-6 headline stats"},
            "quotes": {"type": "array", "items": {
                "type": "object",
                "properties": {"text": {"type": "string", "description": "striking fact"},
                               "source": {"type": "string"},
                               "citations": _CITES},
                "required": ["text"],
            }, "description": "2-4 key facts worth highlighting"},
        },
        "required": ["title", "stats", "quotes", "takeaway"],
    },
}


# ------------------------------------------------------------------ assembly

def build_instructions(kind: str, *, ledger_text: str = "", focus: str = "",
                       count_hint: str = "", language: str = "",
                       style_note: str = "", conversation: str = "",
                       mode: str = "struct") -> str:
    """One assembled instruction block: brief + ledger + the user's overrides."""
    brief = _BRIEFS.get(kind) or _STRUCT_INSTRUCTIONS.get(kind) or ""
    parts: List[str] = [brief]
    if style_note:
        parts.append("VISUAL TREATMENT: " + style_note)
    if ledger_text:
        parts.append("TENSION LEDGER for these sources:\n" + ledger_text)
    if focus.strip():
        parts.append(f"FOCUS the user asked for: {focus.strip()}\n"
                     "It decides the angle and what to emphasise. It never "
                     "overrides the grounding rules: anything it asserts that no "
                     "source supports is the user's position, not a finding.")
    if count_hint.strip():
        parts.append(f"REQUESTED AMOUNT: {count_hint.strip()}")
    if conversation.strip():
        parts.append(
            "The user worked this request out in a conversation with the "
            "notebook. Use it as the brief: it decides the angle, the audience "
            "and what to emphasise. Facts still come only from the sources — "
            "anything the conversation asserts that no source supports is the "
            "user's own position and must be attributed to them, never restated "
            "as fact.\nCONVERSATION SO FAR:\n" + conversation)
    if language.strip():
        parts.append(
            f"WRITE THE ENTIRE OUTPUT IN {language.strip()}. Translate headings, "
            "prose and labels into that language; keep source titles, "
            "identifiers and quoted strings in their original form.")
    parts.append(CITATION_RULES)
    if ledger_text:
        parts.append(TENSION_RULES)
    return "\n\n".join(p for p in parts if p)


def build_system_prompt(kind: str, mode: str = "md") -> str:
    base = (
        "You are a senior research analyst writing a deliverable, not a chat "
        "reply. Everything you state is traceable to the sources supplied: each "
        "claim carries the S<n> marker of the source that holds it, and nothing "
        "is invented to fill a heading. Where the sources are silent or "
        "disagree, you say so in the document itself."
    )
    if mode == "md":
        return base + " Output Markdown only — no preamble, no fences, no closing courtesy."
    return base + (
        " Output only the JSON object the schema describes — no markdown fences, "
        "no commentary. Every named field matters: the viewer renders them."
    )
