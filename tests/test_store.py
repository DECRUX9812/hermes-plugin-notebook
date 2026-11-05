"""Store: notebook CRUD, source index/text, resolution rules."""

import json

import pytest

from hermes_notebook import store


def test_create_and_list_notebook(ctx):
    meta = store.create_notebook("Q3 Earnings", "quarterly deep-dive")
    assert meta["id"] == "q3-earnings"
    nbs = store.list_notebooks()
    assert [n["id"] for n in nbs] == ["q3-earnings"]
    assert nbs[0]["title"] == "Q3 Earnings"
    assert nbs[0]["sources"] == 0


def test_duplicate_titles_get_unique_ids(ctx):
    a = store.create_notebook("Research")
    b = store.create_notebook("Research")
    assert a["id"] != b["id"]
    assert {n["id"] for n in store.list_notebooks()} == {a["id"], b["id"]}


def test_resolve_by_id_title_and_substring(ctx):
    store.create_notebook("Alpha Project")
    store.create_notebook("Beta Study")
    assert store.resolve_notebook("alpha-project") == "alpha-project"
    assert store.resolve_notebook("Alpha Project") == "alpha-project"
    assert store.resolve_notebook("alpha") == "alpha-project"
    with pytest.raises(KeyError):
        store.resolve_notebook("nonexistent-thing")
    with pytest.raises(ValueError):
        store.resolve_notebook("")  # no notebooks default, >1 notebook → ambiguous-ish error


def test_single_notebook_resolves_empty_arg(ctx):
    store.create_notebook("Only One")
    assert store.resolve_notebook("") == "only-one"


def test_add_source_writes_index_and_text(ctx):
    nb = store.create_notebook("Docs")
    rec = store.add_source(nb["id"], title="Paper", kind="pdf", origin="/tmp/paper.pdf",
                           text="hello world", labels=["ml"], summary="about ml")
    assert rec["id"] == "paper"
    sources = store.list_sources(nb["id"])
    assert len(sources) == 1 and sources[0]["chars"] == 11
    assert store.read_source_text(nb["id"], sources[0]) == "hello world"
    pairs = store.all_source_texts(nb["id"])
    assert pairs[0][1] == "hello world"


def test_source_id_dedup(ctx):
    nb = store.create_notebook("Docs")
    a = store.add_source(nb["id"], title="Same", kind="text", origin="", text="one")
    b = store.add_source(nb["id"], title="Same", kind="text", origin="", text="two")
    assert a["id"] != b["id"]
    assert store.get_source(nb["id"], b["id"])["chars"] == 3


def test_remove_and_delete_notebook(ctx):
    nb = store.create_notebook("Doomed")
    store.add_source(nb["id"], title="x", kind="text", origin="", text="data")
    store.remove_source(nb["id"], "x")
    assert store.list_sources(nb["id"]) == []
    out = store.delete_notebook(nb["id"])
    assert out["deleted"] == nb["id"]
    assert store.list_notebooks() == []
    assert not store._nb_dir(nb["id"]).exists()


def test_artifact_listing(ctx, tmp_path):
    nb = store.create_notebook("Art")
    d = store._nb_dir(nb["id"]) / "artifacts"
    d.mkdir(parents=True, exist_ok=True)
    (d / "a.md").write_text("# hi")
    arts = store.list_artifacts(nb["id"])
    assert arts[0]["name"] == "a.md"
    with pytest.raises(ValueError):
        store.artifact_path(nb["id"], "../escape.md")
