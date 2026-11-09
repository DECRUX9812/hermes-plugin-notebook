"""The artifact prompt registry: every Studio output states its own shape.

What is pinned here is not the wording — it is the contract the viewer depends
on: each kind has a brief, a schema with the fields the renderer reads, a
citation rule, a tension ledger injection, and a cache that a source edit
invalidates without spending a second model call.
"""

from __future__ import annotations

import json

import pytest

from hermes_notebook import artifact_prompts as prompts, artifacts, store


@pytest.fixture(autouse=True)
def _bound(ctx):  # noqa: F811 - binds runtime + tmp plugin data per test
    return ctx


def _mk(title="Prompt NB", texts=None):
    store.create_notebook(title, "desc")
    nb = store.resolve_notebook(title)
    for i, text in enumerate(texts or [
        "The Fusion Industry Association counts 4.48 billion dollars raised "
        "in the twelve months to July 2026, and 14.24 billion cumulative since "
        "2021. " * 8,
        "The Congressional Research Service puts cumulative private fusion "
        "investment at nearly 9 billion dollars for 2021 to 2025 on its own "
        "survey basis. " * 8,
    ], 1):
        store.add_source(nb, title=f"Doc {i}", kind="text", origin="pasted text",
                         text=text)
    return nb


# ------------------------------------------------------------------- coverage

def test_every_kind_has_a_brief_and_a_schema():
    """A kind without a brief generates a one-line prompt; a kind without a
    schema cannot be generated at all. Both are silent failures."""
    for kind in artifacts.ALL_KINDS:
        if kind in artifacts.MD_KINDS:
            assert kind in prompts.BRIEFS and prompts.BRIEFS[kind], kind
        else:
            assert kind in prompts.SCHEMAS, kind
            assert prompts.SCHEMAS[kind].get("properties"), kind


def test_structured_schemas_describe_the_fields_the_viewer_renders():
    # the viewers read these by name; a schema that drops one degrades the card
    assert {"nodes", "edges", "title"} <= set(prompts.SCHEMAS["mind_map"]["properties"])
    node = prompts.SCHEMAS["mind_map"]["properties"]["nodes"]["items"]["properties"]
    assert {"node_type", "summary", "key_stat", "citations"} <= set(node)
    assert prompts.SCHEMAS["mind_map"]["properties"]["edges"]["items"]["properties"]["relation"]["enum"]

    card = prompts.SCHEMAS["flashcards"]["properties"]["cards"]["items"]["properties"]
    assert {"card_type", "mnemonic", "difficulty", "tags", "citations"} <= set(card)

    q = prompts.SCHEMAS["quiz"]["properties"]["questions"]["items"]["properties"]
    assert {"stem", "choices", "answer", "rationales", "difficulty"} <= set(q)

    slide = prompts.SCHEMAS["slides"]["properties"]["slides"]["items"]["properties"]
    assert {"archetype", "stats", "columns", "stages", "notes", "citations"} <= set(slide)
    archetypes = slide["archetype"]["enum"]
    assert "title_hero" in archetypes and "tension_audit" in archetypes

    table = prompts.SCHEMAS["data_table"]["properties"]
    assert "summary" in table and "citations" in table


def test_slides_archetypes_are_all_renderable():
    """The viewer has a layout for every archetype in the enum — an unknown one
    would fall through to a bullet list and look like a bug.

    The layouts live in `src/42-slides.js` (the SLIDE_LAYOUTS table), not in the
    viewer switch: the switch dispatches to `SlideBody`, and the table decides
    which of the nine shapes draws. Reading the table is therefore the honest
    check — a name present only in a comment is not a layout."""
    src = __import__("pathlib").Path(__file__).resolve().parent.parent.joinpath(
        "src", "42-slides.js").read_text(encoding="utf-8")
    table = src.split("const SLIDE_LAYOUTS = {", 1)[1].split("}", 1)[0]
    for archetype in prompts.SCHEMAS["slides"]["properties"]["slides"]["items"][
            "properties"]["archetype"]["enum"]:
        assert f"{archetype}:" in table, f"{archetype} has no layout in SLIDE_LAYOUTS"
    # and the viewer must actually dispatch to it
    viewers = __import__("pathlib").Path(__file__).resolve().parent.parent.joinpath(
        "src", "40-viewers.js").read_text(encoding="utf-8")
    assert "jsx(SlideBody" in viewers, "SlidesView never renders the archetype body"


