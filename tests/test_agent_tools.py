"""Grounded tool execution: the numbers come from a query that ran.

These pin the three tools and, more importantly, their *failure* behaviour —
a sandbox that cannot run must say so, not return a plausible zero.
"""

import pytest

from hermes_notebook import agent_tools, store


@pytest.fixture(autouse=True)
def _bound(ctx):  # noqa: F811 - binds runtime + tmp plugin data for every test
    return ctx


def _mk(nb="agent-nb", csv_text=None):
    store.create_notebook("Agent NB", "desc")
    store.add_source(nb, title="Doc A", kind="text", origin="pasted text",
                     text="ITER assembly is two thirds complete. " * 5)
    d = store.artifact_dir(nb)
    d.mkdir(parents=True, exist_ok=True)
    if csv_text is not None:
        (d / "20261109-101010-data_table.csv").write_text(csv_text, encoding="utf-8")
    return nb


CSV = "entity,amount,currency\nFIA,4.48,B\nDOE,0.79,B\nITER,1.1,B\n"


# ------------------------------------------------------------------ tables

def test_a_csv_becomes_a_queryable_table():
    _mk(csv_text=CSV)
    rows = agent_tools.tables("agent-nb")
    assert rows and rows[0]["table"].endswith("data_table")
    assert "amount" in rows[0]["columns"] and rows[0]["rows"] == 3


def test_query_returns_real_columns_and_rows():
    _mk(csv_text=CSV)
    out = agent_tools.query_table("agent-nb", "SELECT entity, amount FROM data_table ORDER BY amount DESC")
    assert out["ok"] is True
    assert out["columns"] == ["entity", "amount"]
    # numeric, not lexicographic: 4.48 > 1.1 > 0.79 (as text "1.1" would win)
    assert [r[0] for r in out["rows"]] == ["FIA", "ITER", "DOE"]
    assert out["engine"] in ("duckdb", "sqlite")


def test_aggregation_is_done_by_the_engine_not_the_model():
    _mk(csv_text=CSV)
    out = agent_tools.query_table("agent-nb", "SELECT SUM(amount) AS total, COUNT(*) AS n FROM data_table")
    assert out["ok"] is True
    assert out["rows"][0][1] == 3
    assert abs(float(out["rows"][0][0]) - 6.37) < 1e-6


def test_writes_are_refused():
    _mk(csv_text=CSV)
    for sql in ("DROP TABLE data_table", "DELETE FROM data_table", "UPDATE data_table SET amount = 0"):
        out = agent_tools.query_table("agent-nb", sql)
        assert out["ok"] is False and "read-only" in out["error"]


def test_a_broken_query_reports_the_engine_error():
    _mk(csv_text=CSV)
    out = agent_tools.query_table("agent-nb", "SELECT nope FROM data_table")
    assert out["ok"] is False and out["error"]


def test_no_tables_is_an_honest_empty_answer():
    _mk()
    out = agent_tools.query_table("agent-nb", "SELECT 1")
    assert out["ok"] is True and out["tables"] == 0


# ------------------------------------------------------------------ sandbox

def test_python_runs_and_reports_stdout():
    out = agent_tools.run_script("python", "print(6 * 7)")
    assert out["ok"] is True and out["exit"] == 0 and out["out"].strip() == "42"


def test_a_failing_script_keeps_its_exit_code_and_stderr():
    out = agent_tools.run_script("python", "raise SystemExit(3)")
    assert out["ok"] is False and out["exit"] == 3


def test_bash_gets_a_real_shell():
    out = agent_tools.run_script("bash", "echo hello; exit 2")
    assert out["exit"] == 2 and "hello" in out["out"]


def test_a_runaway_script_times_out_instead_of_hanging():
    out = agent_tools.run_script("python", "import time\nwhile True: time.sleep(0.1)", timeout=1)
    assert out["ok"] is False and "timed out" in (out["err"] or "")


def test_the_script_runs_in_a_throwaway_directory():
    out = agent_tools.run_script("python", "import os; print(os.getcwd())")
    assert out["ok"] is True
    assert "nb-agent-" in out["out"]


# ---------------------------------------------------------------------- mcp

def test_mcp_without_a_host_bridge_refuses_in_a_sentence():
    out = agent_tools.mcp_call("github", "list_issues", {})
    assert out["ok"] is False
    assert out["error"]


def test_catalog_lists_tools_and_tables():
    _mk(csv_text=CSV)
    cat = agent_tools.catalog("agent-nb")
    assert {t["id"] for t in cat["tools"]} == {"query_table", "run_script", "mcp_call"}
    assert cat["tables"] and cat["engine"] in ("duckdb", "sqlite")
