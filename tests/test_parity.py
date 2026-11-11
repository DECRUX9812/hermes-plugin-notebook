"""Feature-parity tools: search, notes, refresh, delete_source, update,
export, discover, chat threads, slides/infographic/csv artifacts."""

import json

import pytest

from hermes_notebook import artifacts, ingest, retrieve, store, tools


@pytest.fixture(autouse=True)
def _bound(ctx):  # noqa: F811 - binds runtime + tmp plugin data for every test
    return ctx


def _mk(nb="feat-nb", sources=True):
    store.create_notebook("Feat NB", "desc")
    if sources:
        store.add_source("feat-nb", title="Alpha Doc", kind="text",
                         origin="pasted text", text="The mitochondria is the powerhouse of the cell. " * 20,
                         labels=["bio"], summary="cell bio")
        store.add_source("feat-nb", title="Beta Doc", kind="text",
                         origin="pasted text", text="The Bastille fell on July 14 1789. " * 20,
                         labels=["history"], summary="rev")


# --------------------------------------------------------------- store bits

def test_update_meta_rename():
    _mk()
    meta = store.update_meta("feat-nb", title="New Title", description="new desc")
    assert meta["title"] == "New Title" and meta["description"] == "new desc"
    assert store.get_meta("feat-nb")["title"] == "New Title"


def test_thread_roundtrip_and_cap():
    _mk(sources=False)
    store.append_thread("feat-nb", "t1", "user", "q1")
    store.append_thread("feat-nb", "t1", "assistant", "a1")
    msgs = store.get_thread("feat-nb", "t1")
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    for i in range(40):
        store.append_thread("feat-nb", "t1", "user", f"q{i}")
    assert len(store.get_thread("feat-nb", "t1")) == store._THREAD_CAP


def test_export_zip(tmp_path):
    _mk()
    out = store.export_notebook("feat-nb", out_dir=tmp_path)
    assert out["files"] >= 3 and out["zip"].endswith(".zip")
    import zipfile
    names = zipfile.ZipFile(out["zip"]).namelist()
    assert any("notebook.json" in n for n in names)
    assert any("index.json" in n for n in names)


def test_dedupe_hash():
    _mk(sources=False)
    store.add_source("feat-nb", title="Doc", kind="text", origin="x",
                     text="Same   content\n\nhere")
    dup = store.find_source_by_hash("feat-nb", store.content_hash("same content here"))
    assert dup is not None and dup["title"] == "Doc"


# --------------------------------------------------------------- tools

def test_search_tool():
    _mk()
    out = json.loads(tools.notebook_search({"notebook": "feat-nb", "query": "mitochondria"}))
    assert out["ok"] and out["hits"]
    assert out["hits"][0]["title"] == "Alpha Doc"
    assert "mitochondria" in out["hits"][0]["snippet"].lower()


def test_note_tool_and_dedupe():
    _mk()
    out = json.loads(tools.notebook_note({"notebook": "feat-nb", "text": "Remember: exam Friday"}))
    assert out["ok"] and out["kind"] == "note"
    kinds = {s["kind"] for s in store.list_sources("feat-nb")}
    assert "note" in kinds
    # identical note again → skipped duplicate
    out2 = json.loads(tools.notebook_note({"notebook": "feat-nb", "text": "Remember: exam Friday"}))
    assert out2.get("skipped") == "duplicate"
    # note is searchable
    res = retrieve.search("feat-nb", "exam friday")
    assert any(h["kind"] == "note" for h in res["hits"])


def test_ask_with_thread_uses_history():
    _mk()
    # pre-seed a thread then ask with it — fake llm returns canned text
    store.append_thread("feat-nb", "main", "user", "earlier question")
    store.append_thread("feat-nb", "main", "assistant", "earlier answer")
    out = json.loads(tools.notebook_ask({"notebook": "feat-nb", "question": "what is the powerhouse?", "thread": "main"}))
    assert out["ok"] and out.get("thread") == "main"
    msgs = store.get_thread("feat-nb", "main")
    assert msgs[-2]["content"] == "what is the powerhouse?"
    assert msgs[-1]["role"] == "assistant"