def test_markdown_briefs_states_their_skeleton():
    # the summary's KPI strip and BLUF banner are parsed by the viewer
    assert "Bottom line" in prompts.BRIEFS["summary"]
    assert "Key metrics" in prompts.BRIEFS["summary"]
    assert "| Metric | Value | Context | Source |" in prompts.BRIEFS["summary"]
    assert "Decision required" in prompts.BRIEFS["briefing_doc"]
    assert "30-60-90" in prompts.BRIEFS["briefing_doc"]
    for section in ("Foundational mechanics", "Edge cases and bottlenecks",
                    "Contradictions and unresolved questions"):
        assert section in prompts.BRIEFS["faq"]
    for tag in ("Milestone", "Bottleneck", "Architecture shift", "External event",
                "Target deadline"):
        assert tag in prompts.BRIEFS["timeline"]
    assert "Trap alerts" in prompts.BRIEFS["study_guide"]


def test_every_brief_carries_the_citation_and_tension_rules():
    body = prompts.build_instructions("summary", ledger_text="1. a vs b", mode="md")
    assert "S<n>" in body and "[S1][S4]" in body
    assert "TENSION LEDGER" in body
    assert "TENSION LEDGER" in prompts.build_instructions("mind_map", ledger_text="x", mode="struct")
    # with no ledger, the tension rules are not stated — there is nothing to obey
    clean = prompts.build_instructions("summary", mode="md")
    assert "TENSION LEDGER for these sources" not in clean


def test_focus_conversation_language_all_reach_the_brief():
    body = prompts.build_instructions(
        "summary", focus="only the money", count_hint="3 blocks",
        language="French", conversation="User: frame it for a CFO")
    assert "only the money" in body
    assert "REQUESTED AMOUNT: 3 blocks" in body
    assert "WRITE THE ENTIRE OUTPUT IN French" in body
    assert "CONVERSATION SO FAR" in body


# ------------------------------------------------------------------- ledger

def test_ledger_renders_conflicts_agreements_and_independence():
    ledger = {
        "items": [{"topic": "cumulative investment",
                   "sides": [{"claim": "$9B", "sources": [1]},
                             {"claim": "$14.24B", "sources": [2]}],
                   "resolution": "S2 counts announced rounds too"}],
        "agreements": [{"claim": "assembly is ahead of schedule", "sources": [1, 2]}],
        "independence": {"sources": 2, "independent": 2, "clusters": []},
    }
    text = prompts._ledger_text(ledger)
    assert "cumulative investment" in text
    assert "$9B [S1]" in text and "$14.24B [S2]" in text
    assert "weighs to: S2 counts announced rounds too" in text
    assert "agreed: assembly is ahead of schedule" in text
    assert "2 active sources, 2 independent" in text


def test_ledger_names_the_repeating_cluster():
    ledger = {"independence": {"sources": 3, "independent": 2,
                               "clusters": [{"members": [1, 2],
                                             "reason": "same opening text"}]}}
    text = prompts._ledger_text(ledger)
    assert "S1+S2 repeat the same text" in text
    assert "one voice" in text


def test_ledger_is_empty_when_there_is_nothing_to_report():
    assert prompts._ledger_text({}) == ""
    assert prompts._ledger_text({"items": [], "agreements": []}) == ""


# ------------------------------------------------------------------ caching

AUDIT = {
    "items": [{"topic": "cumulative investment",
               "sides": [{"claim": "$9B on the CRS basis", "sources": [2],
                          "quote": "nearly 9 billion"},
                         {"claim": "$14.24B including announced rounds",
                          "sources": [1], "quote": "14.24 billion"}],
               "why": "the two trackers count different things",
               "resolution": "neither is wrong; state the basis"}],
    "agreements": [{"claim": "the physics is not the bottleneck", "sources": [1, 2]}],
    "independence": {"sources": 2, "independent": 2, "clusters": []},
}


def test_a_second_artifact_reuses_the_cached_audit(ctx, monkeypatch):
    nb = _mk()
    ctx.llm.parsed_reply = AUDIT
    calls = {"n": 0}
    real = prompts.tensions_brief

    def counting(notebook_id, **kw):
        calls["n"] += 1
        return real(notebook_id, **kw)

    monkeypatch.setattr(prompts, "tensions_brief", counting)
    for kind in ("summary", "faq"):
        artifacts.generate(nb, kind)
    # one audit, cached: the second kind must not re-run the model
    assert calls["n"] == 2
    cache = json.loads((store._nb_dir(nb) / prompts.CACHE_NAME).read_text())
    assert cache["v"] == prompts.CACHE_VERSION

    second = artifacts.generate(nb, "timeline")
    prompt = ctx.llm.calls[-1]["messages"][-1]["content"]
    assert "$14.24B including announced rounds" in prompt


