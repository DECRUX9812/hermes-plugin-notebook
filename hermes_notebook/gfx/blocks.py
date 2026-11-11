"""Block normalisation for infographic schema v2.

The model emits a flat ``blocks`` array of typed blocks; this module turns
whatever actually arrived into blocks the charts and the composer can trust:

* strings-for-numbers are parsed (``"1,100"`` → 1100, ``"38%"`` → 38);
* unknown block types are dropped silently;
* items missing required fields are dropped; a block under its minimum
  item count is dropped;
* oversized lists are capped at the block's maximum;
* a ``share`` block whose parts sum past 100.5 is dropped (it claims to be
  parts of a whole, so a bad sum is a lie, not a style);
* ``cites`` are coerced to a deduplicated list of positive ints; missing or
  invalid entries yield ``[]`` — verification decides what that means;
* legacy ``stats``/``quotes`` payloads convert to ``stat``/``quote`` blocks so
  the ``auto`` composer can render old JSON unchanged.

Nothing in here raises on model output: ``normalise_graphic`` always returns a
dict with a ``blocks`` list (possibly empty).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

TYPES: tuple = ("stat", "bar", "share", "trend", "timeline", "compare",
                "steps", "quote", "facts")

#: Per-type item bounds: (min_items, max_items). ``stat``/``quote`` carry their
#: payload on the block itself, so their "items" are the single block.
MIN_ITEMS: Dict[str, int] = {
    "bar": 2, "share": 2, "trend": 3, "timeline": 3,
    "compare": 2, "steps": 3, "facts": 2,
}
MAX_ITEMS: Dict[str, int] = {
    "bar": 8, "share": 6, "trend": 12, "timeline": 8,
    "compare": 6, "steps": 6, "facts": 6,
}
MAX_BLOCKS = 8

_NUM = re.compile(r"-?\d[\d,]*(?:\.\d+)?")


def _str(value: Any, limit: int = 400) -> str:
    s = str(value or "").strip()
    return s[:limit]


def _num(value: Any) -> Optional[float]:
    """Parse a number out of model output: 4.48, "1,100", "38%", "$2m"."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        m = _NUM.search(value)
        if m:
            try:
                return float(m.group(0).replace(",", ""))
            except ValueError:
                return None
    return None


def _cites(value: Any, cap: int = 4) -> List[int]:
    """Positive, deduplicated, in the order given. Bad entries die quietly."""
    out: List[int] = []
    raw = value if isinstance(value, (list, tuple)) else [value]
    for c in raw:
        if isinstance(c, bool):
            continue
        try:
            n = int(c)
        except (TypeError, ValueError):
            m = _NUM.search(str(c))
            if not m:
                continue
            try:
                n = int(float(m.group(0).replace(",", "")))
            except ValueError:
                continue
        if n > 0 and n not in out:
            out.append(n)
        if len(out) >= cap:
            break
    return out


def _common(raw: dict) -> Dict[str, Any]:
    return {
        "title": _str(raw.get("title"), 120),
        "detail": _str(raw.get("detail"), 240),
    }


def _item_text(raw: dict) -> str:
    return _str(raw.get("text") or raw.get("label") or raw.get("title"), 300)


def _norm_items(raw_items: Any, kind: str) -> List[Dict[str, Any]]:
    if not isinstance(raw_items, list):
        return []
    out = []
    for raw in raw_items[:MAX_ITEMS[kind] + 4]:
        if not isinstance(raw, dict):
            continue
        item: Dict[str, Any] = {"cites": _cites(raw.get("cites"))}
        label = _str(raw.get("label"), 80)
        if kind == "bar":
            value = _num(raw.get("value"))
            if not label or value is None:
                continue
            item.update(label=label, value=value,
                        display=_str(raw.get("display"), 24) or None)
        elif kind == "share":
            pct = _num(raw.get("percent"))
            val = _num(raw.get("value"))
            if not label or (pct is None and val is None):
                continue
            item.update(label=label,
                        percent=pct, value=val,
                        display=_str(raw.get("display"), 24) or None)
        elif kind == "facts":
            text = _item_text(raw)
            if not text:
                continue
            item["text"] = text
            icon = _str(raw.get("icon"), 40)
            if icon:
                item["icon"] = icon
        else:
            continue
        out.append({k: v for k, v in item.items() if v is not None})
    return out[:MAX_ITEMS[kind]]


