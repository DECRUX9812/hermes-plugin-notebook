"""Conversations: many named chat threads per notebook.

The differentiator people ask about first when they compare this with a
single-thread chat product is *"can I keep several lines of enquiry at once?"* —
a research notebook is usually pricing + history + what-changed, and each line
needs its own memory. These tests pin the store, the routes and the tool.
"""

import json

import pytest

from hermes_notebook import store, tools


@pytest.fixture(autouse=True)
def _bound(ctx):  # noqa: F811 - binds runtime + tmp plugin data for every test
    return ctx


def _mk(nb="threads-nb"):
    store.create_notebook("Threads NB", "desc")
    store.add_source(nb, title="Doc A", kind="text", origin="pasted text",
                     text="ITER assembly is two thirds complete. " * 10)
    return nb


# --------------------------------------------------------------------- store

def test_created_thread_is_listed_and_empty():
    _mk()
    made = store.create_thread("threads-nb", "Pricing")
    assert made["name"] and made["title"] == "Pricing"
    rows = store.list_threads("threads-nb")
    assert [r["name"] for r in rows] == [made["name"]]
    assert rows[0]["messages"] == 0
    assert store.get_thread("threads-nb", made["name"]) == []


def test_threads_have_separate_memory():
    _mk()
    a = store.create_thread("threads-nb", "Pricing")["name"]
    b = store.create_thread("threads-nb", "History")["name"]
    store.append_thread("threads-nb", a, "user", "what does ITER cost?")
    store.append_thread("threads-nb", b, "user", "when did assembly start?")
    assert [m["content"] for m in store.get_thread("threads-nb", a)] == ["what does ITER cost?"]
    assert [m["content"] for m in store.get_thread("threads-nb", b)] == ["when did assembly start?"]


def test_first_question_titles_the_thread():
    _mk()
    name = store.create_thread("threads-nb")["name"]
    assert store.read_thread("threads-nb", name)["title"] == "New chat"
    store.append_thread("threads-nb", name, "user",
                        "Where does ITER's machine assembly actually stand?")
    assert store.read_thread("threads-nb", name)["title"].startswith("Where does ITER")


def test_long_question_is_truncated_to_a_title():
    _mk()
    name = store.create_thread("threads-nb")["name"]
    store.append_thread("threads-nb", name, "user", "word " * 60)
    title = store.read_thread("threads-nb", name)["title"]
    assert len(title) <= 65 and title.endswith("…")


def test_explicit_title_survives_questions():
    _mk()
    name = store.create_thread("threads-nb", "Cost per watt")["name"]
    store.append_thread("threads-nb", name, "user", "a question that should not retitle")
    assert store.read_thread("threads-nb", name)["title"] == "Cost per watt"


def test_list_is_recent_first():
    _mk()
    a = store.create_thread("threads-nb", "First")["name"]
    b = store.create_thread("threads-nb", "Second")["name"]
    store.append_thread("threads-nb", a, "user", "ping the older thread")
    rows = store.list_threads("threads-nb")
    assert rows[0]["name"] == a          # touched most recently
    assert {r["name"] for r in rows} == {a, b}


def test_rename_and_delete():
    _mk()
    name = store.create_thread("threads-nb", "Draft")["name"]
    assert store.rename_thread("threads-nb", name, "  Final name  ")["title"] == "Final name"
    out = store.delete_thread("threads-nb", name)
    assert out["deleted"] == name
    assert store.list_threads("threads-nb") == []


def test_rename_delete_unknown_thread_raise():
    _mk()
    with pytest.raises(ValueError):
        store.rename_thread("threads-nb", "nope", "x")
    with pytest.raises(ValueError):
        store.delete_thread("threads-nb", "nope")


def test_clear_keeps_the_thread_and_its_title():
    _mk()
    name = store.create_thread("threads-nb", "Keep me")["name"]
    store.append_thread("threads-nb", name, "user", "question")
    store.clear_thread("threads-nb", name)
    doc = store.read_thread("threads-nb", name)
    assert doc["title"] == "Keep me" and doc["messages"] == []


def test_legacy_thread_file_is_still_read(tmp_path):
    """A notebook written before thread headers existed must keep working."""
    _mk()
    nb_dir = store._nb_dir("threads-nb") / "threads"
    nb_dir.mkdir(parents=True, exist_ok=True)
    (nb_dir / "default.json").write_text(json.dumps([
        {"role": "user", "content": "an old question about assembly", "ts": "2026-01-01T00:00:00Z"},
        {"role": "assistant", "content": "an old answer", "ts": "2026-01-01T00:00:01Z"},
    ]))
    rows = store.list_threads("threads-nb")
    assert rows[0]["name"] == "default" and rows[0]["messages"] == 2
    assert rows[0]["title"].startswith("an old question")
    store.append_thread("threads-nb", "default", "user", "a new question")
    doc = store.read_thread("threads-nb", "default")
    assert len(doc["messages"]) == 3 and doc["title"].startswith("an old question")


