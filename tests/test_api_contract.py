"""The route contract: one error shape, a status code a client can act on, and
no sentence the reader cannot understand.

These pin three bugs that were all visible in the UI and none of them in the
DOM:

* ``/search`` without a query raised ValueError inside the handler, so FastAPI
  answered "Internal Server Error" — a 500 for "the box is empty". It is a 400
  with a sentence now, and ``q`` is accepted because every other search box in
  the app spells it that way.
* ``str(KeyError("notebook not found: 'x'"))`` is ``'"notebook not found: \\'x\\'"'``
  — KeyError stringifies its argument as a repr, so the toast showed doubled
  quotes around a message that was already correct.
* ``f"{type(exc).__name__}: {exc}"`` prefixed 21 user-facing sentences with a
  class name ("ValueError: ...") the reader cannot act on.
"""

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
    return TestClient(app), plugin_api


def _mk(nb="contract-nb"):
    store.create_notebook("Contract NB", "desc")
    store.add_source(nb, title="Doc A", kind="text", origin="pasted text",
                     text="ITER assembly is two thirds complete. " * 10)
    return nb


# ------------------------------------------------------------------- _why

def test_keyerror_loses_its_repr_quotes():
    _, plugin_api = _client()
    exc = KeyError("notebook not found: 'nope'")
    assert plugin_api._why(exc) == "notebook not found: 'nope'"


def test_a_plain_exception_keeps_its_sentence():
    _, plugin_api = _client()
    assert plugin_api._why(ValueError("give me a file path or a URL")) == \
        "give me a file path or a URL"


def test_an_empty_exception_still_says_something():
    _, plugin_api = _client()
    assert plugin_api._why(RuntimeError()) == "RuntimeError"


# ------------------------------------------------------------------ search

def test_search_without_a_query_is_a_400_with_a_sentence():
    _mk()
    client, _ = _client()
    out = client.post("/search", json={"notebook": "contract-nb", "query": ""})
    assert out.status_code == 400
    body = out.json()
    assert body["ok"] is False and body["error"]
    assert "Internal Server Error" not in body["error"]


def test_search_accepts_q_as_the_query_name():
    _mk()
    client, _ = _client()
    out = client.post("/search", json={"notebook": "contract-nb", "q": "assembly"})
    assert out.status_code == 200
    body = out.json()
    assert body["ok"] is True and body["result"]["hits"]


def test_search_clamps_a_silly_limit_instead_of_raising():
    _mk()
    client, _ = _client()
    out = client.post("/search", json={"notebook": "contract-nb", "query": "ITER",
                                       "limit": "lots"})
    assert out.status_code == 200


# ------------------------------------------------------------- missing notebook

def test_a_missing_notebook_is_one_clean_sentence():
    _mk()
    client, _ = _client()
    out = client.get("/state", params={"notebook": "no-such-notebook"})
    assert out.status_code == 404
    err = out.json()["error"]
    assert err.startswith("notebook not found")
    assert not err.startswith('"'), "KeyError's repr quotes leaked into the toast"
