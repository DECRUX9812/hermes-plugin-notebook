"""Spaced repetition over the notebook's own study artifacts.

The plugin already generates flashcards and quizzes. Those were read-only: nothing
remembered whether a card had been answered, so "study" meant re-reading a deck you
already knew. This module keeps a per-card schedule in the notebook directory, so a
flashcard becomes a card you can *fail*, and the queue is ordered by what you are
about to forget rather than by file order.

The scheduler is SM-2 lite:

    again  interval 0, ease -0.20, lapses +1      (seen in a minute)
    hard   interval max(1, iv * 1.2), ease -0.15
    good   interval max(1, iv * ease), ease ~flat
    easy   interval max(2, iv * ease * 1.3), ease +0.15

Every review is persisted as ISO timestamps, so the same schedule is visible to the
desktop page, to the CLI and to an agent through ``notebook_study``.

Card identity is content-derived (kind + normalised prompt), so regenerating a deck
keeps the schedule for the cards that survived and drops the ones that did not.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

from . import store

STATE_FILE = "study.json"
RATINGS = ("again", "hard", "good", "easy")
MASTERED_INTERVAL_DAYS = 21.0
_DAY = 86400.0


def _now() -> float:
    return time.time()


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).replace(microsecond=0).isoformat()


def _state_path(notebook_id: str) -> Path:
    return store._nb_dir(notebook_id) / STATE_FILE


def _norm(text: Any) -> str:
    """Case, apostrophes, punctuation and spacing must not change a card's identity —
    "ITER's" and "iters" are the same question."""
    t = str(text or "").lower().replace("’", "").replace("'", "").replace("`", "")
    return re.sub(r"[^a-z0-9 ]+", " ", t).strip()


def card_id(kind: str, prompt: str) -> str:
    """Stable across regeneration: the same question is the same card."""
    digest = hashlib.sha1(f"{kind}:{_norm(prompt)}".encode("utf-8")).hexdigest()
    return digest[:12]


def _artifact_jsons(notebook_id: str) -> Iterable[dict]:
    folder = store._nb_dir(notebook_id) / "artifacts"
    if not folder.exists():
        return []
    out = []
    for path in sorted(folder.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(data, dict):
            out.append(data)
    return out


def build_deck(notebook_id: str) -> list[dict]:
    """Every flashcard and quiz question in the notebook, newest artifact wins."""
    cards: dict[str, dict] = {}
    for data in _artifact_jsons(notebook_id):
        for c in data.get("cards") or []:
            front = str(c.get("front") or "").strip()
            back = str(c.get("back") or "").strip()
            if not front or not back:
                continue
            cid = card_id("flash", front)
            cards[cid] = {
                "id": cid, "kind": "flash", "front": front, "back": back,
                "source": str(c.get("source") or "").strip(),
            }
        for q in data.get("questions") or []:
            question = str(q.get("question") or "").strip()
            answer = str(q.get("answer") or "").strip()
            if not question or not answer:
                continue
            cid = card_id("quiz", question)
            cards[cid] = {
                "id": cid, "kind": "quiz", "front": question,
                "back": answer, "source": "",
                "choices": [str(x) for x in (q.get("choices") or [])][:6],
                "explanation": str(q.get("explanation") or "").strip(),
            }
    return list(cards.values())


def load_state(notebook_id: str) -> dict:
    raw = store._read_json(_state_path(notebook_id), {})
    if not isinstance(raw, dict):
        return {"cards": {}, "days": {}}
    cards = raw.get("cards")
    return {"cards": cards if isinstance(cards, dict) else {},
            "days": raw.get("days") if isinstance(raw.get("days"), dict) else {}}


def _save_state(notebook_id: str, state: dict) -> None:
    path = _state_path(notebook_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=1, sort_keys=True), encoding="utf-8")


def _card_state(entry: Any) -> dict:
    if not isinstance(entry, dict):
        return {"ease": 2.5, "interval": 0.0, "due": 0.0, "reps": 0,
                "lapses": 0, "last": 0.0, "again": 0, "good": 0}
    return {
        "ease": float(entry.get("ease") or 2.5),
        "interval": float(entry.get("interval") or 0.0),
        "due": float(entry.get("due") or 0.0),
        "reps": int(entry.get("reps") or 0),
        "lapses": int(entry.get("lapses") or 0),
        "last": float(entry.get("last") or 0.0),
        "again": int(entry.get("again") or 0),
        "good": int(entry.get("good") or 0),
    }


def phase(entry: Any, now: float | None = None) -> str:
    """new (never answered) · due · learning (<1 day) · young · mastered."""
    now = _now() if now is None else now
    st = _card_state(entry)
    if not st["reps"]:
        return "new"
    if st["interval"] >= MASTERED_INTERVAL_DAYS:
        return "mastered"
    if st["due"] <= now:
        return "due"
    if st["interval"] < 1.0:
        return "learning"
    return "young"


def queue(notebook_id: str, limit: int = 12, now: float | None = None) -> list[dict]:
    """Due cards first (most overdue first), then new ones, then the soonest due."""
    now = _now() if now is None else now
    deck = build_deck(notebook_id)
    state = load_state(notebook_id)
    rows = []
    for card in deck:
        entry = state["cards"].get(card["id"])
        st = _card_state(entry)
        ph = phase(entry, now)
        # a scheduled card that is not due yet is not part of today's session: a
        # queue that offers tomorrow's cards is a flashcard list, not a schedule
        if ph in ("young", "mastered"):
            continue
        rows.append({**card, "phase": ph, "due": st["due"], "interval": st["interval"],
                     "reps": st["reps"], "lapses": st["lapses"],
                     "overdue": max(0.0, now - st["due"]) if st["reps"] else 0.0})
    rows.sort(key=lambda r: (
        0 if r["phase"] == "due" else 1 if r["phase"] == "learning" else 2 if r["phase"] == "new" else 3,
        -r["overdue"],
        r["due"],
    ))
    return rows[: max(1, min(int(limit or 12), 60))]


def review(notebook_id: str, cid: str, rating: str, now: float | None = None) -> dict:
    """Apply one rating and return the card's new schedule."""
    rating = str(rating or "").strip().lower()
    if rating not in RATINGS:
        raise ValueError(f"rating must be one of {', '.join(RATINGS)}")
    now = _now() if now is None else now
    deck = {c["id"]: c for c in build_deck(notebook_id)}
    if cid not in deck:
        raise ValueError("that card is not in this notebook's deck any more")
    state = load_state(notebook_id)
    st = _card_state(state["cards"].get(cid))

    if rating == "again":
        st["interval"] = 0.0
        st["ease"] = max(1.3, st["ease"] - 0.20)
        st["lapses"] += 1
        st["due"] = now + 60.0
        st["again"] += 1
    elif rating == "hard":
        st["interval"] = max(1.0, (st["interval"] or 0.5) * 1.2)
        st["ease"] = max(1.3, st["ease"] - 0.15)
        st["due"] = now + st["interval"] * _DAY
        st["good"] += 0  # a hard pass is not evidence of knowing
    elif rating == "good":
        st["interval"] = max(1.0, (st["interval"] or 1.0) * st["ease"])
        st["due"] = now + st["interval"] * _DAY
        st["good"] += 1
    else:  # easy
        st["interval"] = max(2.0, (st["interval"] or 1.0) * st["ease"] * 1.3)
        st["ease"] = min(3.2, st["ease"] + 0.15)
        st["due"] = now + st["interval"] * _DAY
        st["good"] += 1

    st["reps"] += 1
    st["last"] = now
    state["cards"][cid] = st
    day = datetime.fromtimestamp(now, tz=timezone.utc).strftime("%Y-%m-%d")
    days = state.setdefault("days", {})
    bucket = days.get(day) if isinstance(days.get(day), dict) else {}
    bucket[rating] = int(bucket.get(rating) or 0) + 1
    days[day] = bucket
    _save_state(notebook_id, state)

    return {
        "ok": True, "card": cid, "rating": rating,
        "phase": phase(st, now), "due": _iso(st["due"]),
        "interval_days": round(st["interval"], 2),
        "ease": round(st["ease"], 2), "reps": st["reps"], "lapses": st["lapses"],
        "next_in": (st["due"] - now) / _DAY,
    }


