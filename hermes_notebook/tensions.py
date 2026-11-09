"""Tensions — where a notebook's sources disagree, and how independent they are.

NotebookLM answers questions. It never tells you the one thing a researcher
actually needs before trusting an answer: *do these sources agree?* A notebook
built from six pages that all reprint one wire story looks like six
confirmations and is really one. This module answers both:

1. **Conflict** — ask the model to find genuine disagreements across the
   sources, each side quoted and cited back to a real ``[S<n>]``. Every item is
   checked against the source list before it is returned: a citation to a
   source that does not exist is dropped, not repaired. If the model finds
   nothing, the answer is "nothing", never an invented tension.

2. **Independence** — a deterministic pass that groups sources by how much of
   their opening text they share. Three syndicated copies of one story become
   one cluster with three members, so the page can say "6 sources, 4
   independent" instead of implying six independent confirmations. No model
   involved: text overlap is measurable, so it is measured.

The two are independent by design — the deterministic half still reports when
the model is unavailable, and the model half never contradicts the measured
clusters.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from . import llmio, retrieve, runtime, store

#: How much opening text two sources must share to count as the same story.
#: 0.62 calibrated on syndicated wire copy (0.8+) vs two articles on one
#: subject (0.2-0.35), so the line sits in empty space rather than near either.
SYNDICATION_THRESHOLD = 0.62
_CLUSTER_WINDOW = 2400


_TENSIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string",
                              "description": "what the sources disagree about, <= 10 words"},
                    "sides": {
                        "type": "array",
                        "description": "two or more positions, each with the source numbers holding it",
                        "items": {
                            "type": "object",
                            "properties": {
                                "claim": {"type": "string",
                                          "description": "the position in one sentence"},
                                "sources": {"type": "array", "items": {"type": "integer"},
                                            "description": "source numbers (S<n>) that say this"},
                                "quote": {"type": "string",
                                          "description": "<= 30 words copied from one of those sources"},
                            },
                            "required": ["claim", "sources"],
                        },
                    },
                    "why": {"type": "string",
                           "description": "why the disagreement matters to a reader, <= 25 words"},
                    "resolution": {"type": "string",
                                   "description": "which side looks better supported and why — or 'unresolved: ...' when the sources do not settle it"},
                },
                "required": ["topic", "sides"],
            },
        },
        "agreements": {
            "type": "array",
            "description": "claims at least two independent sources state the same way — the stable ground",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "sources": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["claim", "sources"],
            },
        },
    },
    "required": ["items"],
}


def _shingles(text: str, size: int = 8) -> set[str]:
    words = re.findall(r"\w+", text.lower())
    if len(words) < size:
        return {" ".join(words)} if words else set()
    return {" ".join(words[i:i + size]) for i in range(len(words) - size + 1)}


def _overlap(a: str, b: str) -> float:
    """Jaccard over 8-word shingles of the opening text.

    Opening text only: syndicated copies repeat the lede verbatim and diverge
    later, while two pieces on one topic share vocabulary throughout. Comparing
    the whole files would blur exactly the signal being measured."""
    sa, sb = _shingles(a[:_CLUSTER_WINDOW]), _shingles(b[:_CLUSTER_WINDOW])
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def independence(notebook_id: str) -> Dict[str, Any]:
    """Group sources that are copies of one story. Deterministic, no model."""
    pairs = store.all_source_texts(notebook_id)
    off = store.disabled_sources(notebook_id)
    if off:
        pairs = [(r, t) for r, t in pairs if r.get("id") not in off]
    if not pairs:
        return {"sources": 0, "independent": 0, "clusters": [], "measured": False}

    # Number them exactly as the page does, so a cluster's members are the
    # same S<n> the citations use.
    numbered = [(i, r, t) for i, (r, t) in enumerate(pairs, 1)]
    parent = {i: i for i, _, _ in numbered}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a in range(len(numbered)):
        for b in range(a + 1, len(numbered)):
            ia, _, ta = numbered[a]
            ib, _, tb = numbered[b]
            if _overlap(ta, tb) >= SYNDICATION_THRESHOLD:
                ra, rb = find(ia), find(ib)
                if ra != rb:
                    parent[rb] = ra

    groups: Dict[int, List[int]] = {}
    for i, _, _ in numbered:
        groups.setdefault(find(i), []).append(i)

    titles = {i: str(r.get("title") or r.get("id") or f"S{i}") for i, r, _ in numbered}
    clusters = []
    for _root, members in sorted(groups.items()):
        if len(members) < 2:
            continue
        clusters.append({
            "members": members,
            "title": titles.get(members[0], ""),
            "titles": [titles.get(m, f"S{m}") for m in members],
            "reason": "these sources repeat the same opening text — one story, not several",
        })

    return {
        "sources": len(numbered),
        "independent": len(groups),
        "clusters": clusters,
        "measured": True,
        "threshold": SYNDICATION_THRESHOLD,
    }


def _source_lines(pairs: list[tuple[dict, str]], limit: int = 60) -> str:
    out = []
    for i, (rec, _text) in enumerate(pairs[:limit], 1):
        out.append(f"S{i} · {rec.get('title') or rec.get('id')} ({rec.get('kind') or 'source'})")
    return "\n".join(out)


def _valid_source_number(raw: Any, count: int) -> Optional[int]:
    """A citation is only real if that source exists. Anything else is dropped."""
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return None
    return n if 1 <= n <= count else None


def _clean_item(item: dict, count: int) -> Optional[dict]:
    sides = []
    for side in (item.get("sides") or []):
        if not isinstance(side, dict):
            continue
        claim = str(side.get("claim") or "").strip()
        if not claim:
            continue
        nums = [n for n in (_valid_source_number(x, count) for x in (side.get("sources") or [])) if n]
        if not nums:
            # a position with no real source behind it is an opinion, not a tension
            continue
        sides.append({
            "claim": claim,
            "sources": nums,
            "quote": str(side.get("quote") or "").strip()[:400],
        })
    if len(sides) < 2:
        return None
    return {
        "topic": str(item.get("topic") or "").strip()[:160],
        "sides": sides,
        "why": str(item.get("why") or "").strip()[:400],
        "resolution": str(item.get("resolution") or "").strip()[:400],
    }


def analyze(notebook: str, *, max_items: int = 6, language: str = "") -> Dict[str, Any]:
    """Find the disagreements between a notebook's sources, plus how many of
    those sources are actually independent."""
    nb_id = store.resolve_notebook(notebook)
    meta = store.get_meta(nb_id)
    pairs = store.all_source_texts(nb_id)
    off = store.disabled_sources(nb_id)
    if off:
        pairs = [(r, t) for r, t in pairs if r.get("id") not in off]
    if len(pairs) < 2:
        raise ValueError("a tension needs at least two active sources — add another")

    indep = independence(nb_id)
    count = len(pairs)
    digest = retrieve.notebook_digest(
        nb_id,
        max_chars=int(runtime.config("podcast_context_chars", default=42000)),
        cited=True)

    lang_line = (f"\nWrite every human-facing string (topic, claim, why, resolution) "
                 f"in {language.strip()}. Keep source titles and the S<n> markers "
                 "exactly as given.\n") if language.strip() else ""

    instructions = (
        "You are auditing a set of sources for a careful researcher. Report where "
        "the sources genuinely DISAGREE — conflicting numbers, dates, causal "
        "claims, or recommendations — and quote the exact wording that supports "
        "each position.\n\n"
        "Rules that decide whether this is useful or noise:\n"
        "- A tension needs at least two positions held by DIFFERENT sources. One "
        "source contradicting itself is not a cross-source tension; skip it.\n"
        "- Paraphrase differences are not disagreements. 'Costs rose' and 'costs "
        "increased' agree. Only report a real conflict of substance.\n"
        "- Every position must carry the S<n> numbers of the sources that hold "
        "it, and a short verbatim quote from one of them.\n"
        "- If sources simply do not overlap, that is not a tension. Return an "
        "empty items list rather than inventing one.\n"
        "- 'resolution' says which side the balance of evidence favours and why, "
        "or starts with 'unresolved' when the sources genuinely do not settle it. "
        "Never claim a resolution the sources do not support.\n"
        "- 'agreements' lists claims that two or more INDEPENDENT sources state "
        "the same way: the stable ground a reader can rely on.\n"
        f"Return at most {max_items} items, most consequential first."
        f"{lang_line}"
    )

    parsed = llmio.structured(
        instructions=instructions,
        input=[{"type": "text", "text":
                f"Notebook: {meta.get('title')}\n"
                f"Sources (use these numbers as S<n>):\n{_source_lines(pairs)}\n\n"
                f"Independence check already measured: {count} active sources, "
                f"{indep['independent']} independent"
                + (f", syndicated clusters at {indep['clusters']}" if indep["clusters"] else "")
                + f".\n\nSource content (each excerpt tagged with its S<n>):\n{digest}"}],
        json_schema=_TENSIONS_SCHEMA,
        schema_name="notebook.tensions",
        system_prompt=("You audit sources for disagreements. You never invent a "
                       "conflict, and you never cite a source number that was not "
                       "given to you."),
        purpose="hermes-notebook.tensions",
        max_tokens=4000,
        temperature=0.2,
    )
    if parsed is None:
        raise RuntimeError("model did not return valid JSON for the tension audit")

    items = [it for it in (_clean_item(raw, count) for raw in (parsed.get("items") or [])[:max_items] if isinstance(raw, dict)) if it]
    agreements = []
    for raw in (parsed.get("agreements") or [])[:8]:
        if not isinstance(raw, dict):
            continue
        claim = str(raw.get("claim") or "").strip()
        nums = [n for n in (_valid_source_number(x, count) for x in (raw.get("sources") or [])) if n]
        if claim and len(nums) >= 2:
            agreements.append({"claim": claim, "sources": nums})

    titles = {i: str(rec.get("title") or rec.get("id")) for i, (rec, _t) in enumerate(pairs, 1)}
    for it in items:
        for side in it["sides"]:
            side["titles"] = [titles.get(n, f"S{n}") for n in side["sources"]]

    return {
        "ok": True,
        "notebook": nb_id,
        "title": meta.get("title") or nb_id,
        "items": items,
        "agreements": agreements,
        "independence": indep,
        "sources": count,
        "dropped": max(0, len(parsed.get("items") or []) - len(items)),
        "hint": ("Each side cites real S<n> numbers. A position whose sources do not "
                 "exist was dropped rather than repaired."),
    }