def test_delete_source_tool():
    _mk()
    out = json.loads(tools.notebook_delete_source({"notebook": "feat-nb", "source_id": "alpha-doc"}))
    assert out["ok"] and out["removed"] == "alpha-doc"
    assert all(s["id"] != "alpha-doc" for s in store.list_sources("feat-nb"))
    assert not store.source_text_path("feat-nb", "alpha-doc").exists()


def test_update_tool():
    _mk()
    out = json.loads(tools.notebook_update({"notebook": "feat-nb", "title": "Renamed"}))
    assert out["ok"] and out["title"] == "Renamed"


def test_export_tool():
    _mk()
    out = json.loads(tools.notebook_export({"notebook": "feat-nb"}))
    assert out["ok"] and out["zip"].endswith(".zip") and out["files"] >= 3


def test_discover_tool(monkeypatch):
    _mk()
    # real web_search shape: {"success": true, "data": {"web": [...]}}
    monkeypatch.setattr(tools.runtime, "dispatch", lambda t, a, **k: json.dumps({
        "success": True,
        "data": {"web": [{"title": "Cool Page", "url": "https://x.com/a",
                          "description": "great read", "position": 1},
                         {"title": "Already Have", "url": "pasted text", "position": 2}]}}))
    out = json.loads(tools.notebook_discover({"notebook": "feat-nb", "query": "cell bio"}))
    assert out["ok"]
    urls = [c["url"] for c in out["candidates"]]
    assert "https://x.com/a" in urls
    assert out["candidates"][0]["snippet"] == "great read"


def test_discover_surfaces_search_failure(monkeypatch):
    _mk()
    monkeypatch.setattr(tools.runtime, "dispatch", lambda t, a, **k: json.dumps(
        {"success": False, "error": "no provider configured"}))
    with pytest.raises(RuntimeError, match="no provider"):
        tools.notebook_discover({"notebook": "feat-nb", "query": "x"})


def test_refresh_source_text_kind_errors():
    _mk()
    # pasted-text source has no locator → clear error
    with pytest.raises(ValueError):
        ingest.refresh_source("feat-nb", "alpha-doc")


# --------------------------------------------------------------- artifacts

def test_slides_html_render():
    data = {"title": "Deck", "slides": [
        {"title": "Intro", "bullets": ["point one", "point two"]},
        {"title": "Deep", "bullets": ["detail"], "note": "speaker note"}]}
    html = artifacts._render_slides_html(data, "My NB")
    assert "Intro" in html and "point one" in html and "ArrowRight" in html
    assert html.count('class="slide') == 2


def test_flashcards_csv_render():
    data = {"cards": [{"front": "Q?", "back": "A.", "source": "Doc"}]}
    csv_text = artifacts._render_flashcards_csv(data)
    assert csv_text.splitlines()[0] == "front,back,source"
    assert "Q?,A.,Doc" in csv_text


def test_infographic_render():
    pytest.importorskip("PIL")
    data = {"title": "Stats", "takeaway": "big picture",
            "stats": [{"value": "1789", "label": "revolution"}],
            "quotes": [{"text": "a fact", "source": "Doc"}]}
    svg = artifacts._render_infographic(data, "T")
    assert 'viewBox="0 0 1200 900"' in svg and "1789" in svg


def test_generate_accepts_new_kinds_in_schema():
    from hermes_notebook import schemas
    kinds = schemas.NOTEBOOK_GENERATE["parameters"]["properties"]["kind"]["enum"]
    assert "slides" in kinds and "infographic" in kinds
    names = {s["name"] for s in schemas.ALL}
    # every declared tool must be a real handler and vice versa; a count alone
    # lets a schema drift in and an implementation drift out
    from hermes_notebook import tools
    assert names == set(tools.HANDLERS), sorted(names ^ set(tools.HANDLERS))
    assert "notebook_threads" in names
    assert {"notebook_study", "notebook_tensions"} <= names