def stats(notebook_id: str, now: float | None = None) -> dict:
    """What the notebook's memory looks like: counts per phase, today, streak."""
    now = _now() if now is None else now
    deck = build_deck(notebook_id)
    state = load_state(notebook_id)
    counts = {"new": 0, "due": 0, "learning": 0, "young": 0, "mastered": 0}
    for card in deck:
        entry = state["cards"].get(card["id"])
        ph = phase(entry, now)
        if ph == "mastered" and _card_state(entry)["due"] > now:
            counts["mastered"] += 1
        elif ph == "mastered":
            counts["due"] += 1   # mastered but forgotten: back in the queue
        else:
            counts[ph] = counts.get(ph, 0) + 1

    days = state.get("days") or {}
    today = datetime.fromtimestamp(now, tz=timezone.utc).strftime("%Y-%m-%d")
    today_bucket = days.get(today) or {}
    reviews_today = sum(int(v or 0) for v in today_bucket.values()) if isinstance(today_bucket, dict) else 0

    streak = 0
    cursor = datetime.fromtimestamp(now, tz=timezone.utc).date()
    for _ in range(400):
        key = cursor.strftime("%Y-%m-%d")
        if (days.get(key) or {}) and sum(int(v or 0) for v in days[key].values()):
            streak += 1
            cursor = cursor - timedelta(days=1)
        else:
            break

    return {
        "ok": True, "notebook": notebook_id, "cards": len(deck),
        "due": counts["due"] + counts["new"],
        "counts": counts, "reviews_today": reviews_today, "streak": streak,
        "mastered_pct": round(100.0 * counts["mastered"] / len(deck), 1) if deck else 0.0,
        "days_studied": len([d for d, b in days.items() if isinstance(b, dict) and sum(int(v or 0) for v in b.values())]),
    }