def test_thread_cap_and_count_cap():
    _mk()
    name = store.create_thread("threads-nb")["name"]
    for i in range(store._THREAD_CAP + 6):
        store.append_thread("threads-nb", name, "user", f"q{i}")
    assert len(store.get_thread("threads-nb", name)) == store._THREAD_CAP
    for i in range(store._THREADS_MAX - 1):
        store.create_thread("threads-nb", f"extra {i}")
    with pytest.raises(ValueError):
        store.create_thread("threads-nb", "one too many")


def test_names_are_never_reused():
    _mk()
    a = store.create_thread("threads-nb", "chat")["name"]
    b = store.create_thread("threads-nb", "chat")["name"]
    assert a != b and b.startswith("chat")


# ----------------------------------------------------------------------- api

def test_state_opens_the_requested_thread():
    _mk()
    pytest.importorskip("fastapi")
    from dashboard import plugin_api as api
    name = store.create_thread("threads-nb", "Pricing")["name"]
    store.append_thread("threads-nb", name, "user", "what does it cost?")
    payload = api.state(notebook="threads-nb", thread=name)["notebook"]
    assert payload["thread_name"] == name
    assert payload["thread_title"] == "Pricing"
    assert payload["thread"][0]["content"] == "what does it cost?"
    assert [t["name"] for t in payload["threads"]] == [name]


def test_state_falls_back_when_the_thread_is_gone():
    _mk()
    pytest.importorskip("fastapi")
    from dashboard import plugin_api as api
    name = store.create_thread("threads-nb", "Gone")["name"]
    payload = api.state(notebook="threads-nb", thread=name)["notebook"]
    assert payload["thread_name"] == name
    payload2 = api.state(notebook="threads-nb", thread="not-a-thread")["notebook"]
    assert payload2["thread_name"] == name      # most recent wins


def test_thread_routes():
    _mk()
    pytest.importorskip("fastapi")
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from dashboard import plugin_api

    app = FastAPI()
    app.include_router(plugin_api.router)
    client = TestClient(app)

    made = client.post("/thread/new", json={"notebook": "threads-nb", "title": "Pricing"}).json()
    name = made["thread"]["name"]
    assert made["ok"] and name

    listed = client.get("/threads", params={"notebook": "threads-nb"}).json()
    assert listed["count"] == 1 and listed["threads"][0]["title"] == "Pricing"

    renamed = client.post("/thread/rename",
                          json={"notebook": "threads-nb", "thread": name,
                                "title": "Cost"}).json()
    assert renamed["thread"]["title"] == "Cost"

    guarded = client.post("/thread/delete", json={"notebook": "threads-nb", "thread": name})
    assert guarded.status_code == 400                 # needs confirm
    gone = client.post("/thread/delete",
                       json={"notebook": "threads-nb", "thread": name, "confirm": True}).json()
    assert gone["deleted"] == name
    assert client.get("/threads", params={"notebook": "threads-nb"}).json()["count"] == 0


def test_ask_records_into_the_named_thread(ctx):
    _mk()
    out = json.loads(tools.notebook_ask({
        "notebook": "threads-nb", "question": "what stage is assembly at?",
        "thread": "assembly"}))
    assert out.get("ok", True)
    msgs = store.get_thread("threads-nb", "assembly")
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[0]["content"].startswith("what stage")


def test_threads_tool_actions():
    _mk()
    made = json.loads(tools.notebook_threads({"notebook": "threads-nb", "action": "new",
                                              "title": "Pricing"}))
    name = made["thread"]["name"]
    listed = json.loads(tools.notebook_threads({"notebook": "threads-nb", "action": "list"}))
    assert listed["count"] == 1
    renamed = json.loads(tools.notebook_threads({"notebook": "threads-nb", "action": "rename",
                                                 "thread": name, "title": "Cost"}))
    assert renamed["thread"]["title"] == "Cost"
    gone = json.loads(tools.notebook_threads({"notebook": "threads-nb", "action": "delete",
                                              "thread": name, "confirm": True}))
    assert gone["deleted"] == name


def test_threads_tool_needs_confirm_to_delete():
    _mk()
    name = json.loads(tools.notebook_threads({"notebook": "threads-nb", "action": "new"}))["thread"]["name"]
    with pytest.raises(Exception):
        tools.notebook_threads({"notebook": "threads-nb", "action": "delete", "thread": name})
    assert store.thread_exists("threads-nb", name)