def _norm_points(raw_points: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_points, list):
        return []
    out = []
    for raw in raw_points[:MAX_ITEMS["trend"]]:
        if not isinstance(raw, dict):
            continue
        x = _str(raw.get("x"), 30)
        y = _num(raw.get("y"))
        if not x or y is None:
            continue
        out.append({"x": x, "y": y, "cites": _cites(raw.get("cites"))})
    return out


def _norm_events(raw_events: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_events, list):
        return []
    out = []
    for raw in raw_events[:MAX_ITEMS["timeline"]]:
        if not isinstance(raw, dict):
            continue
        when = _str(raw.get("when"), 30)
        what = _str(raw.get("what"), 160)
        if not when or not what:
            continue
        out.append({"when": when, "what": what, "cites": _cites(raw.get("cites"))})
    return out


def _norm_rows(raw_rows: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_rows, list):
        return []
    out = []
    for raw in raw_rows[:MAX_ITEMS["compare"]]:
        if not isinstance(raw, dict):
            continue
        aspect = _str(raw.get("aspect"), 60)
        a = _str(raw.get("a"), 140)
        b = _str(raw.get("b"), 140)
        if not aspect or not (a or b):
            continue
        out.append({"aspect": aspect, "a": a, "b": b,
                    "cites": _cites(raw.get("cites"))})
    return out


def _norm_steps(raw_steps: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_steps, list):
        return []
    out = []
    for raw in raw_steps[:MAX_ITEMS["steps"]]:
        if not isinstance(raw, dict):
            continue
        title = _str(raw.get("title"), 60)
        text = _str(raw.get("text"), 200)
        if not title:
            continue
        out.append({"title": title, "text": text,
                    "cites": _cites(raw.get("cites"))})
    return out


