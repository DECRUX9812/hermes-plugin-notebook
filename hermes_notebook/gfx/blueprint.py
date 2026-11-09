"""The blueprint_evolution template — a multi-zone engineering poster.

This is not another tile grid. It is a fixed architectural composition with five
zones and a Sankey conduit running between them, drawn to exact coordinates so
the same statement the schema extracts is the statement the poster makes:

    Zone 1  x  40..280   current gaps           (5 slate cards)
    Zone 2  x 310..610   evolution matrix       (5-row comparison table)
    Zone 3  -            Sankey conduit          (grey in -> collar -> 5 ribbons)
    Zone 4  x 650..1160  core pillars            (5 colour-matched pills)
    Zone 5  y 585..875   expansion + validation  (4-step ladder, 2x2 benches)

Coordinates are authored on a 1200x900 base and multiplied by ``f.w / 1200``,
so a 2400x1800 render is the same poster at twice the resolution rather than a
different layout. Every gap is reserved before anything is placed, and the
whole thing is measured by ``tests/test_gfx_layout.py``: the zone geometry is
part of the contract, not a suggestion.

The five signal colours are fixed by the spec (amber / purple / cyan / coral /
emerald): a reader learns that amber means compute and emerald means interchange
after one poster, so a notebook cannot repaint them per run. Surfaces, by
contrast, follow the preset — a dark theme gets dark cards with the same
ribbons, and every ink is resolved through ``core.readable`` against the surface
it actually sits on.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Sequence, Tuple

from . import core, isometrics

RGB = Tuple[int, int, int]

#: Base canvas the coordinates below are authored on.
BASE_W, BASE_H = 1200, 900

#: The five signal colours, in the order the spec fixes them.
SIGNAL: Tuple[RGB, ...] = (
    (245, 158, 11),    # amber    — core engine / physics / compute
    (139, 92, 246),    # purple   — graph / control / logic
    (6, 182, 212),     # cyan     — rendering / pipeline / state
    (239, 68, 68),     # coral    — telemetry / diagnostics / power
    (16, 185, 129),    # emerald  — interchange / API / export
)
SIGNAL_NAMES = ("amber", "purple", "cyan", "coral", "emerald")

#: The zone rectangles, authored in base units.
Z_HEADER = (40, 24, 1160, 66)
Z1 = (40, 90, 240, 470)      # x, y, w, h  -> x ends at 280
Z2 = (310, 90, 300, 470)     #              -> ends at 610
Z4 = (650, 90, 510, 470)     #              -> ends at 1160
Z5L = (40, 585, 580, 290)    #              -> ends at 620
Z5R = (650, 585, 510, 290)   #              -> ends at 1160

#: Ribbon geometry.
COLLAR = (296, 310, 20, 50)          # x, y, w, h
RIBBON_IN_X = 280                     # right edge of zone 1
RIBBON_OUT_X = 650                    # left edge of zone 4
RIBBON_W = 9.0                        # stroke thickness of a ribbon
RIBBON_ARROW_W = 7.0


class _Skin:
    """Surfaces and inks for one render, resolved against the preset's tone."""

    def __init__(self, p: Any):
        light = getattr(p, "tone", "light") != "dark"
        if light:
            self.paper: RGB = (248, 250, 252)
            self.card: RGB = (255, 255, 255)
            self.slate: RGB = (241, 245, 249)
            self.slate_line: RGB = (148, 163, 184)
            self.ink: RGB = (15, 23, 42)
            self.muted: RGB = (71, 85, 105)
            self.hair: RGB = (203, 213, 225)
            self.on_dark: RGB = (248, 250, 252)
        else:
            self.paper = p.paper
            self.card = p.card
            self.slate = core.mix(p.paper, p.ink, 0.10)
            self.slate_line = core.mix(p.ink, p.paper, 0.42)
            self.ink = p.ink
            self.muted = p.muted
            self.hair = core.mix(p.ink, p.paper, 0.55)
            self.on_dark = p.ink
        self.light = light

    def ink_on(self, surface: RGB) -> RGB:
        """Readable ink for a surface this template paints."""
        return core.readable(self.ink, surface, 4.5)

    def quiet_on(self, surface: RGB) -> RGB:
        return core.readable(self.muted, surface, 4.0)

    def tint(self, accent: RGB, k: float) -> RGB:
        """A surface tinted by an accent, dark enough for readable text."""
        return core.mix(self.card, accent, k) if self.light else core.mix(self.paper, accent, k)


