"""The parity pack: conversation-as-brief artifacts, output language, and
deep-research rounds. These are the three places where NotebookLM's late-2026
surface (in-chat artifact creation, 80+ languages, Deep Research) had no
equivalent here.
"""

import json

import pytest

from hermes_notebook import artifacts, discover, store


@pytest.fixture(autouse=True)
def _bound(ctx):  # noqa: F811 - binds runtime + tmp plugin data per test
    return ctx


def _mk(nb_title="Parity NB"):
    store.create_notebook(nb_title, "desc")
    nb = store.resolve_notebook(nb_title)
    store.add_source(nb, title="Alpha Doc", kind="text", origin="pasted text",
                     text="The mitochondria is the powerhouse of the cell. " * 20,
                     labels=["bio"], summary="cell bio")
    return nb


# ------------------------------------------------------- conversation as brief
def test_thread_as_brief_renders_tail():
    nb = _mk()
    store.append_thread(nb, "t1", "user", "how does the cell make energy?")
    store.append_thread(nb, "t1", "assistant", "through the mitochondria [S1].")
    brief = store.thread_as_brief(nb, "t1")
    assert brief.splitlines() == [
        "User: how does the cell make energy?",
        "Assistant: through the mitochondria [S1].",
    ]


def test_thread_as_brief_empty_and_capped():
    nb = _mk()
    assert store.thread_as_brief(nb, "") == ""
    assert store.thread_as_brief(nb, "missing") == ""
    for i in range(6):
        store.append_thread(nb, "t2", "user", f"q{i} " + "x" * 200)
    brief = store.thread_as_brief(nb, "t2", limit=520)
    assert len(brief) <= 520
    # the newest turns survive, the oldest fall off
    assert "q5" in brief and "q0 " not in brief


def test_generate_uses_conversation_and_language(ctx):
    nb = _mk()
    convo = "User: pitch this to a CFO\nAssistant: frame it as cost avoided [S1]."
    out = artifacts.generate(nb, "summary", conversation=convo, language="French")
    assert out["kind"] == "summary"
    prompt = ctx.llm.calls[-1]["messages"][-1]["content"]
    assert "CONVERSATION SO FAR" in prompt
    assert "pitch this to a CFO" in prompt
    assert "WRITE THE ENTIRE OUTPUT IN French" in prompt
    # grounding rule still stated: conversation cannot invent facts
    assert "must be attributed to them" in prompt


def test_generate_without_conversation_is_unchanged(ctx):
    nb = _mk()
    out = artifacts.generate(nb, "summary")
    prompt = ctx.llm.calls[-1]["messages"][-1]["content"]
    assert "CONVERSATION SO FAR" not in prompt
    assert "WRITE THE ENTIRE OUTPUT" not in prompt
    assert out["kind"] == "summary"


# ----------------------------------------------------------- media key lookup
def test_api_key_falls_back_to_hermes_env_file(monkeypatch, tmp_path):
    from hermes_notebook import media
    home = tmp_path / "hermes-home"
    home.mkdir()
    (home / ".env").write_text('GROQ_API_KEY=gsk-from-the-env-file\nOTHER=1\n', encoding="utf-8")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(media.runtime, "config", lambda key, default=None: "")
    assert media._api_key() == "gsk-from-the-env-file"


def test_api_key_absent_everywhere(monkeypatch, tmp_path):
    from hermes_notebook import media
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "empty"))
    monkeypatch.setattr(media.runtime, "config", lambda key, default=None: "")
    monkeypatch.setattr(media.Path, "home", classmethod(lambda cls: tmp_path / "nohome"))
    assert media._api_key() == ""


# --------------------------------------------------------------- pptx route
def test_pptx_route_builds_from_stored_deck(ctx):
    pytest.importorskip("fastapi")
    from dashboard import plugin_api
    from hermes_notebook import artifacts as arts

    nb = _mk("Deck NB")
    written = arts._write_artifact(nb, "slides", "json", json.dumps({
        "title": "Deck title", "slides": [{"title": "One", "bullets": ["a", "b"]}],
    }))
    out = plugin_api.artifact_pptx(notebook="Deck NB", name=written.name, b64=1)
    assert out["ok"] is True and out["ext"] == "pptx" and out["bytes"] > 1000
    assert out["mime"].endswith("presentationml.presentation")
    assert out["b64"]

    bad = plugin_api.artifact_pptx(notebook="Deck NB", name="nope.md", b64=1)
    assert bad.status_code == 404

def test_refine_queries_never_repeats_a_tried_query(monkeypatch):
    monkeypatch.setattr(discover.llmio, "structured", lambda **kw: {
        "queries": ["Alpha cell biology primary sources", "alpha cell BIOLOGY primary sources",
                    "counter-argument mitochondria"],
        "still_missing": ["expert dissent"],
    })
    out = discover.refine_queries({"title": "Parity NB"}, "cell energy",
                                  [{"title": "x", "domain": "y", "snippet": "z"}],
                                  ["gap"], ["Alpha cell biology primary sources"], 2)
    assert out == ["counter-argument mitochondria"]


def test_deep_discover_runs_a_second_round(monkeypatch):
    nb = _mk()
    seen = {}

    def fake_search(queries, per_query=6):
        seen["queries"] = list(queries)
        if "second-round" in queries[0]:
            return [{"title": "Round two hit", "url": "https://two.example/x",
                     "description": "cell energy detail", "provider": "web"}]
        return [{"title": "Round one hit", "url": "https://one.example/x",
                 "description": "cell energy basics", "provider": "web"}]

    monkeypatch.setattr(discover, "search_all", fake_search)
    monkeypatch.setattr(discover, "plan_queries", lambda *a, **kw: {"gaps": ["g1"], "queries": ["cells"]})
    monkeypatch.setattr(discover, "refine_queries", lambda *a, **kw: ["second-round query"])

    out = discover.discover(nb, deep=True, rounds=2)   # no explicit query
    assert out["deep"] is True
    assert out["rounds"] == 2
    assert "second-round query" in out["queries"]
    rounds = {c["round"] for c in out["candidates"]}
    assert rounds == {1, 2}


def test_shallow_discover_stays_one_round(monkeypatch):
    nb = _mk()
    monkeypatch.setattr(discover, "search_all", lambda q, per_query=6: [
        {"title": "Only hit", "url": "https://one.example/x",
         "description": "cell energy", "provider": "web"}])
    monkeypatch.setattr(discover, "refine_queries",
                        lambda *a, **kw: pytest.fail("shallow search must not refine"))
    out = discover.discover(nb, deep=False)
    assert out["rounds"] == 1 and out["deep"] is False
