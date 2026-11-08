"""Templates — compositions built from the primitives.

A template receives a `Frame` (canvas size + margins), a `Preset` and a graphic
dict, and returns SVG elements. Templates never look at style ids; they read
layout family, palette and art treatment off the preset, which is what makes one
engine serve every look.

Available templates:

| id            | what it composes                                      |
|---------------|-------------------------------------------------------|
| `infographic` | title, stat tiles, key facts, takeaway (4 families)   |
| `key_figure`  | one dominant number, its label, supporting facts      |
| `stat_grid`   | compact tiles only — dashboards, snapshots            |
| `quote_card`  | one quote, attribution, portrait mark                 |
| `timeline`    | dated events down a measured spine                    |
| `comparison`  | two columns against one another                       |
| `process`     | numbered steps with connectors                        |
| `cover`       | title-led cover over the preset's artwork             |
| `illustration`| the preset's art treatment with a caption             |

Every template is tolerant: unknown keys, wrong types, empty lists and absurdly
long strings degrade to a smaller composition instead of raising.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from . import core, illustrate
from .themes import Preset

# ------------------------------------------------------------------- frame


class Frame:
    """Canvas geometry. One frame per render; templates get their budget from it."""

    def __init__(self, w: int, h: int, margin: Optional[int] = None):
        self.w = int(w)
        self.h = int(h)
        self.m = int(margin if margin is not None else round(min(w, h) * 0.055))
        self.gap = max(12, round(min(w, h) * 0.02))

    @property
    def inner(self) -> int:
        return self.w - 2 * self.m

    @property
    def aspect(self) -> float:
        return self.w / self.h

    @property
    def columns(self) -> int:
        """Wide sheets carry three tile columns; square and portrait carry two."""
        if self.aspect > 1.45:
            return 3
        return 2

    def bottom(self) -> int:
        return self.h - self.m


# ------------------------------------------------------------------ helpers


def _face(p: Preset) -> str:
    return p.typeface if p.typeface in core.FONT_STACK else "sans"


def _meta_line(p: Preset, shown: int, unit: str = "stats") -> str:
    word = unit[:-1] if shown == 1 and unit.endswith("s") else unit
    return f"{p.label} · {shown} {word}"


def header(f: Frame, p: Preset, title: str, meta: str = "",
           size_title: int = 0) -> Tuple[List[str], int]:
    """Kicker + title (+ quiet meta on the right). Returns (elements, content top)."""
    face = _face(p)
    kick = (p.kicker or "INFOGRAPHIC").upper()
    acc = p.accents[0]
    title_size = size_title or (56 if f.aspect > 1.45 else (50 if f.aspect > 0.9 else 46))
    out: List[str] = []

    if "outline" in p.decor:
        kw = core.text_width(kick, "sans", 20, True, 1.4) + 26
        out.append(core.rect(f.m - 4, 42, kw, 40, fill=p.ink, r=8))
        out.append(core.text(f.m + 9, 70, kick, 20, p.card, "sans", bold=True, tracking=1.4))
    else:
        out.append(core.text(f.m, 66, kick, 20, core.readable(acc, p.paper), "sans",
                             bold=True, tracking=3))
        out.append(core.rect(f.m, 78, 72, 3, fill=acc))

    if meta:
        out.append(core.text(f.w - f.m, 65, meta, 18, core.readable(p.muted, p.paper, 4.0),
                              face, anchor="end"))

    y = 92
    for line in core.wrap(title or "Untitled", face, title_size, f.inner, bold=True,
                          limit=2):
        out.append(core.text(f.m, y + title_size * 0.8, line, title_size, p.ink,
                             face, bold=True))
        y += int(title_size * 1.08)

    if "hairline" in p.decor:
        out += [core.line(f.m, y + 22, f.w - f.m, y + 22, p.ink, 2),
                core.line(f.m, y + 26, f.w - f.m, y + 26, core.shade(p.paper, -0.12), 1)]
        return out, y + 48
    return out, y + 26


def takeaway_measure(f: Frame, p: Preset, text: str) -> Tuple[int, int, List[str]]:
    """(size, band height, lines). Measured before anything else is placed."""
    text = str(text or "").strip()
    if not text:
        return 0, 0, []
    face = _face(p)
    for size in (24, 22, 20, 18):
        lines = core.wrap(text, face, size, f.inner - 56)
        if len(lines) <= 2:
            return size, 44 + len(lines) * (size + 9), lines
    return 18, 44 + 2 * 27, core.wrap(text, face, 18, f.inner - 56, limit=2)


def takeaway(f: Frame, p: Preset, text: str, band_y: int) -> List[str]:
    size, height, lines = takeaway_measure(f, p, text)
    if not lines:
        return []
    face = _face(p)
    tint = 0.10 if p.tone == "light" else 0.16
    rule_led = "hairline" in p.decor and p.tone == "light"
    bg = p.card if rule_led else core.mix(p.paper, p.accents[0], tint)
    out: List[str] = []
    if rule_led:
        out += [core.line(f.m, band_y, f.w - f.m, band_y, p.ink, 2),
                core.rect(f.m, band_y + 2, f.inner, height - 2, fill=bg)]
    else:
        out.append(core.rect(f.m, band_y, f.inner, height, fill=bg,
                             r=min(p.radius, 16) if p.radius else 0))
    out.append(core.rect(f.m, band_y, 5, height, fill=p.accents[0]))
    kick_fill = p.accents[0] if p.tone == "dark" else core.shade(p.accents[0], -0.18)
    out.append(core.text(f.m + 22, band_y + 30, "TAKEAWAY", 20,
                         core.readable(kick_fill, bg, 3.0), "sans", bold=True, tracking=2.6))
    ty = band_y + 44 + size
    for line in lines:
        out.append(core.text(f.m + 22, ty, line, size, core.readable(p.ink, bg), face))
        ty += size + 9
    return out


def facts_block(p: Preset, facts: Sequence[Dict[str, Any]], x: int, y: int, width: int,
                kicker: bool = True, size: int = 25) -> Tuple[List[str], int]:
    face = _face(p)
    out: List[str] = []
    if kicker:
        out.append(core.text(x, y + 14, "KEY FACTS", 20, p.muted, "sans", bold=True,
                             tracking=2.4))
        y += 32
    for q in facts:
        text = str(q.get("text", "")).strip()
        src = str(q.get("source") or "").strip()
        lines = core.wrap(text, face, size, width - 30, limit=2)
        out.append(core.rect(x, y + 5, 4, len(lines) * 32 - 7, fill=p.accents[0]))
        for j, line in enumerate(lines):
            out.append(core.text(x + 18, y + j * 32 + 22, line, size,
                                 core.readable(p.ink, p.paper), face))
        y += len(lines) * 32
        if src:
            out.append(core.text(x + 18, y + 20, core.clip(src, face, 18, width - 30),
                                 18, p.muted, face))
            y += 24
        y += 18
    return out, y


def facts_height(facts: Sequence[Dict[str, Any]], width: int, kicker: bool = True,
                 size: int = 25) -> int:
    h = 30 if kicker else 0
    for q in facts:
        text = str(q.get("text", ""))
        h += len(core.wrap(text, "sans", size, width - 30, limit=2)) * 32
        if str(q.get("source") or "").strip():
            h += 24
        h += 18
    return h


def tile(f: Frame, p: Preset, box: Tuple[float, float, float, float],
         stat: Dict[str, Any], accent: core.RGB, dense: bool = False,
         fill: Optional[core.RGB] = None) -> List[str]:
    """A measured stat tile: numeral shrinks until value+label(+detail) fit."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    face = _face(p)
    card = fill or p.card
    out: List[str] = []
    shadow = illustrate.card_shadow_attr(p)

    if "offset-shadow" in p.decor:
        out.append(core.rect(x0 + 7, y0 + 7, w, h, fill=p.ink))
    out.append(core.rect(x0, y0, w, h, fill=card, r=p.radius, extra=shadow))
    if p.border:
        out.append(core.rect(x0, y0, w, h, fill=None, stroke=p.border,
                             sw=3 if ("outline" in p.decor or "hard-border" in p.decor) else 1,
                             r=p.radius))

    pad = 18 if h < 130 else 20
    out.append(core.rect(x0 + pad, y0 + pad, 32, 4, fill=accent))

    value = str(stat.get("value", "")).strip()
    label = str(stat.get("label", "")).strip()
    detail = str(stat.get("detail") or "").strip()
    lsize = 19 if (dense or h < 150) else 23
    inner = w - 2 * pad
    top = pad + 24

    vsize, lab_lines, show_detail = 62, [], False
    for cand in range(62 if not dense else 54, 26, -2):
        lab = core.wrap(label, face, lsize, inner, limit=2)
        need = top + cand + 10 + len(lab) * (lsize + 6) + ((18 + 8) if detail else 0)
        if need <= h - pad // 2:
            vsize, lab_lines, show_detail = cand, lab, bool(detail)
            break
        vsize, lab_lines = cand, lab
    out.append(core.text(x0 + pad, y0 + top + vsize * 0.82, value, vsize,
                         core.readable(accent, card), face, bold=True))

    ly = y0 + top + vsize + 10 + lsize * 0.8
    for line in lab_lines:
        out.append(core.text(x0 + pad, ly, line, lsize, core.readable(p.ink, card), face))
        ly += lsize + 6
    if show_detail and ly + 18 <= y1 - 6:
        out.append(core.text(x0 + pad, ly + 20, core.clip(detail, face, 18, inner), 18,
                             p.muted if core.contrast(p.muted, card) > 4.0
                             else core.readable(p.muted, card), face))
    return out