def _normalise_block(raw: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    kind = str(raw.get("type") or "").strip().lower()
    if kind not in TYPES:
        return None
    block = _common(raw)
    block["type"] = kind
    block["cites"] = _cites(raw.get("cites"))

    if kind == "stat":
        value = _str(raw.get("value"), 40)
        label = _str(raw.get("label"), 120)
        if not value:
            return None
        block.update(value=value, label=label,
                     unit=_str(raw.get("unit"), 20) or None)
    elif kind == "quote":
        text = _str(raw.get("text"), 400)
        if not text:
            return None
        block.update(text=text, who=_str(raw.get("who"), 80) or None)
    elif kind in ("bar", "share", "facts"):
        items = _norm_items(raw.get("items"), kind)
        if kind == "share":
            # parts of a whole: a sum meaningfully over 100 is a lie
            pcts = [i.get("percent") for i in items]
            if all(p is None for p in pcts):
                vals = [i.get("value") or 0.0 for i in items]
                total = sum(vals)
                if total <= 0:
                    return None
                for i in items:
                    i["percent"] = 100.0 * (i.get("value") or 0.0) / total
            else:
                # fill missing percents from remaining value share
                vals_total = sum(i.get("value") or 0.0 for i in items)
                for i in items:
                    if i.get("percent") is None and vals_total > 0:
                        i["percent"] = 100.0 * (i.get("value") or 0.0) / vals_total
                items = [i for i in items if i.get("percent") is not None]
            if sum(i["percent"] for i in items) > 100.5:
                return None
        if len(items) < MIN_ITEMS[kind]:
            return None
        block["items"] = items
    elif kind == "trend":
        points = _norm_points(raw.get("points") or raw.get("items"))
        if len(points) < MIN_ITEMS["trend"]:
            return None
        block["points"] = points
    elif kind == "timeline":
        events = _norm_events(raw.get("events") or raw.get("items"))
        if len(events) < MIN_ITEMS["timeline"]:
            return None
        block["events"] = events
    elif kind == "compare":
        rows = _norm_rows(raw.get("rows") or raw.get("items"))
        if len(rows) < MIN_ITEMS["compare"]:
            return None
        block["rows"] = rows
        block["a_label"] = _str(raw.get("a_label"), 40) or "A"
        block["b_label"] = _str(raw.get("b_label"), 40) or "B"
    elif kind == "steps":
        steps = _norm_steps(raw.get("steps") or raw.get("items"))
        if len(steps) < MIN_ITEMS["steps"]:
            return None
        block["steps"] = steps
    return {k: v for k, v in block.items() if v not in (None, "", [])}


def _legacy_blocks(graphic: Dict[str, Any]) -> List[Dict[str, Any]]:
    """stats[]/quotes[] (schema v1) → blocks, so `auto` renders old payloads."""
    out: List[Dict[str, Any]] = []
    for st in graphic.get("stats") or []:
        if not isinstance(st, dict):
            continue
        value = _str(st.get("value"), 40)
        if not value:
            continue
        out.append({"type": "stat", "value": value,
                    "label": _str(st.get("label"), 120),
                    "detail": _str(st.get("detail"), 240),
                    "cites": _cites(st.get("cites"))})
    for q in graphic.get("quotes") or []:
        if not isinstance(q, dict):
            continue
        text = _str(q.get("text"), 400)
        if not text:
            continue
        out.append({"type": "quote", "text": text,
                    "who": _str(q.get("source") or q.get("who"), 80) or None,
                    "cites": _cites(q.get("cites") or q.get("citations"))})
    events = _norm_events(graphic.get("events"))
    if len(events) >= MIN_ITEMS["timeline"]:
        out.append({"type": "timeline", "title": "Timeline", "events": events})
    steps = _norm_steps(graphic.get("steps"))
    if len(steps) >= MIN_ITEMS["steps"]:
        out.append({"type": "steps", "title": "Steps", "steps": steps})
    return out


def normalise_graphic(graphic: Any) -> Dict[str, Any]:
    """Return a copy of ``graphic`` with a clean ``blocks`` list. Never raises."""
    out: Dict[str, Any] = dict(graphic) if isinstance(graphic, dict) else {}
    out["title"] = _str(out.get("title"), 160) or "Infographic"
    out["subtitle"] = _str(out.get("subtitle"), 200) or None
    out["takeaway"] = _str(out.get("takeaway"), 400)
    blocks: List[Dict[str, Any]] = []
    raw = out.get("blocks")
    if isinstance(raw, list):
        for rb in raw[:MAX_BLOCKS + 4]:
            b = _normalise_block(rb)
            if b:
                blocks.append(b)
            if len(blocks) >= MAX_BLOCKS:
                break
    if not blocks:
        blocks = _legacy_blocks(out)
    out["blocks"] = blocks[:MAX_BLOCKS]
    return {k: v for k, v in out.items() if v is not None}


def block_items(block: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The leaf items a verifier walks: items/points/events/rows/steps, or the
    block itself for stat/quote."""
    kind = block.get("type")
    for key in ("items", "points", "events", "rows", "steps"):
        if isinstance(block.get(key), list):
            return block[key]
    if kind in ("stat", "quote"):
        return [block]
    return []


def item_text(block: Dict[str, Any], item: Dict[str, Any]) -> str:
    """A short human-readable label for an item (verify report + viewer)."""
    kind = block.get("type")
    if kind == "stat":
        return " ".join(p for p in (str(item.get("value") or ""),
                                    str(item.get("label") or "")) if p).strip()
    if kind == "quote":
        return str(item.get("text") or "")[:90]
    if kind in ("bar", "share"):
        return str(item.get("label") or "")
    if kind == "trend":
        return f"{item.get('x')} = {item.get('y')}"
    if kind == "timeline":
        return f"{item.get('when')}: {item.get('what')}"
    if kind == "compare":
        return str(item.get("aspect") or "")
    if kind == "steps":
        return str(item.get("title") or "")
    if kind == "facts":
        return str(item.get("text") or "")[:90]
    return ""


__all__ = ["TYPES", "MIN_ITEMS", "MAX_ITEMS", "normalise_graphic",
           "block_items", "item_text"]