def test_editing_a_source_invalidates_the_cache(ctx):
    nb = _mk()
    first = prompts.tensions_brief(nb)
    src = store.list_sources(nb)[0]
    store.update_source(nb, src["id"], text="a completely different article " * 20)
    second = prompts.tensions_brief(nb)
    assert first.get("cached") is not True
    assert second.get("cached") is not True, "a changed source must not reuse the old audit"


def test_one_source_short_circuits_to_independence(ctx):
    store.create_notebook("Solo", "")
    nb = store.resolve_notebook("Solo")
    store.add_source(nb, title="Only", kind="text", origin="", text="one source only " * 10)
    out = prompts.tensions_brief(nb)
    assert out["items"] == []
    assert "fewer than two sources" in out["degraded"]


def test_a_failed_audit_degrades_instead_of_raising(ctx):
    nb = _mk()
    # the fake llm returns text_reply that is not the audit's JSON shape
    ctx.llm.parsed_reply = None
    ctx.llm.text_reply = "not json at all"
    out = prompts.tensions_brief(nb)
    assert out["items"] == []
    assert out["degraded"], "a failed audit must say so rather than pretend"
    # and the artifact is still written
    res = artifacts.generate(nb, "summary")
    assert res["path"].endswith(".md")


def test_generate_injects_the_ledger_into_a_structured_prompt(ctx):
    nb = _mk()
    ctx.llm.parsed_reply = {"title": "T", "nodes": [], "edges": []}
    artifacts.generate(nb, "mind_map")
    instructions = ctx.llm.calls[-1]["instructions"]
    assert "TENSION LEDGER" in instructions or "Independence:" in instructions
    assert "S<n>" in instructions and "[S1][S4]" in instructions


# ------------------------------------------------------------ viewer surfaces

ROOT = __import__("pathlib").Path(__file__).resolve().parent.parent


def _src(name):
    return (ROOT / "src" / name).read_text(encoding="utf-8")


def test_document_kinds_have_their_own_viewers():
    """summary/briefing/faq/study_guide must not fall through to plain markdown.

    Found on the live plugin: these four rendered as a wall of markdown because
    the viewer switch only special-cased timeline and data_table. The viewer the
    prompt writes for (BLUF banner, KPI strip, accordion, concept cards) existed
    in `41-docviews.js` and was never dispatched.
    """
    viewers = _src("40-viewers.js")
    for kind in ("summary", "briefing_doc", "faq", "study_guide"):
        assert f"artifact.kind === '{kind}'" in viewers, f"{kind} has no viewer branch"
    for component in ("DocView", "FaqView", "StudyGuideView"):
        assert f"jsx({component}" in viewers, f"{component} is defined but never rendered"


def test_doc_view_classes_all_have_css():
    """A class without a rule renders as unstyled text — invisible structure."""
    css = _src("00-head.js")
    for name in ("41-docviews.js", "42-slides.js"):
        used = set()
        for m in __import__("re").finditer(r"className: '([^']+)'", _src(name)):
            used.update(m.group(1).split())
        missing = [c for c in used if f".{c}" not in css]
        assert not missing, f"{name}: {missing} have no CSS rule"


def test_quiz_renders_per_option_rationales():
    """The schema asks for one rationale per choice; ignoring them made every
    wrong answer read the same."""
    viewers = _src("40-viewers.js")
    assert "q.rationales" in viewers
    assert "nb-quiz-why" in viewers


def test_flashcards_show_the_hook_and_the_tier():
    viewers = _src("40-viewers.js")
    for field in ("card.mnemonic", "card.difficulty", "card.card_type", "card.citations"):
        assert field in viewers, f"{field} is generated but never shown"


def test_mind_map_understands_the_graph_schema():
    """nodes + typed edges, not only a nested tree: a generated map used to lose
    its node types, metric badges and relation labels entirely."""
    viewers = _src("40-viewers.js")
    assert "function layoutGraph" in viewers
    for field in ("node_type", "key_stat", "relation", "dashed_tension"):
        assert field in viewers, f"{field} is generated but never drawn"


