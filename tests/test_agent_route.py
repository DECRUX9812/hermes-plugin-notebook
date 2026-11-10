"""The /agent route: plan -> run -> answer, and what it does when it can't.

The model is faked, the SQL is real: the point is that the number in the answer
came from the engine, and that a refusal (council mode, no tool chosen) is
reported instead of dressed up.
"""

import json

import pytest

from hermes_notebook import store


@pytest.fixture(autouse=True)
def _bound(ctx):  # noqa: F811 - binds runtime + tmp plugin data for every test
    return ctx


def _client():
    pytest.importorskip("fastapi")
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from dashboard import plugin_api

    app = FastAPI()
    app.include_router(plugin_api.router)
    return TestClient(app)


def _mk(nb="route-nb"):
    store.create_notebook("Route NB", "desc")
    store.add_source(nb, title="Doc A", kind="text", origin="pasted text",
                     text="ITER assembly is two thirds complete. " * 5)
    d = store.artifact_dir(nb)
    d.mkdir(parents=True, exist_ok=True)
    (d / "20261109-101010-data_table.csv").write_text(
        "entity,amount,currency\nFIA,4.48,B\nDOE,0.79,B\nITER,1.1,B\n", encoding="utf-8")
    return nb


def test_the_route_runs_the_query_the_plan_asked_for(ctx):
    _mk()
    ctx.llm.text_reply = "The three lines total $6.37B."
    ctx.llm.parsed_reply = {"use_tool": True, "tool": "query_table",
                            "arguments": {"sql": "SELECT SUM(amount) AS total FROM data_table"},
                            "reason": "needs a sum"}
    client = _client()
    out = client.post("/agent/run", json={"notebook": "route-nb",
                                          "question": "what do they total?"}).json()
    assert out["ok"] is True
    assert out["answer"].startswith("The three lines")
    action = out["actions"][0]
    assert action["tool"] == "query_table" and action["ok"] is True
    assert abs(float(action["rows"][0][0]) - 6.37) < 1e-6


def test_grounded_mode_never_runs_a_tool(ctx):
    _mk()
    ctx.llm.text_reply = "Answer from the sources."
    ctx.llm.parsed_reply = {"use_tool": True, "tool": "query_table",
                            "arguments": {"sql": "SELECT 1"}}
    client = _client()
    out = client.post("/agent/run", json={"notebook": "route-nb", "question": "q",
                                          "mode": "grounded"}).json()
    assert out["ok"] is True and out["actions"] == []


def test_no_tool_plan_answers_directly(ctx):
    _mk()
    ctx.llm.text_reply = "Straight answer."
    ctx.llm.parsed_reply = {"use_tool": False}
    client = _client()
    out = client.post("/agent/run", json={"notebook": "route-nb", "question": "q"}).json()
    assert out["ok"] is True and out["actions"] == []


def test_a_failing_query_is_reported_not_hidden(ctx):
    _mk()
    ctx.llm.text_reply = "I could not run that."
    ctx.llm.parsed_reply = {"use_tool": True, "tool": "query_table",
                            "arguments": {"sql": "SELECT nope FROM data_table"}}
    client = _client()
    out = client.post("/agent/run", json={"notebook": "route-nb", "question": "q"}).json()
    assert out["ok"] is True
    assert out["actions"][0]["ok"] is False and out["actions"][0]["error"]


def test_empty_question_is_a_400_with_a_sentence(ctx):
    _mk()
    client = _client()
    out = client.post("/agent/run", json={"notebook": "route-nb", "question": "  "})
    assert out.status_code == 400 and out.json()["error"]


def test_the_catalog_reports_tables_and_tools(ctx):
    _mk()
    client = _client()
    out = client.get("/agent/catalog", params={"notebook": "route-nb"}).json()
    assert out["ok"] is True
    assert {t["id"] for t in out["tools"]} == {"query_table", "run_script", "mcp_call"}
    assert any(t["table"] == "data_table" for t in out["tables"])
    assert out["engine"] in ("duckdb", "sqlite")


def test_rerun_runs_one_recorded_action_again(ctx):
    _mk()
    client = _client()
    out = client.post("/agent/rerun", json={"notebook": "route-nb", "tool": "query_table",
                                            "arguments": {"sql": "SELECT COUNT(*) FROM data_table"}}).json()
    assert out["ok"] is True and int(out["action"]["rows"][0][0]) == 3
