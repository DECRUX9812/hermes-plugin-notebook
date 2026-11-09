"""Tensions: the deterministic independence check, and the citation guard.

The model half cannot be tested without a model, so what is pinned here is
everything the model is NOT trusted with: the text-overlap measurement, and the
rule that a position citing a source that does not exist is dropped rather than
repaired.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from hermes_notebook import store, tensions  # noqa: E402

WIRE = (
    "The Fusion Industry Association said private fusion companies raised "
    "4.48 billion dollars in the twelve months to July 2026, bringing cumulative "
    "investment since 2021 to 14.24 billion dollars. The association publishes "
    "the figure annually and surveys member companies directly, counting disclosed "
    "funding rounds and announced government co-investment."
)
OTHER = (
    "ITER lowered its sixth of nine tokamak sector modules into the pit on 28 July "
    "2026, a module weighing roughly 1100 tonnes. The lift took thirty hours and "
    "brought two-thirds of the torus core into place, six months ahead of the "
    "assembly schedule the organisation published in 2024."
)


@pytest.fixture()
def nb(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    monkeypatch.setattr(store, "_root", lambda: tmp_path / "notebooks")
    meta = store.create_notebook("Independence fixture")
    return meta["id"]


def _add(nb_id: str, title: str, text: str) -> dict:
    return store.add_source(nb_id, title=title, kind="text", origin="", text=text)


def test_identical_ledes_collapse_into_one_cluster(nb):
    a = _add(nb, "Wire copy A", WIRE)
    b = _add(nb, "Wire copy B", WIRE)
    _add(nb, "ITER release", OTHER)
    out = tensions.independence(nb)
    assert out["measured"] is True
    assert out["sources"] == 3
    assert out["independent"] == 2, out
    cluster = out["clusters"][0]
    assert len(cluster["members"]) == 2
    assert set(cluster["members"]) == {1, 2}, cluster
    assert a and b  # both ingested


def test_unrelated_sources_stay_independent(nb):
    _add(nb, "FIA funding", WIRE)
    _add(nb, "ITER assembly", OTHER)
    out = tensions.independence(nb)
    assert out["sources"] == 2
    assert out["independent"] == 2
    assert out["clusters"] == []


def test_a_single_source_cannot_be_a_cluster(nb):
    _add(nb, "only source", WIRE)
    out = tensions.independence(nb)
    assert out["independent"] == 1 and out["clusters"] == []


def test_disabled_sources_are_not_counted(nb):
    a = _add(nb, "FIA funding", WIRE)
    b = _add(nb, "Wire copy", WIRE)
    store.set_source_enabled(nb, b["id"], False)
    out = tensions.independence(nb)
    assert out["sources"] == 1, out
    assert a


def test_positions_without_a_real_source_are_dropped():
    item = {
        "topic": "cost",
        "sides": [
            {"claim": "cheap", "sources": [1, 99]},
            {"claim": "expensive", "sources": []},
        ],
    }
    cleaned = tensions._clean_item(item, count=3)
    assert cleaned is None, "a position with no valid source must not survive"
    item["sides"][1]["sources"] = [2]
    cleaned = tensions._clean_item(item, count=3)
    assert cleaned is not None
    assert cleaned["sides"][0]["sources"] == [1], "99 is not a source that exists"


def test_one_side_is_not_a_tension():
    item = {"topic": "x", "sides": [{"claim": "only one position", "sources": [1]}]}
    assert tensions._clean_item(item, count=5) is None


def test_analyze_refuses_fewer_than_two_sources(nb):
    _add(nb, "one", WIRE)
    with pytest.raises(ValueError):
        tensions.analyze(nb)


def test_overlap_is_symmetric_and_bounded():
    assert tensions._overlap(WIRE, WIRE) == 1.0
    assert tensions._overlap(WIRE, OTHER) < tensions.SYNDICATION_THRESHOLD
    assert tensions._overlap(WIRE, OTHER) == tensions._overlap(OTHER, WIRE)
    assert tensions._overlap("", WIRE) == 0.0