def _detail_caps(detail: str) -> Tuple[int, int]:
    detail = str(detail or "").lower()
    if detail.startswith("concise") or detail == "short":
        return 3, 1
    if detail.startswith("detailed") or detail == "long":
        return 8, 4
    return 6, 3


def _split_stats(f: Frame, stats: List[Dict[str, Any]], cols: int) -> List[List[Dict[str, Any]]]:
    rows = int(math.ceil(len(stats) / cols)) if stats else 0
    return [stats[i * cols:(i + 1) * cols] for i in range(rows)]


# ------------------------------------------------------------------ families


def _family_cards(f: Frame, p: Preset, g: Dict[str, Any], y0: int, y1: int,
                  detail: str) -> List[str]:
    face = _face(p)
    cap_stats, cap_facts = _detail_caps(detail)
    stats = core.sequence(g.get("stats"), cap_stats)
    facts = core.sequence(g.get("quotes"), cap_facts)
    out: List[str] = []

    n = max(1, len(stats))
    cols = min(f.columns, n) if n < 3 else f.columns
    nrows = int(math.ceil(n / cols))
    tw = (f.inner - (cols - 1) * f.gap) // cols

    avail = y1 - y0
    floor = 118 if nrows > 1 else 150
    block = nrows * floor + (nrows - 1) * f.gap
    rows: List[Dict[str, Any]] = []
    for k in range(len(facts), -1, -1):
        if facts_height(facts[:k], f.inner) + 22 <= avail - block:
            rows = list(facts[:k])
            break
    fact_h = (facts_height(rows, f.inner) + 22) if rows else 0
    grid_bottom = y1 - fact_h
    th = min(200, (grid_bottom - y0 - (nrows - 1) * f.gap) // nrows)

    bento = p.family == "cards" and p.id == "bento"
    for i, stat in enumerate(stats):
        r, c = divmod(i, cols)
        yy = y0 + r * (th + f.gap)
        in_last = n - r * cols
        if bento and in_last < cols and r == nrows - 1 and n > cols:
            bw = (f.inner - (in_last - 1) * f.gap) // in_last
            x = f.m + c * (bw + f.gap)
            box = (x, yy, x + bw, yy + th)
        else:
            x = f.m + c * (tw + f.gap)
            box = (x, yy, x + tw, yy + th)
        fill = None
        if bento:
            accent = p.accent_on(i)
            fill = core.mix(p.card, accent, 0.06) if i % 2 else p.card
        out += tile(f, p, box, stat, p.accent_on(i), dense=nrows > 1, fill=fill)

    if rows:
        fx, fy = facts_block(p, rows, f.m, grid_bottom + 12, f.inner)
        out += fx
    return out


def _family_rows(f: Frame, p: Preset, g: Dict[str, Any], y0: int, y1: int,
                 detail: str) -> List[str]:
    face = _face(p)
    cap_stats, cap_facts = _detail_caps(detail)
    stats = core.sequence(g.get("stats"), min(cap_stats, 4))
    facts = core.sequence(g.get("quotes"), min(cap_facts, 2))
    out: List[str] = []

    fact_h = (facts_height(facts, f.inner, kicker=False) + 10) if facts else 0
    bottom = y1 - fact_h
    n = max(1, len(stats))
    rh = (bottom - y0) // n
    label_x = f.m + int(f.inner * 0.38)

    for i, stat in enumerate(stats):
        ry = y0 + i * rh
        acc = p.accent_on(i)
        value = str(stat.get("value", "")).strip()
        label = str(stat.get("label", "")).strip()
        detail_txt = str(stat.get("detail") or "").strip()

        vsize = core.fit(value, face, int(rh * 0.68), label_x - f.m - 40)
        out.append(core.text(f.m, ry + (rh - vsize) // 2 + vsize * 0.82 - 4, value,
                             vsize, core.readable(acc, p.paper) if (
                                 i % 2 == 0 or len(p.accents) == 1) else p.ink,
                             face, bold=True))

        lab_lines = core.wrap(label, face, 24, f.w - f.m - label_x, limit=2)
        block_h = len(lab_lines) * 30 + (26 if detail_txt else 0)
        ly = ry + (rh - block_h) // 2 + 18
        for line in lab_lines:
            out.append(core.text(label_x, ly, line, 24, core.readable(p.ink, p.paper), face))
            ly += 30
        if detail_txt:
            out.append(core.text(label_x, ly + 6,
                                 core.clip(detail_txt, face, 18, f.w - f.m - label_x),
                                 18, p.muted, face))

        rule_y = ry + rh - 6
        if "wobble" in p.decor:
            out.append(core.path(core.wobble_d(f.m, rule_y, f.w - f.m, rule_y, i + 3),
                                 stroke=p.border or p.muted, sw=2, fill="none"))
        elif i < n - 1:
            out.append(core.line(f.m, rule_y, f.w - f.m, rule_y,
                                 core.shade(p.paper, -0.14), 1))

    if facts:
        fx, _ = facts_block(p, facts, f.m, bottom + 14, f.inner, kicker=False)
        out += fx
    return out


def _family_poster(f: Frame, p: Preset, g: Dict[str, Any], y0: int, y1: int,
                   detail: str) -> List[str]:
    face = _face(p)
    cap_stats, cap_facts = _detail_caps(detail)
    stats = core.sequence(g.get("stats"), min(cap_stats, 4))
    facts = core.sequence(g.get("quotes"), min(cap_facts, 3))
    out: List[str] = []

    n = max(1, len(stats))
    tw = (f.inner - (n - 1) * f.gap) // n
    th = 200 if f.aspect > 1.2 else 160
    shadow = illustrate.card_shadow_attr(p)
    for i, stat in enumerate(stats):
        x = f.m + i * (tw + f.gap)
        acc = p.accent_on(i)
        out.append(core.rect(x, y0, tw, th, fill=p.card, r=p.radius, extra=shadow))
        out.append(core.rect(x, y0, tw, 5, fill=acc, r=2))
        value = str(stat.get("value", "")).strip()
        vsize = core.fit(value, face, 58, tw - 32)
        out.append(core.text(x + 16, y0 + 30 + vsize * 0.82, value, vsize,
                             core.readable(acc, p.card), face, bold=True))
        ly = y0 + 30 + 58 + 12 + 18
        for line in core.wrap(str(stat.get("label", "")), face, 23, tw - 32, limit=2):
            out.append(core.text(x + 16, ly, line, 23, core.readable(p.ink, p.card), face))
            ly += 29

    system = 26 if f.aspect > 1.2 else 24
    fy = y0 + th + 42
    for q in facts:
        text = str(q.get("text", "")).strip()
        src = str(q.get("source") or "").strip()
        out.append(core.text(f.m, fy + system * 0.8, "—", system, p.accents[0], face))
        lines = core.wrap(text, face, system, f.inner - 90, limit=2)
        for j, line in enumerate(lines):
            out.append(core.text(f.m + 40, fy + system * 0.86 + j * 32, line, system,
                                 core.readable(p.ink, p.paper), face))
        fy += len(lines) * 32
        if src:
            out.append(core.text(f.m + 40, fy + 20, core.clip(src, face, 18, 320), 18,
                                 p.muted, face))
            fy += 24
        fy += 20
        if fy > y1 - 40:
            break
    return out


def _magnitude(raw: str) -> Tuple[Optional[float], str]:
    text = str(raw).strip().lower()
    tag = "money" if any(c in text for c in ("£", "$", "€")) else (
        "pct" if text.endswith("%") else "count")
    for junk in ("£", "$", "€", "~", "≈", "about", "+", "%"):
        text = text.replace(junk, "")
    text = text.replace(",", "").strip()
    mult = 1.0
    for suffix, factor in (("bn", 1e9), ("b", 1e9), ("mn", 1e6), ("m", 1e6),
                           ("k", 1e3), ("thousand", 1e3), ("million", 1e6)):
        if text.endswith(suffix):
            text, mult = text[: -len(suffix)].strip(), factor
            break
    try:
        return float(text) * mult, tag
    except Exception:
        return None, ""


def _family_kpi(f: Frame, p: Preset, g: Dict[str, Any], y0: int, y1: int,
                detail: str) -> List[str]:
    face = _face(p)
    cap_stats, _cap_facts = _detail_caps(detail)
    stats = core.sequence(g.get("stats"), cap_stats)
    out: List[str] = []

    parsed = [_magnitude(str(s.get("value", ""))) for s in stats]
    nums = [v for v, _t in parsed]
    tags = {t for _v, t in parsed}
    bars = bool(nums) and all(v is not None for v in nums) and len(tags) == 1
    scale = max([v for v in nums if v is not None], default=0.0) if bars else 0.0

    n = max(1, len(stats))
    cols = f.columns if n > 4 else min(2, n)
    nrows = int(math.ceil(n / cols))
    tw = (f.inner - (cols - 1) * f.gap) // cols
    th = min(212, (y1 - y0 - (nrows - 1) * f.gap) // nrows)
    shadow = illustrate.card_shadow_attr(p)

    for i, stat in enumerate(stats):
        r, c = divmod(i, cols)
        x = f.m + c * (tw + f.gap)
        yy = y0 + r * (th + f.gap)
        acc = p.accent_on(i)
        out.append(core.rect(x, yy, tw, th, fill=p.card, r=p.radius, extra=shadow))
        if p.border:
            out.append(core.rect(x, yy, tw, th, fill=None, stroke=p.border, sw=1, r=p.radius))
        out.append(core.rect(x + 18, yy + 16, 22, 3, fill=acc))

        value = str(stat.get("value", "")).strip()
        vsize = core.fit(value, face, 52, tw - 36)
        out.append(core.text(x + 18, yy + 26 + vsize * 0.82, value, vsize,
                             core.readable(p.ink, p.card), face, bold=True))
        ly = yy + 26 + vsize + 8 + 18
        for line in core.wrap(str(stat.get("label", "")), face, 23, tw - 36, limit=2):
            out.append(core.text(x + 18, ly, line, 23, p.muted, face))
            ly += 28

        num = nums[i]
        if bars and num is not None and scale > 0:
            frac = max(0.04, min(1.0, num / scale))
            bar_y = yy + th - 20
            out.append(core.rect(x + 18, bar_y, tw - 36, 6, fill=core.shade(p.card, -0.10), r=3))
            out.append(core.rect(x + 18, bar_y, max(6, (tw - 36) * frac), 6, fill=acc, r=3))
        else:
            out.append(core.rect(x + 18, yy + th - 22, 52, 2, fill=acc))
    return out


_FAMILY_FN = {
    "cards": _family_cards,
    "rows": _family_rows,
    "poster": _family_poster,
    "kpi": _family_kpi,
}


# ------------------------------------------------------------------ templates


def tpl_infographic(f: Frame, p: Preset, g: Dict[str, Any], detail: str = "standard",
                    **_: Any) -> Tuple[List[str], int, int]:
    """Title + tiles + facts + takeaway. Returns (elements, band_y, band_h)."""
    stats = core.sequence(g.get("stats"))
    take = str(g.get("takeaway") or "").strip()
    _size, band_h, _lines = takeaway_measure(f, p, take)
    band_y = f.h - int(f.m * 0.5) - band_h if band_h else f.h
    cap_stats, _cap_facts = _detail_caps(detail)
    shown = min(len(stats), cap_stats,
                4 if p.family in ("rows", "poster") else 8)

    els, y0 = header(f, p, str(g.get("title") or "Infographic"),
                     meta=_meta_line(p, shown))
    y1 = (band_y - 22) if band_h else (f.h - 30)
    fn = _FAMILY_FN.get(p.family, _family_cards)
    els += fn(f, p, g, y0 + 10, y1, detail)
    return els, band_y, band_h


def tpl_key_figure(f: Frame, p: Preset, g: Dict[str, Any], detail: str = "standard",
                   **_: Any) -> Tuple[List[str], int, int]:
    stats = core.sequence(g.get("stats"))
    hero = stats[0] if stats else {"value": "—", "label": "no figure supplied"}
    rest = stats[1:4]
    face = _face(p)
    els, y0 = header(f, p, str(g.get("title") or "Key figure"),
                     meta=_meta_line(p, len(stats)))

    acc = p.accents[0]
    value = str(hero.get("value", "")).strip() or "—"
    size = core.fit(value, face, int(min(f.w, f.h) * 0.30), f.inner, min_size=60)
    els.append(core.text(f.m, y0 + size * 0.86, value, size,
                         core.readable(acc, p.paper), face, bold=True))
    label = core.wrap(str(hero.get("label", "")), face, 34, f.inner, limit=2)
    ly = y0 + size * 0.86 + 46
    for line in label:
        els.append(core.text(f.m, ly, line, 34, core.readable(p.ink, p.paper), face))
        ly += 42
    detail_txt = str(hero.get("detail") or "").strip()
    if detail_txt:
        els.append(core.text(f.m, ly + 10, core.clip(detail_txt, face, 22, f.inner), 22,
                             p.muted, face))
        ly += 40

    facts = core.sequence(g.get("quotes"), 2)
    band_h = 0
    if rest:
        cols = len(rest)
        tw = (f.inner - (cols - 1) * f.gap) // cols
        th = 120
        yy = f.h - f.m - th
        for i, stat in enumerate(rest):
            x = f.m + i * (tw + f.gap)
            els += tile(f, p, (x, yy, x + tw, yy + th), stat, p.accent_on(i + 1), dense=True)
    elif facts:
        els += []

    take = str(g.get("takeaway") or "").strip()
    _s, band_h, _l = takeaway_measure(f, p, take)
    band_y = f.h - int(f.m * 0.5) - band_h if band_h else f.h
    return els, band_y, band_h


def tpl_stat_grid(f: Frame, p: Preset, g: Dict[str, Any], detail: str = "standard",
                  **_: Any) -> Tuple[List[str], int, int]:
    cap, _ = _detail_caps(detail)
    stats = core.sequence(g.get("stats"), cap)
    els, y0 = header(f, p, str(g.get("title") or "Snapshot"),
                     meta=_meta_line(p, len(stats)))
    n = max(1, len(stats))
    cols = min(f.columns, n)
    nrows = int(math.ceil(n / cols))
    tw = (f.inner - (cols - 1) * f.gap) // cols
    th = min(220, (f.h - f.m - y0 - (nrows - 1) * f.gap) // nrows)
    for i, stat in enumerate(stats):
        r, c = divmod(i, cols)
        x = f.m + c * (tw + f.gap)
        yy = y0 + r * (th + f.gap)
        els += tile(f, p, (x, yy, x + tw, yy + th), stat, p.accent_on(i), dense=nrows > 1)
    take = str(g.get("takeaway") or "").strip()
    _s, band_h, _l = takeaway_measure(f, p, take)
    band_y = f.h - int(f.m * 0.5) - band_h if band_h else f.h
    return els, band_y, band_h


def tpl_quote_card(f: Frame, p: Preset, g: Dict[str, Any], detail: str = "standard",
                   **_: Any) -> Tuple[List[str], int, int]:
    face = _face(p)
    quotes = core.sequence(g.get("quotes")) or [{"text": str(g.get("title") or ""),
                                                 "source": ""}]
    q = quotes[0]
    text = str(q.get("text") or "No quote supplied").strip()
    src = str(q.get("source") or "").strip()
    els: List[str] = []

    acc = p.accents[0]
    els.append(core.text(f.m, f.m + 90, "“", int(f.h * 0.30),
                         core.mix(acc, p.paper, 0.55), "serif", bold=True))
    size = 44 if f.aspect > 1.2 else 38
    lines = core.wrap(text, face, size, f.inner - 20)
    while len(lines) > 7 and size > 24:
        size -= 2
        lines = core.wrap(text, face, size, f.inner - 20)
    lines = lines[:8]
    block_h = len(lines) * int(size * 1.35)
    y = (f.h - block_h) // 2 + size
    for line in lines:
        els.append(core.text(f.m, y, line, size, core.readable(p.ink, p.paper), face))
        y += int(size * 1.35)
    if src:
        els.append(core.rect(f.m, y + 10, 46, 3, fill=acc))
        els.append(core.text(f.m, y + 44, core.clip(src, face, 22, f.inner), 22, p.muted, face))
    return els, f.h, 0


def tpl_timeline(f: Frame, p: Preset, g: Dict[str, Any], detail: str = "standard",
                 **_: Any) -> Tuple[List[str], int, int]:
    face = _face(p)
    events = core.sequence(g.get("events"), 8 if detail != "concise" else 4)
    if not events:
        events = [{"when": str(i + 1), "what": f"Step {i + 1}"} for i in range(3)]
    els, y0 = header(f, p, str(g.get("title") or "Timeline"),
                     meta=f"{p.label} · {len(events)} events")
    spine = f.m + (110 if f.aspect > 1.0 else 84)
    top = y0 + 10
    bottom = f.h - f.m - 20
    step = max(64, (bottom - top) // max(1, len(events)))
    els.append(core.line(spine, top, spine, bottom, core.shade(p.paper, -0.22), 2))

    for i, ev in enumerate(events[: max(1, (bottom - top) // 64)]):
        cy = top + i * step + 18
        when = str(ev.get("when") or ev.get("date") or "").strip()
        what = str(ev.get("what") or ev.get("text") or ev.get("label") or "").strip()
        acc = p.accent_on(i)
        els.append(core.text(spine - 24, cy + 6, core.clip(when, face, 20, spine - f.m - 8),
                             20, core.readable(acc, p.paper), "sans", bold=True, anchor="end"))
        els.append(core.circle(spine, cy, 7, fill=acc))
        els.append(core.circle(spine, cy, 11, fill=None, stroke=core.mix(acc, p.paper, 0.5), sw=2))
        lines = core.wrap(what, face, 24, f.w - f.m - spine - 34, limit=2)
        ly = cy + 8
        for line in lines:
            els.append(core.text(spine + 28, ly, line, 24, core.readable(p.ink, p.paper), face))
            ly += 31
    return els, f.h, 0


def tpl_comparison(f: Frame, p: Preset, g: Dict[str, Any], detail: str = "standard",
                   **_: Any) -> Tuple[List[str], int, int]:
    face = _face(p)
    left = g.get("left") if isinstance(g.get("left"), dict) else {}
    right = g.get("right") if isinstance(g.get("right"), dict) else {}
    els, y0 = header(f, p, str(g.get("title") or "Comparison"),
                     meta=f"{p.label} · A vs B")
    colw = (f.inner - f.gap) // 2
    bottom = f.h - f.m
    for i, (side, accent) in enumerate(((left, p.accents[0]), (right, p.accents[1 % len(p.accents)]))):
        x = f.m + i * (colw + f.gap)
        els.append(core.rect(x, y0 + 6, colw, bottom - y0 - 6, fill=p.card, r=p.radius,
                             extra=illustrate.card_shadow_attr(p)))
        els.append(core.rect(x, y0 + 6, colw, 5, fill=accent, r=2))
        pad = 20
        head = str(side.get("title") or ("A" if i == 0 else "B")).strip()
        els.append(core.text(x + pad, y0 + 52, core.clip(head, face, 26, colw - 2 * pad),
                             26, core.readable(p.ink, p.card), face, bold=True))
        y = y0 + 92
        for item in core.sequence(side.get("items"), 6):
            text = str(item.get("text") or item.get("label") or item.get("value") or "").strip()
            if not text:
                continue
            els.append(core.circle(x + pad + 4, y - 6, 3.5, fill=accent))
            for j, line in enumerate(core.wrap(text, face, 21, colw - 2 * pad - 18, limit=2)):
                els.append(core.text(x + pad + 18, y + j * 27, line, 21,
                                     core.readable(p.ink, p.card), face))
                y += 27 if j else 0
            y += 22
            if y > bottom - 20:
                break
        if side.get("score") is not None:
            els.append(core.text(x + pad, bottom - 26, str(side.get("score")), 22,
                                 core.readable(accent, p.card), face, bold=True))
    return els, f.h, 0


def tpl_process(f: Frame, p: Preset, g: Dict[str, Any], detail: str = "standard",
                **_: Any) -> Tuple[List[str], int, int]:
    face = _face(p)
    steps = core.sequence(g.get("steps"), 5 if detail != "detailed" else 6)
    if not steps:
        steps = [{"title": f"Step {i + 1}", "text": ""} for i in range(3)]
    els, y0 = header(f, p, str(g.get("title") or "Process"),
                     meta=f"{p.label} · {len(steps)} steps")
    n = len(steps)
    top = y0 + 24
    bottom = f.h - f.m
    colh = (bottom - top - (n - 1) * f.gap) // n
    rail = f.m + 26
    els.append(core.line(rail, top + 10, rail, bottom - 10, core.shade(p.paper, -0.2), 2))
    for i, st in enumerate(steps):
        y = top + i * (colh + f.gap)
        acc = p.accent_on(i)
        els.append(core.circle(rail, y + 24, 15, fill=acc))
        els.append(core.text(rail, y + 31, str(i + 1), 18, core.readable(p.paper, acc),
                             "sans", bold=True, anchor="middle"))
        title = str(st.get("title") or st.get("label") or f"Step {i + 1}").strip()
        els.append(core.text(rail + 34, y + 31, core.clip(title, face, 26,
                                                          f.w - f.m - rail - 34), 26,
                             core.readable(p.ink, p.paper), face, bold=True))
        body = str(st.get("text") or st.get("detail") or "").strip()
        if body:
            ly = y + 62
            for line in core.wrap(body, face, 21, f.w - f.m - rail - 40, limit=2):
                els.append(core.text(rail + 34, ly, line, 21, p.muted, face))
                ly += 27
    return els, f.h, 0


def tpl_cover(f: Frame, p: Preset, g: Dict[str, Any], detail: str = "standard",
              **_: Any) -> Tuple[List[str], int, int]:
    """Artwork on top, a solid plate of type below it — the cover shape that survives
    any background, because the type never sits on the art."""
    face = _face(p)
    title = str(g.get("title") or "Untitled")
    plate_on_art = p.art != "none"
    plate_y = int(f.h * (0.50 if plate_on_art else 0.42))
    plate_h = f.h - plate_y
    plate_bg = p.card if plate_on_art else p.paper
    ink = core.readable(p.ink, plate_bg)

    # the type block is measured against the plate, then the plate is refitted
    pad = 34
    width = f.inner - pad * 2
    size = 84
    lines = core.wrap(title, face, size, width, bold=True, limit=4)
    while (len(lines) > 3 or len(lines) * size * 1.15 > plate_h - 150) and size > 34:
        size -= 4
        lines = core.wrap(title, face, size, width, bold=True, limit=4)
    sub = str(g.get("subtitle") or g.get("takeaway") or "").strip()
    sub_lines = core.wrap(sub, face, 22, width, limit=2) if sub else []
    need = 34 + 30 + len(lines) * int(size * 1.14) + (len(sub_lines) * 29 + 26 if sub_lines else 0) + 46
    plate_h = max(plate_h, need)
    plate_y = f.h - plate_h

    els: List[str] = []
    if plate_on_art:
        els.append(core.rect(0, plate_y, f.w, plate_h, fill=plate_bg))
        els.append(core.rect(0, plate_y, f.w, 4, fill=p.accents[0]))
    kick = (p.kicker or "INFOGRAPHIC").upper()
    els.append(core.text(f.m, plate_y + 44, kick, 20,
                         core.readable(p.accents[0], plate_bg), "sans", bold=True,
                         tracking=3))
    y = plate_y + 44 + 26 + size
    for line in lines:
        els.append(core.text(f.m, y, line, size, ink, face, bold=True))
        y += int(size * 1.14)
    if sub_lines:
        y += 6
        for line in sub_lines:
            els.append(core.text(f.m, y, line, 22,
                                 p.muted if core.contrast(p.muted, plate_bg) > 3.5 else ink,
                                 face))
            y += 29
    stamp = str(g.get("source") or "").strip()
    if stamp:
        els.append(core.text(f.w - f.m, f.h - 18, core.clip(stamp, face, 15, f.inner - 40),
                             15, p.muted, face, anchor="end"))
    return els, f.h, 0


def tpl_illustration(f: Frame, p: Preset, g: Dict[str, Any], detail: str = "standard",
                     **_: Any) -> Tuple[List[str], int, int]:
    face = _face(p)
    els: List[str] = []
    title = str(g.get("title") or p.label)
    size = 54 if f.aspect > 1.2 else 44
    lines = core.wrap(title, face, size, f.inner - 40, bold=True, limit=2)
    y = f.h - f.m - 34
    for line in reversed(lines):
        els.append(core.text(f.m, y, line, size,
                             core.mix(p.ink, (255, 255, 255), 0.25) if p.art else p.ink,
                             face, bold=True))
        y -= int(size * 1.1)
    cap = str(g.get("takeaway") or g.get("subtitle") or "").strip()
    if cap:
        els.append(core.text(f.m, f.h - f.m + 2, core.clip(cap, face, 18, f.inner), 18,
                             p.muted, face))
    return els, f.h, 0


TEMPLATES: Dict[str, Any] = {
    "infographic": tpl_infographic,
    "key_figure": tpl_key_figure,
    "stat_grid": tpl_stat_grid,
    "quote_card": tpl_quote_card,
    "timeline": tpl_timeline,
    "comparison": tpl_comparison,
    "process": tpl_process,
    "cover": tpl_cover,
    "illustration": tpl_illustration,
}

#: Which presets suit which template, so a caller can ask for "give me the right
#: look for a comparison" instead of guessing.
TEMPLATE_PRESETS: Dict[str, List[str]] = {
    "infographic": [p.id for p in __import__("hermes_notebook.gfx.themes",
                                            fromlist=["PRESETS"]).PRESETS],
    "key_figure": ["editorial", "poster", "swiss", "realistic", "neon", "chalkboard"],
    "stat_grid": ["dashboard", "mission", "bento", "sections", "realistic", "swiss"],
    "quote_card": ["magazine", "editorial", "kraft", "chalkboard", "cartoon", "realistic"],
    "timeline": ["sections", "swiss", "blueprint", "magazine", "cartoon"],
    "comparison": ["swiss", "sections", "dashboard", "brutalist", "realistic"],
    "process": ["sections", "cartoon", "blueprint", "terminal", "bento"],
    "cover": ["poster", "neon", "realistic", "brutalist", "cartoon", "magazine"],
    "illustration": ["cartoon", "realistic"],
}