# ------------------------------------------------------------------ parsing


def _list(g: Dict[str, Any], key: str, limit: int) -> List[Dict[str, Any]]:
    raw = g.get(key)
    if not isinstance(raw, (list, tuple)):
        return []
    out = [x for x in raw if isinstance(x, dict)][:limit]
    return out


def _s(v: Any, limit: int = 120) -> str:
    return str(v or "").strip()[:limit]


def _gaps(g: Dict[str, Any]) -> List[Dict[str, str]]:
    """5 current-gap cards, with a graceful shape from generic keys."""
    items = _list(g, "current_gaps", 5)
    if not items:
        # degrade: a tension or a stat can stand in for a gap, honestly labelled
        for t in _list(g, "tensions", 5):
            items.append({"title": _s(t.get("topic"), 46),
                          "spec": _s(t.get("why") or t.get("resolution"), 110),
                          "icon_type": "iso_grid_cube"})
    while len(items) < 5:
        items.append({"title": f"Gap {len(items) + 1}", "spec": "unspecified in the sources",
                      "icon_type": "iso_grid_cube"})
    out = []
    for it in items:
        out.append({
            "title": _s(it.get("title") or it.get("label") or it.get("name"), 52) or "Untitled gap",
            "spec": _s(it.get("spec") or it.get("description") or it.get("detail"), 130),
            "icon_type": _s(it.get("icon_type"), 40) or "iso_grid_cube",
        })
    return out


def _matrix(g: Dict[str, Any]) -> List[Dict[str, str]]:
    rows = _list(g, "evolution_matrix", 5)
    while len(rows) < 5:
        rows.append({})
    return [{
        "domain": _s(r.get("domain") or r.get("area") or f"Domain {i + 1}", 34),
        "before": _s(r.get("before_label") or r.get("before") or r.get("current"), 46),
        "after": _s(r.get("after_label") or r.get("after") or r.get("target"), 46),
        "upgrade": _s(r.get("key_upgrade") or r.get("upgrade") or r.get("why"), 90),
    } for i, r in enumerate(rows)]


def _pillars(g: Dict[str, Any]) -> List[Dict[str, str]]:
    items = _list(g, "core_pillars", 5)
    while len(items) < 5:
        items.append({})
    return [{
        "title": _s(it.get("title") or it.get("label"), 40) or SIGNAL_NAMES[i].upper(),
        "spec": _s(it.get("concise_spec") or it.get("spec") or it.get("description"), 120),
        "diagram_type": _s(it.get("diagram_type") or it.get("diagram"), 40),
        "accent": _s(it.get("accent_color") or it.get("accent"), 40),
    } for i, it in enumerate(items)]


def _stages(g: Dict[str, Any]) -> List[Dict[str, str]]:
    items = _list(g, "expansion_stages", 4)
    while len(items) < 4:
        items.append({})
    return [{
        "label": _s(it.get("label") or it.get("stage") or it.get("title"), 40) or f"Stage {i + 1}",
        "detail": _s(it.get("detail") or it.get("metric") or it.get("spec"), 90),
        "value": _s(it.get("value") or it.get("scale"), 28),
    } for i, it in enumerate(items)]


def _benches(g: Dict[str, Any]) -> List[Dict[str, str]]:
    items = _list(g, "validation_benches", 4)
    while len(items) < 4:
        items.append({})
    return [{
        "title": _s(it.get("title") or it.get("name"), 44) or f"Bench {i + 1}",
        "criteria": _s(it.get("test_criteria") or it.get("criteria") or it.get("spec"), 120),
        "icon": _s(it.get("bench_icon") or it.get("icon"), 40) or "test_ramp_and_rig",
    } for i, it in enumerate(items)]


# ------------------------------------------------------------------ drawing


def _ribbon_path(x0: float, y0: float, x1: float, y1: float,
                 collar: Tuple[float, float]) -> str:
    """Cubic S from the left card to the right pillar, bent through the collar.

    Two cubics, not one: the first leg must arrive at the collar's x with a
    horizontal tangent, or five ribbons cross each other in the middle and the
    Sankey reads as a scribble.
    """
    cx, cy = collar
    leg1 = (f"M {x0:.1f} {y0:.1f} C {x0 + (cx - x0) * 0.55:.1f} {y0:.1f} "
            f"{cx - (cx - x0) * 0.45:.1f} {cy:.1f} {cx:.1f} {cy:.1f}")
    leg2 = (f" C {cx + (x1 - cx) * 0.32:.1f} {cy:.1f} "
            f"{x1 - (x1 - cx) * 0.42:.1f} {y1:.1f} {x1:.1f} {y1:.1f}")
    return leg1 + leg2