def test_xlsx_export_builds_a_real_workbook():
    """.xlsx is a different product from the same JSON: typed cells, a frozen
    header, an auto-filter, and the computed summary on its own sheet."""
    pytest.importorskip("openpyxl")
    from io import BytesIO

    from hermes_notebook import xlsx_export

    blob = xlsx_export.workbook({
        "title": "Fusion metrics",
        "columns": ["Entity", "Metric", "Value", "Unit", "Source"],
        "rows": [["Tokamak", "net gain", "1.5", "Q", "[S2]"],
                 ["Laser", "shots", "12,300", "count", "[S4]"],
                 ["HTS tape", "price", "$4.48", "bn", "[S1]"]],
        "summary": [{"label": "Rows", "value": "3", "basis": "count of rows"}],
    })
    assert blob[:2] == b"PK", "not a zip container — not a real xlsx"

    from openpyxl import load_workbook
    wb = load_workbook(BytesIO(blob))
    ws = wb[wb.sheetnames[0]]
    assert [c.value for c in ws[1]] == ["Entity", "Metric", "Value", "Unit", "Source"]
    # a bare number becomes numeric so it can be summed; "Q" stays text
    assert ws.cell(row=2, column=3).value == 1.5
    assert isinstance(ws.cell(row=2, column=4).value, str)
    assert ws.freeze_panes == "A2"
    assert ws.auto_filter.ref
    assert "Summary" in wb.sheetnames


def test_xlsx_refuses_to_turn_a_compound_value_into_a_number():
    """"28 to 30" and "1.2 GW" are not numbers; converting them would be a lie."""
    from hermes_notebook import xlsx_export

    assert xlsx_export._is_number("$4.48")
    assert xlsx_export._is_number("38%")
    assert xlsx_export._is_number("12,300")
    for bad in ("1.2 GW", "28 to 30", "mid-2030s", "—", "", "n/a", "Q>1"):
        assert not xlsx_export._is_number(bad), bad


def test_document_kinds_use_a_smaller_context_budget(ctx, monkeypatch):
    """The podcast budget (42k) was used for every artifact, which made a short
    document pay for a long-context call: a summary over six sources took minutes
    and the page's 240s timeout expired before the model returned."""
    from hermes_notebook import retrieve

    nb = _mk()
    seen = {}
    real = retrieve.notebook_digest

    def spy(notebook_id, **kw):
        seen["max_chars"] = kw.get("max_chars")
        return real(notebook_id, **kw)

    monkeypatch.setattr(retrieve, "notebook_digest", spy)
    artifacts.generate(nb, "summary")
    assert seen["max_chars"] is not None
    # the artifact budget is the smaller one, and it is configurable
    assert int(seen["max_chars"]) <= 30000, seen["max_chars"]


def test_the_page_waits_longer_than_the_slowest_kind():
    """Measured wall times on a six-source notebook: timeline ~117s, study guide
    ~239s. The page's 240s timeout cut the slowest kinds off while the server
    kept writing, so an artifact appeared later with a "failed" toast beside it."""
    shell = _src("30-shell.js")
    import re
    m = re.search(r"api\('/generate', \{[\s\S]*?timeoutMs: (\d+)", shell)
    assert m, "the generate call has no timeout"
    assert int(m.group(1)) >= 400000, f"{m.group(1)}ms is too short for a long document"


def test_sheet_title_is_sanitised():
    """openpyxl refuses `[]:*?/\\` in a sheet title and caps it at 31 chars. A
    generated title like "Commercial Fusion 2026: state of play" raised
    ValueError on the first click of Export → XLSX."""
    from hermes_notebook import xlsx_export

    assert xlsx_export._sheet_name("Commercial Fusion 2026: state of play") == \
        "Commercial Fusion 2026 state of"
    assert xlsx_export._sheet_name("") == "Data"
    # forbidden characters are REMOVED, not replaced: "a/b" becomes "ab"
    assert xlsx_export._sheet_name("a/b [c] *d* ?e: f\\g") == "ab c d e fg"
    blob = xlsx_export.workbook({"title": "A/B: *x*", "columns": ["c"], "rows": [["1"]]})
    assert blob[:2] == b"PK"


def test_media_prompts_ban_the_ident_and_demand_the_tension():
    """Audio and Video are the two kinds a judge hears rather than reads, so the
    prompt has to forbid the phrasing that makes a generated podcast sound
    generated, and require the real disagreement to be spoken."""
    from hermes_notebook import audio, video

    deep = audio._FORMAT_FRAMING["deep_dive"].lower()
    assert "in media res" in deep
    assert "welcome back" in deep, "the station ident is not banned"
    assert "disagreement" in deep or "disagree" in deep

    src = __import__("pathlib").Path(__file__).resolve().parent.parent.joinpath(
        "hermes_notebook", "video.py").read_text(encoding="utf-8")
    assert "IN MEDIA RES" in src
    assert "in this video" in src, "the filler opener is not banned"
    assert "contradict" in src.lower()
