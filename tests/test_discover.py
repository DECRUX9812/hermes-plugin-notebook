"""The Discover scout: URL canonicalisation, the ranking contract, and the
promise that a discovery pass never writes to the notebook."""

import pytest

from hermes_notebook import discover


@pytest.fixture(autouse=True)
def _bound(ctx):  # noqa: F811 - binds runtime + tmp plugin data for every test
    return ctx


# ------------------------------------------------------------------- urls

def test_canonical_url_drops_tracking_and_fragments():
    a = discover.canonical_url("https://www.Exa.ai/blog/post/?utm_source=x&utm_medium=y#top")
    b = discover.canonical_url("http://exa.ai/blog/post")
    assert a == b == "https://exa.ai/blog/post"


def test_canonical_url_keeps_meaningful_query():
    kept = discover.canonical_url("https://news.ycombinator.com/item?id=42&utm_source=hn")
    assert kept == "https://news.ycombinator.com/item?id=42"


def test_domain_of():
    assert discover.domain_of("https://www.example.co.uk/a/b") == "example.co.uk"
    assert discover.domain_of("") == ""


# --------------------------------------------------------------- ranking

def _row(url, title, snippet="", provider="web"):
    return {"url": url, "title": title, "description": snippet, "provider": provider}


def test_rank_dedupes_the_same_page_and_keeps_first():
    rows = [_row("https://a.com/x?utm_source=1", "Fusion roadmap"),
            _row("https://a.com/x", "Fusion roadmap duplicate")]
    out = discover.rank_candidates(rows, focus_terms=["fusion"])
    assert len(out) == 1
    assert out[0]["domain"] == "a.com"


def test_rank_caps_results_per_domain():
    rows = [_row(f"https://blog.com/{i}", f"Fusion note {i}") for i in range(5)]
    out = discover.rank_candidates(rows, focus_terms=["fusion"], per_domain=2)
    assert len(out) == 2


def test_rank_drops_noise_hosts():
    rows = [_row("https://pinterest.com/pin/1", "Fusion board"),
            _row("https://real.example/b", "Fusion policy")]
    out = discover.rank_candidates(rows, focus_terms=["fusion"])
    assert [r["domain"] for r in out] == ["real.example"]


def test_rank_skips_urls_already_in_the_notebook():
    rows = [_row("https://already.example/doc", "Fusion doc"),
            _row("https://new.example/doc", "Fusion doc")]
    out = discover.rank_candidates(
        rows, existing=["https://already.example/doc"], focus_terms=["fusion"])
    assert [r["domain"] for r in out] == ["new.example"]


def test_rank_prefers_a_title_hit_over_a_body_mention():
    rows = [_row("https://body.example/a", "Some page", "a passing mention of fusion"),
            _row("https://title.example/b", "Fusion deployment timelines")]
    out = discover.rank_candidates(rows, focus_terms=["fusion", "deployment"])
    assert out[0]["domain"] == "title.example"
    assert out[0]["score"] > out[1]["score"]


def test_rank_explains_why_each_row_is_there():
    rows = [_row("https://a.example/x", "Fusion roadmap"),
            _row("https://b.example/y", "Unrelated cooking blog")]
    out = discover.rank_candidates(rows, focus_terms=["fusion"])
    by_domain = {r["domain"]: r for r in out}
    assert "fusion" in by_domain["a.example"]["why"]
    assert by_domain["b.example"]["why"]          # still says something honest


# ------------------------------------------------------------- discovery pass

def test_discover_is_read_only(monkeypatch):
    from hermes_notebook import store
    store.create_notebook("Disc", "test notebook")
    store.add_source("disc", title="Seed", kind="text", origin="pasted text",
                     text="fusion energy policy " * 40, labels=["fusion"])

    before = len(store.list_sources("disc"))

    monkeypatch.setattr(discover, "plan_queries",
                        lambda *a, **k: {"gaps": ["grid interconnection"], "queries": ["fusion grid"]})
    monkeypatch.setattr(discover, "search_all",
                        lambda qs, per_query=6: [
                            _row("https://one.example/a", "Fusion grid interconnection backlog"),
                            _row("https://two.example/b", "Fusion funding roundup"),
                        ])

    out = discover.discover("disc", query="fusion")
    assert out["ok"] is True
    assert out["gaps"] == ["grid interconnection"]
    assert len(out["candidates"]) == 2
    assert len(store.list_sources("disc")) == before          # nothing was added
    assert out["searched"] == 2


def test_discover_falls_back_to_the_notebook_title(monkeypatch):
    from hermes_notebook import store
    store.create_notebook("Disc2", "about tokamaks")
    store.add_source("disc2", title="Seed", kind="text", origin="pasted text",
                     text="tokamak " * 40, labels=["fusion"])
    monkeypatch.setattr(discover, "plan_queries", lambda *a, **k: {"gaps": [], "queries": []})
    seen = {}

    def fake(qs, per_query=6):
        seen["qs"] = qs
        return []
    monkeypatch.setattr(discover, "search_all", fake)

    discover.discover("disc2")
    assert seen["qs"] and "Disc2" in seen["qs"][0]


def test_providers_reports_only_keys_that_exist(monkeypatch):
    monkeypatch.delenv("EXA_API_KEY", raising=False)
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    assert discover.providers() == ["web"]
    monkeypatch.setenv("EXA_API_KEY", "k")
    assert discover.providers() == ["web", "exa"]
