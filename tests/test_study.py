"""The study scheduler: card identity, queue order, scheduling, and stats."""

import json

import pytest

from hermes_notebook import study, store


def _notebook(ctx, nb_id="fusion", artifacts=None):
    store.create_notebook("Fusion", "test") if "fusion" not in [
        n["id"] for n in store.list_notebooks()] else None
    nbs = [n for n in store.list_notebooks()]
    nb = nbs[0]
    folder = store._nb_dir(nb["id"]) / "artifacts"
    folder.mkdir(parents=True, exist_ok=True)
    for name, payload in (artifacts or {}).items():
        (folder / name).write_text(json.dumps(payload), encoding="utf-8")
    return nb["id"]


DECK = {
    "20260101-000001-flashcards.json": {"cards": [
        {"front": "What is ITER's 'six of nine'?", "back": "Sector modules installed.", "source": "ITER"},
        {"front": "What does FIA count?", "back": "$4.48B raised to July 2026.", "source": "Reuters"},
    ]},
    "20260101-000002-quiz.json": {"questions": [
        {"question": "Which body counts $4.48B?", "choices": ["IAEA", "FIA", "CRS", "DOE"],
         "answer": "FIA", "explanation": "Reuters reports the FIA figure."},
    ]},
}


def test_deck_collects_flashcards_and_quiz(ctx):
    nb = _notebook(ctx, artifacts=DECK)
    deck = study.build_deck(nb)
    assert len(deck) == 3
    kinds = sorted(c["kind"] for c in deck)
    assert kinds == ["flash", "flash", "quiz"]
    quiz = [c for c in deck if c["kind"] == "quiz"][0]
    assert quiz["choices"][0] == "IAEA" and quiz["explanation"]


def test_card_ids_are_content_stable(ctx):
    """Regenerating a deck must keep the schedule for the questions that survived."""
    nb = _notebook(ctx, artifacts=DECK)
    first = {c["front"]: c["id"] for c in study.build_deck(nb)}
    again = {c["front"]: c["id"] for c in study.build_deck(nb)}
    assert first == again
    assert study.card_id("flash", "What is ITER's 'six of nine'?") == study.card_id(
        "flash", "  what is iters six of nine  ")


def test_queue_puts_new_cards_before_scheduled_ones(ctx):
    nb = _notebook(ctx, artifacts=DECK)
    q = study.queue(nb, limit=10)
    assert len(q) == 3
    assert all(c["phase"] == "new" for c in q)


def test_review_schedules_and_persists(ctx):
    nb = _notebook(ctx, artifacts=DECK)
    card = study.build_deck(nb)[0]
    out = study.review(nb, card["id"], "good")
    assert out["ok"] and out["reps"] == 1
    assert out["interval_days"] >= 1.0
    assert out["next_in"] > 0.5
    saved = study.load_state(nb)
    assert card["id"] in saved["cards"]

    # a second visit: the card is no longer due, so the queue does not offer it
    queue_ids = [c["id"] for c in study.queue(nb, limit=10)]
    assert card["id"] not in queue_ids


def test_again_puts_the_card_back_within_a_minute(ctx):
    nb = _notebook(ctx, artifacts=DECK)
    card = study.build_deck(nb)[0]
    study.review(nb, card["id"], "good")
    out = study.review(nb, card["id"], "again")
    assert out["phase"] in ("due", "learning")
    assert out["next_in"] < 0.01
    assert out["lapses"] == 1
    state = study.load_state(nb)
    assert state["cards"][card["id"]]["interval"] == 0


def test_easy_grows_interval_faster_than_good(ctx):
    nb = _notebook(ctx, artifacts=DECK)
    a, b = study.build_deck(nb)[:2]
    good = study.review(nb, a["id"], "good")
    easy = study.review(nb, b["id"], "easy")
    assert easy["interval_days"] > good["interval_days"]


def test_review_rejects_unknown_card_and_bad_rating(ctx):
    nb = _notebook(ctx, artifacts=DECK)
    with pytest.raises(ValueError):
        study.review(nb, "nope", "good")
    card = study.build_deck(nb)[0]
    with pytest.raises(ValueError):
        study.review(nb, card["id"], "perfect")


def test_stats_counts_phases_today_and_streak(ctx):
    nb = _notebook(ctx, artifacts=DECK)
    deck = study.build_deck(nb)
    study.review(nb, deck[0]["id"], "good")
    st = study.stats(nb)
    assert st["cards"] == 3
    assert st["reviews_today"] == 1
    assert st["streak"] == 1
    assert st["counts"]["new"] == 2
    assert st["due"] == 2
    assert st["mastered_pct"] == 0.0


def test_mastered_cards_leave_the_queue_until_due(ctx):
    nb = _notebook(ctx, artifacts=DECK)
    card = study.build_deck(nb)[0]
    state = study.load_state(nb)
    state["cards"][card["id"]] = {"ease": 2.5, "interval": 30.0,
                                  "due": study._now() + 20 * 86400, "reps": 4,
                                  "lapses": 0, "last": study._now(), "again": 0, "good": 4}
    study._save_state(nb, state)
    st = study.stats(nb)
    assert st["counts"]["mastered"] == 1
    assert card["id"] not in [c["id"] for c in study.queue(nb, 10)]
