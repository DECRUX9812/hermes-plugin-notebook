"""The ``auto`` composer: packs normalised blocks onto a 12-column grid.

Structure: kicker + title (+ subtitle) header → block rows → takeaway band →
source strip. Rows are packed greedily in model order; a run of ``stat`` blocks
shares one row (up to four). Under-filled rows stretch to the full 12 columns —
a lone stat card spans, chart blocks widen and their internal caps keep the
figure's aspect. Each row's height is measured from content, then leftover
body space is distributed to charts (which grow) — text does not stretch and
never drops under 14px.

On a fixed canvas the composer first drops the lowest-value blocks (facts →
quotes → extra stats), then compresses growable rows to their floor, so the
band always fits instead of silently overflowing.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from . import blocks as _blocks
from . import charts, core
from .templates import Frame, header, takeaway_measure

COLS = 12
STRIP_H = 30


def _cols(block: Dict[str, Any], f: Frame) -> int:
    kind = block.get("type")
    n = len(_items(block))
    if kind == "stat":
        return 3
    if kind == "bar":
        return 12 if n > 5 else 6
    if kind in ("share", "quote", "facts"):
        return 6
    if kind == "compare":
        return 6 if n <= 3 else 12
    return 12  # trend / timeline / steps always span


def _items(block: Dict[str, Any]) -> List[Dict[str, Any]]:
    return _blocks.block_items(block)


def _pack(units: List[Dict[str, Any]], f: Frame) -> List[List[Dict[str, Any]]]:
    """Greedy first-fit rows in model order; stat runs pack four to a row."""
    rows: List[List[Dict[str, Any]]] = []
    cur: List[Dict[str, Any]] = []
    used = 0
    for u in units:
        c = u["cols"]
        if used + c > COLS and cur:
            rows.append(cur)
            cur, used = [], 0
        cur.append(u)
        used += c
    if cur:
        rows.append(cur)
    return rows


def _stretch(row: List[Dict[str, Any]]) -> None:
    """Fill an under-packed row out to the 12 columns.

    Natural widths leave paper unused: one stat is 3 of 12 columns, so a
    sparse payload rendered a card adrift on blank canvas. Under-filled rows
    widen proportionally — stat cards share the row evenly (equal widths) and
    chart blocks span the extra columns. The charts keep their own caps
    (donut diameter, waffle cell size), so widening grows the legend and the
    frame, never the figure's aspect.
    """
    used = sum(u["cols"] for u in row)
    if not row or used >= COLS:
        return
    free = COLS - used
    carry = 0.0
    for u in row:
        share = free * u["cols"] / used
        add = int(share)
        carry += share - add
        if carry >= 1.0:
            add += 1
            carry -= 1.0
        u["cols"] += add
        free -= add
    i = 0
    while free > 0:
        row[i % len(row)]["cols"] += 1
        free -= 1
        i += 1


def _units(graphic: Dict[str, Any], f: Frame) -> List[Dict[str, Any]]:
    """Expand stat runs into per-row unit groups, keep everything else atomic."""
    units: List[Dict[str, Any]] = []
    i = 0
    all_blocks = list(graphic.get("blocks") or [])
    while i < len(all_blocks):
        b = all_blocks[i]
        if b.get("type") == "stat":
            run = []
            while i < len(all_blocks) and all_blocks[i].get("type") == "stat" and len(run) < 4:
                run.append(all_blocks[i])
                i += 1
            units.append({"cols": 3 * len(run), "blocks": run, "kind": "stat-run"})
            continue
        units.append({"cols": _cols(b, f), "blocks": [b], "kind": b.get("type")})
        i += 1
    return units


def _row_measure(row: List[Dict[str, Any]], f: Frame, p, col_w: float,
                 gap: int) -> int:
    """Natural height: the tallest unit in the row."""
    best = 0
    for u in row:
        w = u["cols"] * col_w + (u["cols"] - 1) * gap
        if u["kind"] == "stat-run":
            each = (w - (len(u["blocks"]) - 1) * gap) / len(u["blocks"])
            best = max(best, charts.stat_measure(u["blocks"][0], each, f, p))
        else:
            best = max(best, charts.measure(u["blocks"][0], w, f, p))
    return best


def _row_growable(row: List[Dict[str, Any]]) -> bool:
    return any(u["kind"] in charts.GROWABLE for u in row)


def _drop_one(units: List[Dict[str, Any]]) -> bool:
    """Remove the lowest-priority unit (facts → quote → extra stats)."""
    best_i, best_rank = -1, -1
    for i, u in enumerate(units):
        ranks = [charts.DROP_ORDER.get(b.get("type"), 9) for b in u["blocks"]]
        rank = min(ranks)
        # keep at least one stat unit: rank "extra" stats low only beyond first
        if u["kind"] == "stat-run" and i == 0 and len(u["blocks"]) <= 4:
            rank = 3
        if rank <= 2 and rank >= best_rank:
            best_i, best_rank = i, rank
    if best_i < 0:
        return False
    units.pop(best_i)
    return True


def _min_row_h(row: List[Dict[str, Any]]) -> int:
    best = 60
    for u in row:
        kind = u["kind"]
        n = sum(len(_items(b)) for b in u["blocks"]) or 1
        floor = {"bar": 30 * n + 40, "share": 120, "trend": 160,
                 "timeline": 120, "compare": 30 * n + 60,
                 "steps": 44 * n + 30, "stat-run": 96,
                 "quote": 90, "facts": 40 * n + 40}.get(kind, 80)
        best = max(best, floor)
    return best


def _draw_row(row: List[Dict[str, Any]], x0: int, y: int, rh: int,
              f: Frame, p, col_w: float, gap: int) -> List[str]:
    out: List[str] = []
    cx = x0
    for u in row:
        w = u["cols"] * col_w + (u["cols"] - 1) * gap
        if u["kind"] == "stat-run":
            each = (w - (len(u["blocks"]) - 1) * gap) / len(u["blocks"])
            sx = cx
            for b in u["blocks"]:
                out += charts.draw(b, sx, y, each, rh, f, p)
                sx += each + gap
        else:
            out += charts.draw(u["blocks"][0], cx, y, w, rh, f, p)
        cx += w + gap
    return out


def compose(f: Frame, p, graphic: Dict[str, Any], detail: str = "standard"
            ) -> Tuple[List[str], int, int]:
    """Returns (elements, band_y, band_h) like the templates."""
    g = _blocks.normalise_graphic(graphic)
    face = p.typeface if p.typeface in core.FONT_STACK else "sans"
    els: List[str] = []

    # ---- header: kicker + title + optional subtitle
    sub = str(g.get("subtitle") or "").strip()
    hdr, top = header(f, p, str(g.get("title") or "Infographic"),
                      meta=str(g.get("source") or "") if g.get("source") else "")
    els += hdr
    if sub:
        for i, ln in enumerate(core.wrap(sub, face, 20, f.inner, limit=2)):
            els.append(core.text(f.m, top + 14 + i * 26, ln, 20,
                                 core.readable(p.muted, p.paper, 4.0), face))
        top += 26 * min(2, len(core.wrap(sub, face, 20, f.inner))) + 14
    top += 10

    # ---- bands: takeaway + source strip sit at the bottom
    size, band_h, _ = takeaway_measure(f, p, str(g.get("takeaway") or ""))
    strip_h = STRIP_H if (g.get("_sources") or g.get("_verify")) else 0
    band_y = f.bottom() - strip_h - band_h
    body_y0, body_y1 = top, band_y - f.gap
    body_h = max(80, body_y1 - body_y0)

    # ---- pack; drop/compress until it fits
    gap = f.gap
    col_w = (f.inner - (COLS - 1) * gap) / COLS
    units = _units(g, f)
    rows = _pack(units, f)
    for r in rows:
        _stretch(r)
    heights = [_row_measure(r, f, p, col_w, gap) for r in rows]

    def total(hs):
        return sum(hs) + gap * max(0, len(hs) - 1)

    while rows and total(heights) > body_h and _drop_one(units):
        rows = _pack(units, f)
        for r in rows:
            _stretch(r)
        heights = [_row_measure(r, f, p, col_w, gap) for r in rows]
    if rows and total(heights) > body_h:
        # still too tall: compress growable rows toward their floors
        spare = total(heights) - body_h
        for i, r in enumerate(rows):
            if not _row_growable(r) or spare <= 0:
                continue
            room = heights[i] - _min_row_h(r)
            take = min(room, spare)
            heights[i] -= take
            spare -= take
    if not rows:
        note = (g.get("_verify") or {}).get("note") or \
            "Nothing to draw — the sources did not supply blocks that verify."
        els.append(core.text(f.m, body_y0 + 40, note, 18,
                             core.readable(p.muted, p.paper), face))
    else:
        # distribute leftover to growable rows, then to gaps
        leftover = max(0, body_h - total(heights))
        grow_ix = [i for i, r in enumerate(rows) if _row_growable(r)]
        if grow_ix:
            cap = [int(heights[i] * 0.9) for i in grow_ix]
            while leftover > 0 and any(c > 0 for c in cap):
                for k, i in enumerate(grow_ix):
                    if leftover <= 0:
                        break
                    bump = min(max(1, leftover // len(grow_ix)), cap[k])
                    heights[i] += bump
                    cap[k] -= bump
                    leftover -= bump
        # remaining leftover becomes top-centering air, bounded
        y = body_y0 + min(leftover, int(body_h * 0.06))
        for i, r in enumerate(rows):
            els += _draw_row(r, f.m, y, heights[i], f, p, col_w, gap)
            y += heights[i] + gap

    # ---- source strip
    if strip_h:
        els += _source_strip(f, p, g, face, f.bottom() - strip_h + 2)
    return els, band_y, band_h


def _source_strip(f: Frame, p, g: Dict[str, Any], face: str, y: int) -> List[str]:
    """'Sources ¹ CRS briefing · ² Reuters' + right-aligned verify summary."""
    out = [core.line(f.m, y - 6, f.w - f.m, y - 6,
                     core.shade(p.paper, 0.10 if p.tone == "dark" else -0.10), 1)]
    srcs = g.get("_sources") or []
    parts = []
    for s in srcs[:8]:
        n, title = s.get("n"), str(s.get("title") or "")
        parts.append(f"{charts._sup(int(n))} {title}" if n else title)
    left = "Sources  " + " · ".join(parts) if parts else "Sources"
    left_shown = core.clip(left, "sans", 14, f.inner * 0.62)
    out.append(core.text(f.m, y + 14, left_shown, 14,
                         core.readable(p.muted, p.paper, 4.0), "sans"))
    try:
        from ..verify import verify_summary
        summ = verify_summary(g)
    except Exception:
        summ = ""
    if summ:
        out.append(core.text(f.w - f.m, y + 14, summ, 14,
                             core.readable(p.muted, p.paper, 4.0), "sans",
                             anchor="end"))
    return out


__all__ = ["compose"]