def _sankey(fw: float, s: "_Skin", z1_mids: Sequence[float],
            z4_mids: Sequence[float], S: float) -> List[str]:
    """The conduit layer: grey inputs, a metal collar, five colour ribbons."""
    out: List[str] = []
    cx = COLLAR[0] * S
    collar_y = (COLLAR[1] + COLLAR[3] / 2) * S
    collar_h = COLLAR[3] * S
    for i in range(5):
        y0, y1 = z1_mids[i], z4_mids[i]
        accent = SIGNAL[i]
        # grey input leg (leg 1 only)
        leg1 = (f"M {RIBBON_IN_X * S:.1f} {y0:.1f} C "
                f"{(RIBBON_IN_X + (cx / S - RIBBON_IN_X) * 0.55) * S:.1f} {y0:.1f} "
                f"{(cx / S - (cx / S - RIBBON_IN_X) * 0.45) * S:.1f} {collar_y:.1f} "
                f"{cx:.1f} {collar_y:.1f}")
        out.append(core.path(leg1, fill=None, stroke=s.slate_line, sw=RIBBON_W * S * 0.55,
                             opacity=0.85))
        # colour leg (leg 2 only)
        leg2 = (f"M {cx:.1f} {collar_y:.1f} C "
                f"{(cx / S + (RIBBON_OUT_X - cx / S) * 0.32) * S:.1f} {collar_y:.1f} "
                f"{(RIBBON_OUT_X - (RIBBON_OUT_X - cx / S) * 0.42) * S:.1f} {y1:.1f} "
                f"{RIBBON_OUT_X * S:.1f} {y1:.1f}")
        out.append(core.path(leg2, fill=None, stroke=accent, sw=RIBBON_W * S, opacity=0.92))
        # arrowhead landing on the pillar's left edge
        out.append(core.path(
            f"M {RIBBON_OUT_X * S:.1f} {y1:.1f} L {(RIBBON_OUT_X - 9) * S:.1f} "
            f"{(y1 - 6 * S):.1f} L {(RIBBON_OUT_X - 9) * S:.1f} {(y1 + 6 * S):.1f} Z",
            fill=accent, stroke=None, close=True))
        # collar socket for this ribbon
        out.append(core.circle(cx, collar_y, 3.2 * S, fill=accent,
                               stroke=s.paper, sw=1.2 * S))

    # the metallic collar itself, drawn after the legs so it reads as a clamp
    out.append(core.rect(COLLAR[0] * S, COLLAR[1] * S, COLLAR[2] * S, collar_h,
                         fill=core.mix(s.slate_line, s.card, 0.55),
                         stroke=core.shade(s.slate_line, -0.18), sw=1.4 * S,
                         r=5 * S))
    for k in range(5):
        out.append(core.line(COLLAR[0] * S + 2 * S,
                             (COLLAR[1] + 6 + k * 9) * S,
                             (COLLAR[0] + COLLAR[2]) * S - 2 * S,
                             (COLLAR[1] + 6 + k * 9) * S,
                             core.shade(s.slate_line, -0.10), 0.8 * S, opacity=0.6))
    # five sockets, matching the ribbons entering them — one per signal colour
    for k in range(5):
        out.append(core.circle((COLLAR[0] + COLLAR[2] / 2) * S,
                               (COLLAR[1] + 7 + k * 9) * S, 1.6 * S,
                               fill=core.shade(s.slate_line, -0.3)))
    return out


