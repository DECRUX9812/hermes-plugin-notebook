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


# ---------------------------------------------------------------- S-numbers

def test_s_numbers_are_rail_order_on_bm25_path(ctx):
    """The regression: BM25 picked only the third source, and the OLD code
    numbered it S1 by emission order — so [S1] in the answer cited a card the
    rail calls S3. Citation numbers are the rail order now, on every path."""
    nb = store.create_notebook("S-number BM25")
    store.add_source(nb["id"], title="Cats", kind="text", origin="",
                     text="Cats sleep all day and purr softly at night. " * 60)
    store.add_source(nb["id"], title="Dogs", kind="text", origin="",
                     text="Dogs need daily walks, training, and affection. " * 60)
    store.add_source(nb["id"], title="ITER", kind="text", origin="",
                     text="The ITER tokamak assembly is 67 percent complete. " * 60)
    out = retrieve.retrieve(nb["id"], "tokamak assembly percent", max_chars=2000)
    assert out["sources_used"], "BM25 found nothing"
    used_ns = {s["n"] for s in out["sources_used"]}
    assert used_ns == {3}, f"only S3 should be cited, got {used_ns}"
    assert "[S3" in out["context"] and "[S1" not in out["context"]


def test_s_numbers_keep_gaps_when_source_disabled(ctx):
    """An unchecked source keeps its number: the rail shows S1 S3, and the
    prompt agrees — it never renumbers S3 down to S2."""
    nb = store.create_notebook("S-number gaps")
    store.add_source(nb["id"], title="Cats", kind="text", origin="",
                     text="Cats sleep all day. " * 40)
    b = store.add_source(nb["id"], title="Dogs", kind="text", origin="",
                         text="Dogs need daily walks. " * 40)
    store.add_source(nb["id"], title="ITER", kind="text", origin="",
                     text="The ITER tokamak is under construction. " * 40)
    store.set_source_enabled(nb["id"], b["id"], False)

    # chunked path
    out = retrieve.retrieve(nb["id"], "tokamak", max_chars=2000)
    assert {s["n"] for s in out["sources_used"]} == {3}
    assert "S2" not in out["context"]

    # full-context path — same numbers, same gap
    out = retrieve.retrieve(nb["id"], "anything", max_chars=100000)
    assert out.get("full_context") is True
    assert {s["n"] for s in out["sources_used"]} == {1, 3}
    assert '<source id="S3"' in out["context"]
    assert '<source id="S2"' not in out["context"]

    # digest labels — cited and uncited agree on the same numbering
    cited = retrieve.notebook_digest(nb["id"], max_chars=100000, cited=True)
    assert "[S3 · ITER" in cited and "[S1 · Cats" in cited
    uncited = retrieve.notebook_digest(nb["id"], max_chars=100000)
    assert "[Source 3: ITER" in uncited and "[Source 1: Cats" in uncited


# -------------------------------------------------------------- digest cache

def test_notebook_digest_is_cached_under_the_notebook(ctx):
    nb_id = _seed(ctx)
    first = retrieve.notebook_digest(nb_id, max_chars=100000)
    cache_dir = store._nb_dir(nb_id) / "cache"
    cached = list(cache_dir.glob("digest-*.txt"))
    assert len(cached) == 1
    assert cached[0].read_text() == first
    # a second call serves the file, byte-identical
    assert retrieve.notebook_digest(nb_id, max_chars=100000) == first


def test_digest_cache_key_tracks_sources_and_budget(ctx):
    nb_id = _seed(ctx)
    retrieve.notebook_digest(nb_id, max_chars=100000)
    retrieve.notebook_digest(nb_id, max_chars=8000)          # different budget
    retrieve.notebook_digest(nb_id, max_chars=100000, cited=True)  # cited flag
    cache_dir = store._nb_dir(nb_id) / "cache"
    assert len(list(cache_dir.glob("digest-*.txt"))) == 3
    # a re-extracted source changes its content hash → new key, new file
    src = store.list_sources(nb_id)[0]
    store.update_source(nb_id, src["id"], text="completely new body " * 100)
    retrieve.notebook_digest(nb_id, max_chars=100000)
    assert len(list(cache_dir.glob("digest-*.txt"))) == 4
    # disabling a source changes the active set → new key
    other = store.list_sources(nb_id)[1]
    store.set_source_enabled(nb_id, other["id"], False)
    retrieve.notebook_digest(nb_id, max_chars=100000)
    assert len(list(cache_dir.glob("digest-*.txt"))) == 5


def test_export_excludes_the_cache_dir(ctx, tmp_path):
    nb_id = _seed(ctx)
    retrieve.notebook_digest(nb_id, max_chars=100000)
    assert (store._nb_dir(nb_id) / "cache").is_dir()
    out = store.export_notebook(nb_id, out_dir=tmp_path / "exports")
    import zipfile
    with zipfile.ZipFile(out["zip"]) as zf:
        names = zf.namelist()
    assert names and not any("/cache/" in n for n in names)
