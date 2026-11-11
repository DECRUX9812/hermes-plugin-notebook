"""Chart renderers for infographic schema-v2 blocks.

One function pair per block type: ``measure`` returns the natural height the
chart wants at a given width (the composer packs rows with it), ``draw`` paints
the chart inside a box — charts stretch to the height they're given, text never
shrinks under ``FS_MIN``.

Every leaf item shows its citations as a superscript in the accent colour, so
the poster reads as sourced at a glance. Labels wrap, then ellipsize, with a
``<title>`` carrying the full text.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from . import core, icons

FS_MIN = 14

_SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def _sup(n: int) -> str:
    return str(n).translate(_SUP)


def cites_marks(cites: Any) -> str:
    return "".join(_sup(int(c)) for c in (cites or []) if isinstance(c, int) and c > 0)


def _face(p) -> str:
    return p.typeface if p.typeface in core.FONT_STACK else "sans"


def _ink(p, bg=None) -> Any:
    return core.readable(p.ink, bg or p.card)


def _mut(p, bg=None) -> Any:
    return core.readable(p.muted, bg or p.card, 4.0)


def _acc(p, i: int, bg=None) -> Any:
    return core.readable(p.accents[i % len(p.accents)], bg or p.card)


def _hairline(p) -> Any:
    """A grid/separator stroke visible on the card in both tones."""
    if p.border:
        return p.border
    return core.shade(p.card, 0.14 if p.tone == "dark" else -0.10)


def _titled(x: float, y: float, shown: str, full: str, size: int, fill: Any,
            face: str, bold: bool = False, anchor: str = "start") -> str:
    """A text run with a <title> child when ``shown`` was clipped from ``full``."""
    if not shown:
        return ""
    if shown == full:
        return core.text(x, y, shown, size, fill, face, bold=bold, anchor=anchor)
    out = core.text(x, y, shown, size, fill, face, bold=bold, anchor=anchor)
    return out.replace("</text>", f"<title>{core.util_escape(full)}</title></text>", 1)


def _clip(body: str, face: str, size: int, w: float, bold: bool = False) -> Tuple[str, str]:
    shown = core.clip(str(body or ""), face, size, w, bold=bold)
    return shown, str(body or "")


def _with_cites(x: float, y: float, body: str, size: int, fill: Any, face: str,
                cites: Any, acc: Any, bold: bool = False, anchor: str = "start") -> str:
    """Text plus a superscript cite run in the accent, offset past the glyphs."""
    out = core.text(x, y, body, size, fill, face, bold=bold, anchor=anchor)
    marks = cites_marks(cites)
    if not marks:
        return out
    tw = core.text_width(body, face, size, bold=bold)
    sx = x + tw + 3 if anchor == "start" else (x - 3 if anchor == "end" else x + tw / 2 + 3)
    out += core.text(sx, y - size * 0.55, marks, FS_MIN,
                     acc, face, bold=True)
    return out


def _panel(x: float, y: float, w: float, h: float, p, title: str = "") -> List[str]:
    """A card + optional block title kicker; returns [panel, title] elements."""
    out = [core.rect(x, y, w, h, fill=p.card, stroke=p.border, sw=1,
                     r=min(p.radius or 12, 22))]
    if title:
        acc = _acc(p, 0)
        out.append(core.text(x + 18, y + 30, core.clip(title, "sans", 15, w - 36, bold=True),
                             15, _mut(p), "sans", bold=True, tracking=1.2))
    return out


def _pad(title: str) -> int:
    return 44 if title else 18


# ---------------------------------------------------------------------- stat

def stat_measure(block: Dict, w: float, f, p) -> int:
    return 128 + _pad(block.get("title"))


def stat_draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    face = _face(p)
    out = _panel(x, y, w, h, p)
    top = y + _pad(block.get("title")) + 6
    value = str(block.get("value") or "")
    vsize = 46
    while vsize > 26 and core.text_width(value, face, vsize, bold=True) > w - 36:
        vsize -= 2
    out.append(core.text(x + 18, top + vsize * 0.78,
                         core.clip(value, face, vsize, w - 36, bold=True),
                         vsize, _acc(p, 0, p.card), face, bold=True))
    cites = cites_marks(block.get("cites"))
    if cites:
        vw = min(core.text_width(value, face, vsize, bold=True), w - 40)
        out.append(core.text(x + 18 + vw + 4, top + vsize * 0.78 - vsize * 0.5,
                             cites, 15, _mut(p), face, bold=True))
    ly = top + vsize + 16
    label, full = _clip(block.get("label") or "", face, 16, w - 36, bold=True)
    out.append(_titled(x + 18, ly, label, full, 16, _ink(p), face, bold=True))
    dy = ly + 22
    for ln in core.wrap(str(block.get("detail") or ""), face, 14, w - 36, limit=2):
        out.append(core.text(x + 18, dy, ln, 14, _mut(p), face))
        dy += 19
    return out


# ----------------------------------------------------------------------- bar

def bar_measure(block: Dict, w: float, f, p) -> int:
    n = len(block.get("items") or [])
    return _pad(block.get("title")) + 14 + n * 38


def bar_draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    face = _face(p)
    items = list(block.get("items") or [])
    out = _panel(x, y, w, h, p, block.get("title"))
    top = y + _pad(block.get("title"))
    label_w = min(190, max(60, max((core.text_width(i.get("label") or "", face, 15)
                                    for i in items), default=60)))
    val_w = 88
    bar_x = x + 18 + label_w + 12
    bar_w = max(40, x + w - 18 - val_w - bar_x)
    vmax = max((i.get("value") or 0.0 for i in items), default=1.0) or 1.0
    row_h = (y + h - 8 - top) / max(1, len(items))
    for i, it in enumerate(items):
        ry = top + i * row_h + row_h / 2
        label, full = _clip(it.get("label") or "", face, 15, label_w)
        out.append(_titled(x + 18, ry + 5, label, full, 15, _ink(p), face))
        bh = min(22, row_h - 12)
        bw = bar_w * max(0.0, (it.get("value") or 0.0)) / vmax
        out.append(core.rect(bar_x, ry - bh / 2, bar_w, bh, fill=p.card,
                             stroke=p.border, sw=1, r=min(6, bh / 2)))
        out.append(core.rect(bar_x, ry - bh / 2, max(3, bw), bh,
                             fill=_acc(p, i % len(p.accents), p.card), r=min(6, bh / 2)))
        disp = it.get("display") or _fmt(it.get("value"))
        out.append(core.text(x + w - 18, ry - 2, disp, 15, _ink(p), face,
                             bold=True, anchor="end", tabular=True))
        marks = cites_marks(it.get("cites"))
        if marks:
            out.append(core.text(x + w - 18, ry + 12, marks, FS_MIN,
                                 _acc(p, 0), face, bold=True, anchor="end"))
    return out


def _fmt(v: Any) -> str:
    try:
        f = float(v)
        if f == int(f):
            return str(int(f))
        return f"{f:g}"
    except (TypeError, ValueError):
        return str(v or "")


# --------------------------------------------------------------------- share

def share_measure(block: Dict, w: float, f, p) -> int:
    n = len(block.get("items") or [])
    if n == 1:
        return _pad(block.get("title")) + 150
    return _pad(block.get("title")) + max(170, n * 30 + 10)


def share_draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    face = _face(p)
    items = list(block.get("items") or [])
    out = _panel(x, y, w, h, p, block.get("title"))
    top = y + _pad(block.get("title"))
    if len(items) == 1:
        out += _waffle(items[0], x + 18, top + 4, w - 36, h - (top - y) - 12, p)
        return out
    d = min(h - (top - y) - 14, w * 0.44, 200)
    cx, cy = x + 18 + d / 2, top + 6 + d / 2
    r, hole = d / 2, d / 2 * 0.56
    total = sum(i.get("percent") or 0.0 for i in items) or 1.0
    a0 = -90.0
    for i, it in enumerate(items):
        frac = (it.get("percent") or 0.0) / total
        a1 = a0 + frac * 360.0
        out.append(_donut_seg(cx, cy, r, hole, a0, a1, _acc(p, i, p.card)))
        a0 = a1
    lx = x + 18 + d + 22
    lw = x + w - 18 - lx
    ly = top + 12
    for i, it in enumerate(items):
        out.append(core.rect(lx, ly - 8, 12, 12, fill=_acc(p, i, p.card), r=3))
        label, full = _clip(it.get("label") or "", face, 14, lw - 60)
        out.append(_titled(lx + 20, ly + 3, label, full, 14, _ink(p), face))
        pct = it.get("display") or f"{(it.get('percent') or 0):g}%"
        out.append(core.text(x + w - 20, ly + 3, pct, 14, _ink(p), face,
                             bold=True, anchor="end", tabular=True))
        marks = cites_marks(it.get("cites"))
        if marks:
            out.append(core.text(lx + 20 + core.text_width(label, face, 14) + 4,
                                 ly - 5, marks, FS_MIN, _acc(p, 0), face, bold=True))
        ly += 30
    return out


def _donut_seg(cx, cy, r, hole, a0, a1, fill) -> str:
    import math
    if a1 - a0 >= 359.9:
        a1 = a0 + 359.9
    def pt(a, rr):
        rad = math.radians(a)
        return cx + rr * math.cos(rad), cy + rr * math.sin(rad)
    x1, y1 = pt(a0, r)
    x2, y2 = pt(a1, r)
    x3, y3 = pt(a1, hole)
    x4, y4 = pt(a0, hole)
    large = 1 if (a1 - a0) > 180 else 0
    d = (f"M{x1:.1f},{y1:.1f} A{r:.1f},{r:.1f} 0 {large} 1 {x2:.1f},{y2:.1f} "
         f"L{x3:.1f},{y3:.1f} A{hole:.1f},{hole:.1f} 0 {large} 0 {x4:.1f},{y4:.1f} Z")
    return f'<path d="{d}" fill="{core.paint(fill)}"/>'


def _waffle(item: Dict, x: float, y: float, w: float, h: float, p) -> List[str]:
    """10x10 grid: one square per percent — the single-part share case."""
    face = _face(p)
    pct = max(0.0, min(100.0, item.get("percent") or item.get("value") or 0.0))
    cell = min((w - 90) / 10.0, 14.0)
    gap = cell * 0.18
    acc = _acc(p, 0, p.card)
    out = []
    n_fill = round(pct)
    for i in range(100):
        r_, c_ = divmod(i, 10)
        out.append(core.rect(x + c_ * cell, y + r_ * cell, cell - gap, cell - gap,
                             fill=acc if i < n_fill else core.shade(p.card, -0.08),
                             r=2, opacity=1.0 if i < n_fill else 0.6))
    tx = x + 10 * cell + 14
    out.append(core.text(tx, y + 34, item.get("display") or f"{pct:g}%",
                         30, acc, face, bold=True))
    label, full = _clip(item.get("label") or "", face, 14, w - 10 * cell - 30)
    out.append(_titled(tx, y + 56, label, full, 14, _ink(p), face))
    marks = cites_marks(item.get("cites"))
    if marks:
        out.append(core.text(tx, y + 76, marks, FS_MIN, acc, face, bold=True))
    return out


# --------------------------------------------------------------------- trend

def trend_measure(block: Dict, w: float, f, p) -> int:
    return _pad(block.get("title")) + max(200, min(300, int(w * 0.30)))


def trend_draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    face = _face(p)
    pts = list(block.get("points") or [])
    out = _panel(x, y, w, h, p, block.get("title"))
    top = y + _pad(block.get("title")) + 8
    gx, gy = x + 46, top
    gw, gh = w - 46 - 66, h - (top - y) - 44
    if gw < 60 or gh < 60:
        return out
    vals = [pt.get("y") or 0.0 for pt in pts]
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or (abs(hi) or 1.0)
    lo -= span * 0.08
    hi += span * 0.08
    span = hi - lo

    def px(i):
        return gx + (gw * i / max(1, len(pts) - 1))

    def py(v):
        return gy + gh - gh * (v - lo) / span

    # gridlines at lo/mid/hi
    for gv in (lo + span * 0.08, (lo + hi) / 2, hi - span * 0.08):
        yy = py(gv)
        out.append(core.line(gx, yy, gx + gw, yy, _hairline(p), 1))
        out.append(core.text(gx - 8, yy + 4, _fmt(round(gv, 2)), FS_MIN,
                             _mut(p), face, anchor="end", tabular=True))
    # x labels, thinned to ~6
    step = max(1, -(-len(pts) // 6))
    for i, pt in enumerate(pts):
        if i % step and i != len(pts) - 1:
            continue
        out.append(core.text(px(i), gy + gh + 20, str(pt.get("x") or ""), FS_MIN,
                             _mut(p), face, anchor="middle"))
    # the line + markers
    path_d = " ".join(f"{'M' if i == 0 else 'L'}{px(i):.1f},{py(v):.1f}"
                      for i, v in enumerate(vals))
    out.append(core.path(path_d, stroke=_acc(p, 0, p.card), sw=3))
    for i, pt in enumerate(pts):
        out.append(core.circle(px(i), py(vals[i]), 4, fill=_acc(p, 0, p.card),
                               stroke=p.card, sw=2))
    # annotate first / last / max with value + cites
    marks = {0, len(pts) - 1, vals.index(max(vals))}
    for i in sorted(marks):
        pt = pts[i]
        anchor = "end" if i == len(pts) - 1 else ("middle" if i else "start")
        body = _fmt(pt.get("y"))
        out.append(_with_cites(px(i), py(vals[i]) - 12, body, 15, _ink(p), face,
                               pt.get("cites"), _acc(p, 0, p.card),
                               bold=True, anchor=anchor))
    return out


# ------------------------------------------------------------------ timeline

def timeline_measure(block: Dict, w: float, f, p) -> int:
    n = len(block.get("events") or [])
    if f.aspect < 1.0:
        return _pad(block.get("title")) + n * 62 + 10
    return _pad(block.get("title")) + 190


def timeline_draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    face = _face(p)
    events = list(block.get("events") or [])
    out = _panel(x, y, w, h, p, block.get("title"))
    top = y + _pad(block.get("title"))
    if f.aspect < 1.0:
        # vertical spine for portrait/square
        sx = x + 92
        row_h = (y + h - 12 - top) / max(1, len(events))
        out.append(core.line(sx, top + 6, sx, y + h - 18,
                             _hairline(p), 2))
        for i, ev in enumerate(events):
            cy = top + i * row_h + min(row_h / 2, 30)
            out.append(core.circle(sx, cy, 6, fill=_acc(p, 0, p.card),
                                   stroke=p.card, sw=2))
            when, wf = _clip(ev.get("when"), face, 14, 64, bold=True)
            out.append(_titled(sx - 14, cy + 5, when, wf, 14, _acc(p, 0), face,
                               bold=True, anchor="end"))
            shown = core.wrap(ev.get("what"), face, 14, x + w - 18 - sx - 18, limit=2)
            for j, ln in enumerate(shown):
                out.append(core.text(sx + 18, cy + 5 + j * 18, ln, 14, _ink(p), face))
            marks = cites_marks(ev.get("cites"))
            if marks:
                out.append(core.text(sx + 18 + core.text_width(shown[0], face, 14) + 4,
                                     cy - 3, marks, FS_MIN, _acc(p, 0), face, bold=True))
        return out
    # horizontal spine, events alternate above/below
    sy = top + (h - (top - y)) / 2
    out.append(core.line(x + 22, sy, x + w - 22, sy, _hairline(p), 2))
    n = len(events)
    seg = (w - 44) / max(1, n)
    for i, ev in enumerate(events):
        cx = x + 22 + seg * i + seg / 2
        up = i % 2 == 0
        tick = sy - 10 if up else sy + 10
        out.append(core.line(cx, sy, cx, tick, _hairline(p), 2))
        out.append(core.circle(cx, sy, 6, fill=_acc(p, 0, p.card), stroke=p.card, sw=2))
        when, wf = _clip(ev.get("when"), face, 15, seg - 8, bold=True)
        wy = sy - 18 if up else sy + 34
        out.append(_titled(cx, wy, when, wf, 15, _acc(p, 0), face, bold=True,
                           anchor="middle"))
        body = core.wrap(ev.get("what"), face, 14, seg - 10, limit=3)
        by = (wy - 16 - (len(body) - 1) * 18) if up else wy + 20
        for j, ln in enumerate(body):
            out.append(core.text(cx, by + j * 18, ln, 14, _ink(p), face,
                                 anchor="middle"))
        marks = cites_marks(ev.get("cites"))
        if marks:
            out.append(core.text(cx, (by - 8) if up else (by + len(body) * 18 + 2),
                                 marks, FS_MIN, _acc(p, 0), face, bold=True,
                                 anchor="middle"))
    return out


# ------------------------------------------------------------------- compare

def compare_measure(block: Dict, w: float, f, p) -> int:
    face = _face(p)
    rows = list(block.get("rows") or [])
    a_w = (w - 36) * 0.30
    cell_w = (w - 36 - a_w) / 2
    hgt = _pad(block.get("title")) + 40
    for r in rows:
        la = len(core.wrap(r.get("a") or "", face, 14, cell_w - 16))
        lb = len(core.wrap(r.get("b") or "", face, 14, cell_w - 16))
        hgt += max(44, max(la, lb) * 19 + 18)
    return hgt


def compare_draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    face = _face(p)
    rows = list(block.get("rows") or [])
    out = _panel(x, y, w, h, p, block.get("title"))
    top = y + _pad(block.get("title"))
    inner_w = w - 36
    a_w = inner_w * 0.28
    cell_w = (inner_w - a_w) / 2
    cx_a = x + 18 + a_w
    cx_b = cx_a + cell_w
    out.append(core.rect(cx_a, top, cell_w, 32, fill=_acc(p, 0, p.card), r=8))
    out.append(core.rect(cx_b, top, cell_w, 32, fill=_acc(p, 1, p.card), r=8))
    out.append(core.text(cx_a + cell_w / 2, top + 21,
                         core.clip(block.get("a_label") or "A", face, 15, cell_w - 20, bold=True),
                         15, core.pick_ink(p.accents[0]), face, bold=True, anchor="middle"))
    out.append(core.text(cx_b + cell_w / 2, top + 21,
                         core.clip(block.get("b_label") or "B", face, 15, cell_w - 20, bold=True),
                         15, core.pick_ink(p.accents[1 % len(p.accents)]), face,
                         bold=True, anchor="middle"))
    ry = top + 40
    avail = y + h - 10 - ry
    row_h = avail / max(1, len(rows))
    for i, r in enumerate(rows):
        if i:
            out.append(core.line(x + 18, ry, x + w - 18, ry,
                                 _hairline(p), 1))
        asp, af = _clip(r.get("aspect"), face, 14, a_w - 14, bold=True)
        out.append(_titled(x + 18, ry + row_h / 2 + 5, asp, af, 14, _mut(p),
                           face, bold=True))
        for col, key in ((cx_a, "a"), (cx_b, "b")):
            lines = core.wrap(r.get(key) or "", face, 14, cell_w - 20, limit=3)
            yy = ry + row_h / 2 - (len(lines) - 1) * 9 + 5
            for j, ln in enumerate(lines):
                out.append(core.text(col + 10, yy + j * 19, ln, 14, _ink(p), face))
        marks = cites_marks(r.get("cites"))
        if marks:
            out.append(core.text(x + w - 20, ry + row_h / 2 + 5, marks, FS_MIN,
                                 _acc(p, 0), face, bold=True, anchor="end"))
        ry += row_h
    return out


# --------------------------------------------------------------------- steps

def steps_measure(block: Dict, w: float, f, p) -> int:
    n = len(block.get("steps") or [])
    if f.aspect < 1.0:
        return _pad(block.get("title")) + n * 64 + 8
    return _pad(block.get("title")) + 150


def steps_draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    face = _face(p)
    steps = list(block.get("steps") or [])
    out = _panel(x, y, w, h, p, block.get("title"))
    top = y + _pad(block.get("title"))
    if f.aspect < 1.0:
        row_h = (y + h - 12 - top) / max(1, len(steps))
        for i, st in enumerate(steps):
            cy = top + i * row_h
            out.append(core.circle(x + 34, cy + 22, 14, fill=_acc(p, 0, p.card)))
            out.append(core.text(x + 34, cy + 27, str(i + 1), 14,
                                 core.pick_ink(p.accents[0]), face, bold=True,
                                 anchor="middle"))
            if i < len(steps) - 1:
                out.append(core.line(x + 34, cy + 38, x + 34, cy + row_h + 6,
                                     _hairline(p), 2))
            tt, tf = _clip(st.get("title"), face, 15, w - 100, bold=True)
            out.append(_titled(x + 58, cy + 20, tt, tf, 15, _ink(p), face, bold=True))
            marks = cites_marks(st.get("cites"))
            if marks:
                out.append(core.text(x + 58 + core.text_width(tt, face, 15, True) + 4,
                                     cy + 11, marks, FS_MIN, _acc(p, 0), face, bold=True))
            body = core.wrap(st.get("text") or "", face, 14, w - 100, limit=2)
            for j, ln in enumerate(body):
                out.append(core.text(x + 58, cy + 40 + j * 18, ln, 14, _mut(p), face))
        return out
    n = len(steps)
    gap = 12
    card_w = (w - 36 - (n - 1) * gap) / max(1, n)
    ch = h - (top - y) - 14
    for i, st in enumerate(steps):
        cx = x + 18 + i * (card_w + gap)
        out.append(core.rect(cx, top, card_w, ch, fill=core.shade(p.card, 0.05 if p.tone == "dark" else -0.035),
                             stroke=p.border, sw=1, r=10))
        out.append(core.circle(cx + 22, top + 24, 14, fill=_acc(p, i, p.card)))
        out.append(core.text(cx + 22, top + 29, str(i + 1), 14,
                             core.pick_ink(p.accents[i % len(p.accents)]),
                             face, bold=True, anchor="middle"))
        tt, tf = _clip(st.get("title"), face, 15, card_w - 52, bold=True)
        out.append(_titled(cx + 42, top + 29, tt, tf, 15, _ink(p), face, bold=True))
        marks = cites_marks(st.get("cites"))
        if marks:
            out.append(core.text(cx + card_w - 10, top + 29, marks, FS_MIN,
                                 _acc(p, 0), face, bold=True, anchor="end"))
        body = core.wrap(st.get("text") or "", face, 14, card_w - 20, limit=4)
        for j, ln in enumerate(body):
            out.append(core.text(cx + 12, top + 56 + j * 19, ln, 14, _mut(p), face))
        if i < n - 1:
            ax = cx + card_w + 2
            out.append(core.text(ax + gap / 2 - 3, top + ch / 2 + 6, "→", 18,
                                 _mut(p), face, anchor="middle"))
    return out


# --------------------------------------------------------------------- quote

def quote_measure(block: Dict, w: float, f, p) -> int:
    face = _face(p)
    n = len(core.wrap(str(block.get("text") or ""), face, 20, w - 60, limit=4))
    return _pad(block.get("title")) + 20 + n * 28 + 30


def quote_draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    face = _face(p)
    out = _panel(x, y, w, h, p, block.get("title"))
    top = y + _pad(block.get("title"))
    acc = _acc(p, 0, p.card)
    out.append(core.text(x + 18, top + 26, "“", 44, acc, face, bold=True))
    lines = core.wrap(str(block.get("text") or ""), face, 20, w - 70, limit=4)
    yy = top + 26
    for ln in lines:
        out.append(core.text(x + 52, yy, ln, 20, _ink(p), face))
        yy += 28
    who = str(block.get("who") or "").strip()
    if who:
        out.append(core.text(x + 52, yy + 8, f"— {who}", 14, _mut(p), face))
        yy += 26
    marks = cites_marks(block.get("cites"))
    if marks:
        out.append(core.text(x + w - 20, y + h - 16, marks, FS_MIN, acc, face,
                             bold=True, anchor="end"))
    return out


# --------------------------------------------------------------------- facts

def facts_measure(block: Dict, w: float, f, p) -> int:
    face = _face(p)
    hgt = _pad(block.get("title")) + 8
    for it in block.get("items") or []:
        n = len(core.wrap(str(it.get("text") or ""), face, 14, w - 76, limit=2))
        hgt += max(40, n * 19 + 14)
    return hgt


def facts_draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    face = _face(p)
    items = list(block.get("items") or [])
    out = _panel(x, y, w, h, p, block.get("title"))
    top = y + _pad(block.get("title")) + 4
    avail = y + h - 12 - top
    row_h = avail / max(1, len(items))
    for i, it in enumerate(items):
        cy = top + i * row_h
        acc = _acc(p, i, p.card)
        out.append(icons.draw(it.get("icon") or "hash", x + 20, cy + 6, 22, acc, 2.0))
        lines = core.wrap(str(it.get("text") or ""), face, 14, w - 78, limit=2)
        for j, ln in enumerate(lines):
            out.append(core.text(x + 54, cy + 20 + j * 19, ln, 14, _ink(p), face))
        marks = cites_marks(it.get("cites"))
        if marks:
            out.append(core.text(x + w - 20, cy + 20, marks, FS_MIN, acc, face,
                                 bold=True, anchor="end"))
        if i < len(items) - 1:
            out.append(core.line(x + 18, cy + row_h, x + w - 18, cy + row_h,
                                 _hairline(p), 1))
    return out


# ------------------------------------------------------------------ registry

_MEASURE = {
    "stat": stat_measure, "bar": bar_measure, "share": share_measure,
    "trend": trend_measure, "timeline": timeline_measure,
    "compare": compare_measure, "steps": steps_measure,
    "quote": quote_measure, "facts": facts_measure,
}
_DRAW = {
    "stat": stat_draw, "bar": bar_draw, "share": share_draw,
    "trend": trend_draw, "timeline": timeline_draw,
    "compare": compare_draw, "steps": steps_draw,
    "quote": quote_draw, "facts": facts_draw,
}

#: which types fill leftover space when the row is given extra height
GROWABLE = {"bar", "share", "trend", "timeline", "compare", "steps"}
#: drop priority on overflow — lowest-value real estate first
DROP_ORDER = {"facts": 0, "quote": 1, "stat": 2}


def measure(block: Dict, w: float, f, p) -> int:
    fn = _MEASURE.get(block.get("type"))
    return fn(block, w, f, p) if fn else 80


def draw(block: Dict, x: float, y: float, w: float, h: float, f, p) -> List[str]:
    fn = _DRAW.get(block.get("type"))
    return fn(block, x, y, w, h, f, p) if fn else []


def render_block(block: Dict, p, width: int = 960, height: int = 420,
                 inline: bool = True) -> str:
    """A single block as a standalone SVG — the slide-deck reuse path."""
    from .templates import Frame
    f = Frame(int(width), int(height))
    pad = 10
    els = draw(block, pad, pad, width - 2 * pad, height - 2 * pad, f, p)
    prolog = "" if inline else '<?xml version="1.0" encoding="UTF-8"?>'
    return (f'{prolog}<svg xmlns="http://www.w3.org/2000/svg" '
            f'width="{int(width)}" height="{int(height)}" '
            f'viewBox="0 0 {int(width)} {int(height)}" role="img">'
            f'{core.rect(0, 0, width, height, fill=p.paper)}'
            f'{"".join(els)}</svg>')


__all__ = ["FS_MIN", "measure", "draw", "render_block",
           "cites_marks", "GROWABLE", "DROP_ORDER"]