def _zone1_cards(s: "_Skin", gaps: Sequence[Dict[str, str]], S: float) -> Tuple[List[str], List[float]]:
    """Five slate cards with an isometric icon slot and title + spec."""
    out: List[str] = []
    x, y, w, h = (v * S for v in Z1)
    card_h = (h - 4 * 9 * S) / 5
    mids: List[float] = []
    for i, gap in enumerate(gaps):
        cy = y + i * (card_h + 9 * S)
        mids.append(cy + card_h / 2)
        out.append(core.rect(x, cy, w, card_h, fill=s.slate, stroke=s.slate_line,
                             sw=1.0 * S, r=6 * S))
        # icon slot on the left
        slot = min(card_h - 14 * S, 56 * S)
        out += isometrics.draw(gap["icon_type"], x + 8 * S, cy + (card_h - slot) / 2,
                               slot, s.slate_line if s.light else core.mix(s.muted, s.paper, 0.5),
                               s.slate, )
        tx = x + 8 * S + slot + 10 * S
        tw = w - (tx - x) - 10 * S
        out.append(core.text(tx, cy + 22 * S, core.clip(gap["title"], "sans", 15 * S, tw, bold=True),
                             15 * S, s.ink_on(s.slate), "sans", bold=True))
        spec = gap["spec"]
        lines = core.wrap(spec, "sans", 11.5 * S, tw, limit=2) if spec else []
        ly = cy + 39 * S
        for line in lines:
            out.append(core.text(tx, ly, line, 11.5 * S, s.quiet_on(s.slate), "sans"))
            ly += 14 * S
        # the "legacy" state marker: a desaturated corner tag
        out.append(core.text(x + w - 10 * S, cy + 15 * S, "LEGACY", 9 * S,
                             s.slate_line, "sans", bold=True, tracking=1.2 * S, anchor="end"))
    return out, mids


def _zone2_matrix(s: "_Skin", rows: Sequence[Dict[str, str]], S: float) -> List[str]:
    """The evolution matrix: domain, before -> after, key upgrade."""
    out: List[str] = []
    x, y, w, h = (v * S for v in Z2)
    out.append(core.rect(x, y, w, h, fill=s.card, stroke=s.hair, sw=1.0 * S, r=10 * S))
    out.append(core.text(x + 14 * S, y + 24 * S, "CAPABILITY EVOLUTION MATRIX",
                         11.5 * S, s.ink_on(s.card), "sans", bold=True, tracking=1.6 * S))
    out.append(core.line(x + 14 * S, y + 32 * S, x + w - 14 * S, y + 32 * S,
                         s.hair, 1.0 * S))

    # column geometry inside the card
    pad = 14 * S
    col_dom = x + pad
    dom_w = 74 * S
    arrow_x = x + pad + dom_w + (w - 2 * pad - dom_w) * 0.50
    body_top = y + 46 * S
    row_h = (h - (body_top - y) - 12 * S) / 5

    for i, row in enumerate(rows):
        ry = body_top + i * row_h
        if i:
            out.append(core.line(x + pad, ry, x + w - pad, ry, s.hair, 0.7 * S, opacity=0.55))
        accent = SIGNAL[i]
        # domain
        out.append(core.text(col_dom, ry + row_h * 0.38,
                             core.clip(row["domain"], "sans", 12 * S, dom_w, bold=True),
                             12 * S, s.ink_on(s.card), "sans", bold=True))
        out.append(core.rect(col_dom, ry + row_h * 0.46, 16 * S, 2.4 * S, fill=accent, r=1 * S))

        # before (grey chip) -> after (coloured chip)
        bx = col_dom + dom_w
        chip_w = (arrow_x - bx) - 16 * S
        before = row["before"] or "—"
        after = row["after"] or "—"
        chip_h = row_h * 0.34
        out.append(core.rect(bx, ry + row_h * 0.22, chip_w, chip_h, fill=s.slate,
                             stroke=s.slate_line, sw=0.8 * S, r=3 * S))
        out.append(core.text(bx + 5 * S, ry + row_h * 0.22 + chip_h * 0.72,
                             core.clip(before, "sans", 10 * S, chip_w - 10 * S),
                             10 * S, s.quiet_on(s.slate), "sans"))
        # the arrow between the two states
        ay = ry + row_h * 0.22 + chip_h + row_h * 0.20
        out.append(core.path(
            f"M {bx + chip_w * 0.12:.1f} {ay:.1f} L {bx + chip_w * 0.78:.1f} {ay:.1f}",
            fill=None, stroke=s.slate_line, sw=1.1 * S))
        out.append(core.path(
            f"M {bx + chip_w * 0.92:.1f} {ay:.1f} l {-5 * S} {-3.2 * S} l 0 {6.4 * S} Z",
            fill=accent, stroke=None, close=True))
        # after chip on the other side of the arrow
        ax = arrow_x + 12 * S
        aw = x + w - pad - ax
        out.append(core.rect(ax, ay - chip_h * 0.5, aw, chip_h * 0.95,
                             fill=s.tint(accent, 0.14), stroke=accent, sw=0.9 * S, r=3 * S))
        out.append(core.text(ax + 5 * S, ay + chip_h * 0.26,
                             core.clip(after, "sans", 10 * S, aw - 10 * S),
                             10 * S, s.ink_on(s.tint(accent, 0.14)), "sans", bold=True))
        # key upgrade, under the chips
        up = row["upgrade"]
        if up:
            out.append(core.text(bx, ry + row_h * 0.94,
                                 core.clip(up, "sans", 9.5 * S, x + w - pad - bx),
                                 9.5 * S, s.quiet_on(s.card), "sans"))
    return out


