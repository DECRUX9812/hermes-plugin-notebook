"""End-to-end tool flows against the fake ctx: create → add → ask → generate → suggest."""

import json

import pytest

from hermes_notebook import runtime, store, tools


def _out(raw: str) -> dict:
    return json.loads(raw)


def test_add_source_text_labels_and_ask_cites(ctx):
    ctx.llm.parsed_reply = {"labels": ["photosynthesis", "biology"], "summary": "How plants make food."}
    ctx.llm.text_reply = "Plants use sunlight [S1]."

    created = _out(tools.notebook_create({"title": "Bio 101", "description": "bio notes"}))
    assert created["ok"] and created["id"] == "bio-101"

    added = _out(tools.notebook_add_source({"notebook": "bio-101", "text":
        "Photosynthesis is the process by which plants convert sunlight, water and CO2 into glucose and oxygen. " * 20}))
    assert added["ok"], added
    assert added["labels"] == ["photosynthesis", "biology"]
    assert added["kind"] == "text"

    asked = _out(tools.notebook_ask({"notebook": "bio-101",
                                     "question": "what does photosynthesis produce?"}))
    assert asked["ok"], asked
    assert "[S1]" in asked["answer"]
    assert asked["sources_used"][0]["title"]


def test_ask_without_sources_fails_cleanly(ctx):
    tools.notebook_create({"title": "Empty"})
    out = _out(tools.notebook_ask({"question": "anything?"}))
    assert out["ok"] is False
    assert "no readable sources" in out["error"]


def test_generate_markdown_artifact_writes_file(ctx, tmp_path):
    ctx.llm.text_reply = "# Summary\n\nPlants are great [S1]."
    tools.notebook_create({"title": "Plants"})
    tools.notebook_add_source({"notebook": "plants", "text": "plants plants plants " * 50})
    out = _out(tools.notebook_generate({"notebook": "plants", "kind": "summary"}))
    assert out["ok"], out
    path = out["path"]
    assert path.endswith(".md") and "summary" in path
    content = open(path).read()
    assert "Plants are great" in content and "Summary" in content


def test_generate_mind_map_writes_md_and_json(ctx):
    ctx.llm.parsed_reply = {"title": "Bio", "children": [{"label": "Cells"}]}
    tools.notebook_create({"title": "Bio"})
    tools.notebook_add_source({"notebook": "bio", "text": "cell biology content " * 60})
    out = _out(tools.notebook_generate({"notebook": "bio", "kind": "mind_map"}))
    assert out["ok"], out
    assert out["path"].endswith(".md") and out["json"].endswith(".json")
    md = open(out["path"]).read()
    assert "Cells" in md and "mermaid" in md


def test_generate_bad_kind_and_empty_notebook(ctx):
    tools.notebook_create({"title": "X"})
    gen = runtime.handler(tools.notebook_generate)
    out = _out(gen({"notebook": "x", "kind": "hologram"}))
    assert out["ok"] is False and "unknown artifact kind" in out["error"]
    tools.notebook_create({"title": "NoSrc"})
    out = _out(gen({"notebook": "nosrc", "kind": "summary"}))
    assert out["ok"] is False and "no sources" in out["error"]


def test_suggest_returns_structured(ctx):
    ctx.llm.parsed_reply = {
        "questions": ["What is X?"], "artifacts": ["quiz: tests recall"],
        "gaps": ["needs a methods section"],
    }
    tools.notebook_create({"title": "S"})
    tools.notebook_add_source({"notebook": "s", "text": "content " * 100})
    out = _out(tools.notebook_suggest({"notebook": "s"}))
    assert out["ok"], out
    assert out["suggestions"]["questions"] == ["What is X?"]
    # suggestions route through the plugin's own aux task slot
    assert any(c.get("task") == "notebook" for c in ctx.llm.calls if c["kind"] == "structured")


def test_delete_requires_confirm(ctx):
    tools.notebook_create({"title": "Bye"})
    out = _out(tools.notebook_delete({"notebook": "bye", "confirm": False}))
    assert out["ok"] is False
    assert store.list_notebooks()  # still there
    out = _out(tools.notebook_delete({"notebook": "bye", "confirm": True}))
    assert out["ok"] and out["deleted"] == "bye"


def test_handler_wraps_exceptions_as_json(ctx):
    raw = runtime.handler(lambda args, **kw: (_ for _ in ()).throw(RuntimeError("boom")))(
        {"notebook": "missing"})
    out = json.loads(raw)
    assert out["ok"] is False and "boom" in out["error"]


def test_notebook_list_empty_hint(ctx):
    out = _out(tools.notebook_list({}))
    assert out["ok"] and out["notebooks"] == [] and "notebook_create" in out["hint"]
