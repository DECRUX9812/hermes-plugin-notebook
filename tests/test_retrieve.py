"""Retrieval: chunking, BM25-ish scoring, citation assembly."""

from hermes_notebook import retrieve, store


def _seed(ctx):
    nb = store.create_notebook("Retrieval Test")
    store.add_source(nb["id"], title="Cats", kind="text", origin="",
                     text="Cats are wonderful companions. Cats sleep most of the day. " * 30)
    store.add_source(nb["id"], title="Dogs", kind="text", origin="",
                     text="Dogs are loyal animals. Dogs need daily walks and training. " * 30)
    return nb["id"]


def test_chunk_text_respects_size_and_overlap():
    text = "word " * 2000
    chunks = retrieve.chunk_text(text, size=500, overlap=50)
    assert len(chunks) > 3
    assert all(len(c) <= 520 for c in chunks)
    # overlap: consecutive chunks share a tail/head
    assert chunks[0][-30:] in chunks[1] or chunks[1][:30] in chunks[0]


def test_chunk_text_small_and_empty():
    assert retrieve.chunk_text("") == []
    assert retrieve.chunk_text("short") == ["short"]


def test_retrieve_ranks_relevant_source_first(ctx):
    nb_id = _seed(ctx)
    # small budget forces the chunked BM25 path — full-context only engages
    # when every active source fits the caller's context window
    out = retrieve.retrieve(nb_id, "how much do cats sleep?", max_chars=2000)
    assert out["context"]
    # the Cats source should be citation S1
    assert out["sources_used"][0]["title"] == "Cats"
    assert "[S1" in out["context"]
    assert out["sources_used"][0]["n"] == 1


def test_retrieve_full_context_when_sources_fit(ctx):
    nb_id = _seed(ctx)
    out = retrieve.retrieve(nb_id, "anything at all", max_chars=100000)
    assert out.get("full_context") is True
    assert '<source id="S1"' in out["context"] and "</source>" in out["context"]
    # every active source is injected whole and citable — zero loss
    assert {s["title"] for s in out["sources_used"]} == {"Cats", "Dogs"}
    assert "Cats sleep most of the day" in out["context"]
    assert "Dogs need daily walks" in out["context"]


def test_cited_sources_filters_to_marked(ctx):
    used = [{"n": 1, "title": "A"}, {"n": 2, "title": "B"}, {"n": 3, "title": "C"}]
    assert [s["title"] for s in retrieve.cited_sources(used, "see [S1] and [S3]")] == ["A", "C"]
    # unmarked answers keep the full set rather than dropping provenance
    assert len(retrieve.cited_sources(used, "no markers here")) == 3


def test_retrieve_only_ids_scopes_sources(ctx):
    nb_id = _seed(ctx)
    dogs = [s for s in store.list_sources(nb_id) if s["title"] == "Dogs"][0]
    out = retrieve.retrieve(nb_id, "cats sleep", only_ids=[dogs["id"]])
    titles = {s["title"] for s in out["sources_used"]}
    assert titles == {"Dogs"}


def test_retrieve_empty_notebook(ctx):
    nb = store.create_notebook("Empty")
    out = retrieve.retrieve(nb["id"], "anything")
    assert out["context"] == "" and out["sources_used"] == []


def test_notebook_digest_covers_all_sources(ctx):
    nb_id = _seed(ctx)
    digest = retrieve.notebook_digest(nb_id, max_chars=100000)
    assert "Cats" in digest and "Dogs" in digest
    assert "Source 1" in digest and "Source 2" in digest