def _zone4_pillars(s: "_Skin", pillars: Sequence[Dict[str, str]], S: float) -> Tuple[List[str], List[float]]:
    """Five colour-matched pills, each with a technical diagram callout."""
    out: List[str] = []
    x, y, w, h = (v * S for v in Z4)
    card_h = (h - 4 * 9 * S) / 5
    mids: List[float] = []
    for i, pil in enumerate(pillars):
        cy = y + i * (card_h + 9 * S)
        mids.append(cy + card_h / 2)
        accent = SIGNAL[i]
        surface = s.tint(accent, 0.10)
        out.append(core.rect(x, cy, w, card_h, fill=surface,
                             stroke=core.mix(accent, s.paper, 0.30), sw=1.2 * S,
                             r=24 * S))
        # a solid colour spine so the ribbon visibly continues into the card
        out.append(core.rect(x, cy, 7 * S, card_h, fill=accent, r=3.5 * S))
        # the diagram callout: a dark pane on one side, alternating per row
        pane_w = min(w * 0.30, 150 * S)
        pane_h = card_h - 16 * S
        pane_x = (x + w - pane_w - 12 * S) if i % 2 == 0 else (x + 16 * S)
        pane_y = cy + 8 * S
        dark = (17, 24, 39) if s.light else core.shade(s.paper, 0.22)
        out.append(core.rect(pane_x, pane_y, pane_w, pane_h, fill=dark,
                             stroke=core.mix(accent, dark, 0.45), sw=0.9 * S, r=6 * S))
        kind = pil["diagram_type"] or ("iso_grid_cube" if i % 2 == 0 else "oscilloscope_trace")
        out += isometrics.draw(kind, pane_x + 6 * S, pane_y + 6 * S,
                               min(pane_w, pane_h) - 12 * S, accent, dark)
        # title + spec on the other side
        tx = (x + 18 * S) if i % 2 == 0 else (pane_x + pane_w + 14 * S)
        tw = (w - 30 * S) if i % 2 == 0 else (pane_x - (x + 20 * S))
        tw = min(tw, w - 24 * S)
        out.append(core.text(tx, cy + 24 * S,
                             core.clip(pil["title"].upper(), "sans", 14 * S, tw, bold=True),
                             14 * S, s.ink_on(surface), "sans", bold=True, tracking=1.0 * S))
        spec = pil["spec"]
        lines = core.wrap(spec, "sans", 10.5 * S, tw, limit=2) if spec else []
        ly = cy + 40 * S
        for line in lines:
            out.append(core.text(tx, ly, line, 10.5 * S, s.quiet_on(surface), "sans"))
            ly += 13 * S
        # the signal name, as a quiet taxonomy tag
        out.append(core.text(tx + tw, cy + card_h - 8 * S, SIGNAL_NAMES[i].upper(),
                             9 * S, core.readable(accent, surface, 3.0), "sans",
                             bold=True, tracking=1.1 * S, anchor="end"))
    return out, mids


