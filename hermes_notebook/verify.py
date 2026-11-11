"""Deterministic source verification for infographic blocks.

The model picks the numbers; this module decides whether the sources actually
say them. It never asks a model, so the result cannot drift between runs or
between models.

Rules:

* a numeric token is ``verified`` when it occurs in the normalised text of one
  of the item's cited sources;
* when it only occurs in *other* sources, the item is ``recited`` — its cite
  set is rewritten to the sources that actually carry its numbers;
* a token found nowhere drops the item (recorded in ``_verify.dropped``);
* quotes pass on ≥0.85 token overlap against a sliding window of a cited
  source, and may likewise recite;
* ``"1,100"`` equals ``"1100"`` — commas inside digit groups are stripped from
  BOTH sides before matching;
* cite numbers outside the source list are removed; an item left with no valid
  cites and nothing verifiable renders anyway but is flagged ``unsourced`` and
  excluded from the verified count;
* blocks below their minimum item count after drops are dropped.

``sources`` is whatever S-numbered text the caller can provide — a list of
strings (position = S-number), a list of ``{n, text}`` dicts, or the
``(index_record, text)`` pairs ``store.all_source_texts`` returns keyed by the
same numbering the prompt used. Verification is keyed to THAT space; it never
assumes emission order.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from .gfx import blocks as _blocks

#: ``1,100.50`` / ``38`` / ``-4`` — a number with optional grouping + decimals.
_NUM = re.compile(r"-?\d[\d,]*(?:\.\d+)?")
#: comma between digits → thousands separator
_COMMA = re.compile(r"(?<=\d),(?=\d)")
_WORD = re.compile(r"[a-z0-9]+")

QUOTE_OVERLAP = 0.85


def _norm_text(text: str) -> str:
    """Digits lose thousands separators; the rest lowercases + collapses."""
    t = _COMMA.sub("", str(text or ""))
    return re.sub(r"\s+", " ", t)


def _numbers(text: str) -> List[str]:
    """Normalised numeric tokens in ``text`` ('$1,100M' → '1100')."""
    out = []
    for m in _NUM.finditer(_norm_text(text)):
        tok = m.group(0).lstrip("-")  # sign lives in prose, not in the figure
        if tok and tok not in out:
            out.append(tok)
    return out


def _occurs(token: str, norm_source: str) -> bool:
    return re.search(rf"(?<![\d.]){re.escape(token)}(?![\d.])", norm_source) is not None


def _tokens(text: str) -> List[str]:
    return _WORD.findall(_norm_text(text).lower())


def _quote_overlap(quote: str, source_text: str) -> float:
    """Best token-overlap ratio of the quote against any window of the source."""
    q = _tokens(quote)
    if not q:
        return 0.0
    s = _tokens(source_text)
    if not s:
        return 0.0
    w = len(q)
    qset = set(q)
    best = 0.0
    for i in range(0, max(1, len(s) - w + 1)):
        window = s[i:i + w]
        # overlap counts distinct quote tokens covered by the window; a window
        # shorter than the quote still scores on its own length
        score = len(qset & set(window)) / len(qset)
        if score > best:
            best = score
        if best >= 1.0:
            break
    return best


def _quote_close(quote: str, source_text: str) -> bool:
    """Paraphrase detector: near-identical character runs still pass via ratio."""
    if _quote_overlap(quote, source_text) >= QUOTE_OVERLAP:
        return True
    # a near-verbatim quote that reordered a phrase fails overlap; SequenceMatcher
    # on the best paragraph catches it without blessing real paraphrases
    best = 0.0
    for para in re.split(r"\n+", str(source_text or "")):
        if len(para) < 20:
            continue
        best = max(best, SequenceMatcher(None, _norm_text(quote).lower(),
                                         _norm_text(para).lower()).ratio())
        if best >= 0.92:
            return True
    return False


def _source_map(sources: Any) -> Dict[int, str]:
    """S-number → normalised text, from whichever shape the caller has.

    * ``["t1", "t2"]``                → S1=t1, S2=t2 (position)
    * ``[{"n": 2, "text": "t"}]``     → keyed by ``n`` (sources_used shape)
    * ``[(rec, "t"), ...]``           → ``store.all_source_texts`` pairs; key is
      ``rec["n"]`` when present else position in the list
    """
    out: Dict[int, str] = {}
    if isinstance(sources, dict):
        for k, v in sources.items():
            try:
                out[int(k)] = _norm_text(str(v))
            except (TypeError, ValueError):
                continue
        return out
    if not isinstance(sources, (list, tuple)):
        return out
    pos = 0
    for entry in sources:
        pos += 1
        if isinstance(entry, str):
            out[pos] = _norm_text(entry)
        elif isinstance(entry, dict):
            n = entry.get("n")
            try:
                n = int(n) if n is not None else pos
            except (TypeError, ValueError):
                n = pos
            out[n] = _norm_text(str(entry.get("text") or entry.get("snippet") or ""))
        elif isinstance(entry, (list, tuple)) and len(entry) == 2:
            rec, text = entry
            n = pos
            if isinstance(rec, dict) and rec.get("n") is not None:
                try:
                    n = int(rec["n"])
                except (TypeError, ValueError):
                    n = pos
            out[n] = _norm_text(str(text))
    return out


def _numstr(v: Any) -> str:
    """1100.0 → '1100' — floats rendered with their .0 never match a source."""
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v)


def _verifiable_text(block: Dict[str, Any], item: Dict[str, Any]) -> str:
    """The fields of an item that claim a number or a quotation."""
    kind = block.get("type")
    parts: List[str] = []
    if kind == "stat":
        parts += [_numstr(item.get("value") or ""), str(item.get("unit") or "")]
    elif kind == "quote":
        parts.append(str(item.get("text") or ""))
    elif kind in ("bar", "share"):
        # value/percent are the claim; `display` is a reformatting of the same
        # number ("$1.1bn" for 1100) so its digits must not verify separately
        parts += [_numstr(item.get("value") or ""), _numstr(item.get("percent") or "")]
    elif kind == "trend":
        parts += [_numstr(item.get("y") or ""), str(item.get("x") or "")]
    elif kind == "timeline":
        parts += [str(item.get("when") or "")]
    elif kind == "compare":
        parts += [str(item.get("a") or ""), str(item.get("b") or "")]
    elif kind == "steps":
        parts += [str(item.get("title") or ""), str(item.get("text") or "")]
    elif kind == "facts":
        parts.append(str(item.get("text") or ""))
    return " ".join(parts)


def _verify_item(block: Dict[str, Any], item: Dict[str, Any],
                 smap: Dict[int, str]) -> Dict[str, Any]:
    """Mutate ``item`` (cites/flags); return its report row."""
    kind = block.get("type")
    all_sources = sorted(smap)
    cites = [n for n in item.get("cites") or [] if n in smap]
    item["cites"] = cites
    text = _verifiable_text(block, item)
    tokens = _numbers(text)
    is_quote = kind == "quote"
    report = {"block": kind, "text": _blocks.item_text(block, item),
              "status": "verified", "cites": list(cites), "to": None}

    matched: set = set()
    ok = True
    if is_quote:
        quote = str(item.get("text") or "")
        if _tokens(quote):
            hit = next((n for n in cites if _quote_close(quote, smap[n])), None)
            if hit is not None:
                matched.add(hit)
            else:
                hit = next((n for n in all_sources if n not in cites
                            and _quote_close(quote, smap[n])), None)
                if hit is not None:
                    matched.add(hit)
                    item["cites"] = sorted(matched)
                    report["status"] = "recited"
                    report["to"] = hit
                else:
                    ok = False
    else:
        missing = []
        for tok in tokens:
            hit = next((n for n in cites if _occurs(tok, smap[n])), None)
            if hit is None:
                hit = next((n for n in all_sources if n not in cites
                            and _occurs(tok, smap[n])), None)
                if hit is not None:
                    report["status"] = "recited"
            if hit is None:
                missing.append(tok)
            else:
                matched.add(hit)
        if missing:
            ok = False
        elif tokens:
            if matched != set(cites):
                report["status"] = "recited"
                item["cites"] = sorted(matched)
                report["to"] = sorted(matched)[0] if len(matched) == 1 else sorted(matched)

    report["cites"] = list(item.get("cites") or [])
    if not ok:
        report["status"] = "dropped"
        report["reason"] = ("no source carries the quotation"
                            if is_quote else "number absent from sources")
        return report
    # the item survives
    if is_quote or tokens:
        if report["status"] != "recited" and not cites and matched:
            # the figure exists, just not where it was pointed → recite
            item["cites"] = sorted(matched)
            report["cites"] = list(item["cites"])
            report["status"] = "recited"
            report["to"] = item["cites"][0] if len(item["cites"]) == 1 else item["cites"]
    elif not item.get("cites"):
        # nothing checkable and nobody to vouch → renders, but flagged
        item["unsourced"] = True
        report["status"] = "unsourced"
    return report


def verify_graphic(graphic: Dict[str, Any], sources: Any) -> Dict[str, Any]:
    """Verify a normalised graphic in place; returns it with ``_verify`` set.

    The caller should run ``blocks.normalise_graphic`` first (``generate`` does)
    — unknown keys pass through untouched, so a graphic that was never
    normalised still verifies on whatever ``blocks`` it happens to carry.
    """
    smap = _source_map(sources)
    out_blocks = []
    reports: List[Dict[str, Any]] = []
    dropped: List[Dict[str, Any]] = []
    checked = verified = recited = unsourced = 0

    for block in graphic.get("blocks") or []:
        if not isinstance(block, dict):
            continue
        kind = block.get("type")
        keep_items = []
        for item in _blocks.block_items(block):
            rep = _verify_item(block, item, smap)
            reports.append(rep)
            checked += 1
            status = rep["status"]
            if status == "dropped":
                dropped.append({"block": kind, "text": rep["text"],
                                "reason": rep["reason"]})
                continue
            keep_items.append(item)
            if status == "verified":
                verified += 1
            elif status == "recited":
                recited += 1
            elif status == "unsourced":
                unsourced += 1
        if kind in _blocks.MIN_ITEMS:
            key = {"bar": "items", "share": "items", "facts": "items",
                   "trend": "points", "timeline": "events",
                   "compare": "rows", "steps": "steps"}[kind]
            if len(keep_items) < _blocks.MIN_ITEMS[kind]:
                dropped.append({"block": kind,
                                "text": block.get("title") or kind,
                                "reason": f"below {kind}'s minimum after verification"})
                continue
            block[key] = keep_items
        out_blocks.append(block)

    graphic["blocks"] = out_blocks
    graphic["_verify"] = {
        "checked": checked,
        "verified": verified,
        "recited": recited,
        "unsourced": unsourced,
        "dropped": dropped,
        "items": [{k: v for k, v in r.items() if v is not None} for r in reports],
    }
    if len(out_blocks) < 2:
        graphic["_verify"]["note"] = (
            "Fewer than two blocks survived verification — showing what the sources actually support.")
    return graphic


def verify_summary(graphic: Dict[str, Any]) -> str:
    """The footer line: '14 of 15 figures verified against sources'."""
    v = (graphic or {}).get("_verify") or {}
    checked = v.get("checked") or 0
    if not checked:
        return ""
    good = (v.get("verified") or 0) + (v.get("recited") or 0)
    return f"{good} of {checked} figures verified against sources"


__all__ = ["verify_graphic", "verify_summary", "QUOTE_OVERLAP"]