def _zone5_left(s: "_Skin", stages: Sequence[Dict[str, str]], S: float) -> List[str]:
    """A four-step progressive scale ladder with a caption under each step."""
    out: List[str] = []
    x, y, w, h = (v * S for v in Z5L)
    out.append(core.text(x, y + 16 * S, "DOMAIN & SCALE EXPANSION",
                         12 * S, s.ink_on(s.paper), "sans", bold=True, tracking=1.6 * S))
    out.append(core.rect(x, y + 24 * S, 40 * S, 2.4 * S, fill=SIGNAL[2], r=1 * S))

    # the ladder: four ascending bars, each wider and taller than the last
    base_y = y + 168 * S
    step_w = (w - 24 * S) / 4
    for i, st in enumerate(stages):
        bh = (30 + i * 26) * S
        bx = x + i * step_w + 6 * S
        bw = step_w - 12 * S
        accent = SIGNAL[i]
        out.append(core.rect(bx, base_y - bh, bw, bh, fill=s.tint(accent, 0.16),
                             stroke=accent, sw=1.1 * S, r=5 * S))
        # axial ticks inside the bar, so the stage reads as a measured volume
        for k in range(1, 4):
            out.append(core.line(bx, base_y - bh * k / 4, bx + bw, base_y - bh * k / 4,
                                 core.mix(accent, s.paper, 0.45), 0.6 * S, opacity=0.7))
        if st["value"]:
            out.append(core.text(bx + bw / 2, base_y - bh - 8 * S,
                                 core.clip(st["value"], "sans", 14 * S, bw, bold=True),
                                 14 * S, s.ink_on(s.paper), "sans", bold=True, anchor="middle"))
    # the floor the ladder stands on
    out.append(core.line(x, base_y, x + w, base_y, s.hair, 1.2 * S))
    for i in range(3):
        out.append(core.path(
            f"M {(x + (i + 1) * step_w - 6 * S):.1f} {(base_y - 8 * S):.1f} "
            f"L {(x + (i + 2) * step_w + 6 * S):.1f} {(base_y - 8 * S):.1f}",
            fill=None, stroke=s.muted, sw=0.8 * S))

    # the four captions under the ladder
    cap_y = y + 196 * S
    for i, st in enumerate(stages):
        bx = x + i * step_w + 6 * S
        bw = step_w - 12 * S
        out.append(core.text(bx, cap_y, core.clip(st["label"], "sans", 11 * S, bw, bold=True),
                             11 * S, s.ink_on(s.paper), "sans", bold=True))
        lines = core.wrap(st["detail"], "sans", 9.5 * S, bw, limit=2) if st["detail"] else []
        ly = cap_y + 13 * S
        for line in lines:
            out.append(core.text(bx, ly, line, 9.5 * S, s.quiet_on(s.paper), "sans"))
            ly += 11.5 * S
    return out


def _zone5_right(s: "_Skin", benches: Sequence[Dict[str, str]], S: float) -> List[str]:
    """A 2x2 validation bench grid: schematic, title, criteria."""
    out: List[str] = []
    x, y, w, h = (v * S for v in Z5R)
    out.append(core.text(x, y + 16 * S, "INTERACTIVE VALIDATION BENCHES",
                         12 * S, s.ink_on(s.paper), "sans", bold=True, tracking=1.6 * S))
    out.append(core.rect(x, y + 24 * S, 40 * S, 2.4 * S, fill=SIGNAL[3], r=1 * S))

    gap = 10 * S
    cw = (w - gap) / 2
    ch = (h - 34 * S - gap) / 2
    for i, b in enumerate(benches):
        r, c = divmod(i, 2)
        bx = x + c * (cw + gap)
        by = y + 34 * S + r * (ch + gap)
        accent = SIGNAL[i]
        out.append(core.rect(bx, by, cw, ch, fill=s.card, stroke=s.hair, sw=1.0 * S, r=8 * S))
        # a tinted header strip carrying the bench number and its signal colour
        out.append(core.rect(bx, by, cw, 22 * S, fill=s.tint(accent, 0.18), r=8 * S))
        out.append(core.rect(bx, by + 14 * S, cw, 8 * S, fill=s.tint(accent, 0.18)))
        out.append(core.text(bx + 8 * S, by + 15 * S,
                             f"BENCH {i + 1:02d}", 9 * S,
                             s.ink_on(s.tint(accent, 0.18)), "mono", bold=True, tracking=1.0 * S))
        out.append(core.text(bx + cw - 8 * S, by + 15 * S, "PASS/FAIL", 9 * S,
                             core.readable(accent, s.tint(accent, 0.18), 3.0),
                             "mono", anchor="end"))
        # schematic
        icon = min(cw * 0.30, ch * 0.46)
        out += isometrics.draw(b["icon"], bx + 8 * S, by + 28 * S, icon, accent, s.card)
        tx = bx + 12 * S + icon
        tw = cw - (tx - bx) - 10 * S
        out.append(core.text(tx, by + 40 * S,
                             core.clip(b["title"], "sans", 11 * S, tw, bold=True),
                             11 * S, s.ink_on(s.card), "sans", bold=True))
        lines = core.wrap(b["criteria"], "sans", 9 * S, tw, limit=2) if b["criteria"] else []
        ly = by + 54 * S
        for line in lines:
            out.append(core.text(tx, ly, line, 9 * S, s.quiet_on(s.card), "sans"))
            ly += 11 * S
    return out


def render(f: Any, p: Any, g: Dict[str, Any], detail: str = "standard",
           **_: Any) -> Tuple[List[str], int, int]:
    """Draw the whole poster. Returns (elements, band_y, band_h) = full canvas."""
    S = f.w / BASE_W
    s = _Skin(p)
    els: List[str] = []

    # canvas
    els.append(core.rect(0, 0, f.w, f.h, fill=s.paper))

    # ---------- header
    title = _s(g.get("title"), 120) or "Architecture & Gap Analysis"
    sub = _s(g.get("subtitle") or g.get("takeaway"), 90)
    els.append(core.text(Z_HEADER[0] * S, 52 * S, core.clip(title, "sans", 28 * S,
                     Z_HEADER[2] * S * 0.62, bold=True),
                     28 * S, s.ink_on(s.paper), "sans", bold=True))
    els.append(core.text(Z_HEADER[0] * S, 74 * S,
                     "ENGINEERING GAP ANALYSIS  ·  NEXT-GEN BLUEPRINT",
                     11 * S, core.readable(SIGNAL[0], s.paper, 4.5), "sans",
                     bold=True, tracking=2.2 * S))
    if sub:
        # anchor="end" at x = 1200 put the subtitle ONE canvas-width off the sheet
        # (x was already the full header width, not an inside margin) — it
        # rendered at x=1200 and was clipped away entirely, leaving the header's
        # right half blank. The right edge is the sheet's own margin.
        # A 13px subtitle with a hairline above it reads as a title block; at 11px
        # it read as a caption and left the header visually lopsided.
        sub_lines = core.wrap(sub, "sans", 13 * S, Z_HEADER[2] * S * 0.40, limit=1)
        for i, line in enumerate(sub_lines):
            els.append(core.text((BASE_W - Z_HEADER[0]) * S, (44 + i * 15) * S, line,
                                 13 * S, s.quiet_on(s.paper), "sans", anchor="end"))
        els.append(core.line((BASE_W - Z_HEADER[0] - 4) * S, 62 * S,
                             (BASE_W - Z_HEADER[0]) * S, 62 * S, s.hair, 1.2 * S))
    els.append(core.line(Z_HEADER[0] * S, 84 * S, Z_HEADER[0] * S + Z_HEADER[2] * S,
                         84 * S, s.hair, 1.4 * S))

    # ---------- zone 1 and zone 4 first, so the Sankey can target their mid-lines
    gaps = _gaps(g)
    pillars = _pillars(g)
    z1_els, z1_mids = _zone1_cards(s, gaps, S)
    z4_els, z4_mids = _zone4_pillars(s, pillars, S)

    # ---------- zone 3: the conduit goes UNDER both column layers
    els += _sankey(f.w, s, z1_mids, z4_mids, S)
    els += z1_els
    els += z4_els

    # ---------- zone 2 sits on top of the conduit, between the two columns
    els += _zone2_matrix(s, _matrix(g), S)

    # ---------- zone 5
    els += _zone5_left(s, _stages(g), S)
    els += _zone5_right(s, _benches(g), S)

    # source stamp, bottom-right of the sheet
    stamp = _s(g.get("source"), 80)
    if stamp:
        els.append(core.text((BASE_W - 40) * S, (BASE_H - 10) * S,
                         core.clip(stamp, "sans", 9 * S, 400 * S), 9 * S,
                         s.quiet_on(s.paper), "sans", anchor="end"))
    return els, f.h, 0


def zones() -> Dict[str, Tuple[int, int, int, int]]:
    """The authored zone rectangles, in base units — for docs and tests."""
    return {"header": Z_HEADER, "gaps": Z1, "matrix": Z2, "pillars": Z4,
            "expansion": Z5L, "benches": Z5R}
