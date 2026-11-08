"""Infographic renderer — one canvas, four layout families, sixteen looks.

Everything visual comes from a `igstyles.Style`: the palette, the typeface, the
family and a short decoration list. Nothing here knows the name of a style, so a
new look is a row in the catalog, not a new branch in this file.

Canvas is 1200x900 (4:3). Content is a title block, 3-6 stat tiles, 2-4 key
facts and a takeaway band — the same payload the model already returns.

Layout is measured before it is drawn: the takeaway band and the facts block are
sized first, and the tiles get what is left, so nothing can be clipped at the
bottom edge.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple, cast

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from . import igstyles

RGB = Tuple[int, int, int]
W, H = 1200, 900
M = 64                      # page margin
GAP = 18                    # gutter between tiles

# ---------------------------------------------------------------- typefaces
# Ordered best-first per face; every list ends in a font that ships with the OS
# in the supported images (DejaVu). Inter is preferred when present because it is
# a better grotesque, but nothing depends on it being installed.

_FACES = {
    "sans": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/Library/Fonts/Arial.ttf", "C:/Windows/Fonts/arial.ttf",
    ],
    "sans-bold": [
        "/home/decrux/.local/share/fonts/InterDisplay-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf", "C:/Windows/Fonts/arialbd.ttf",
    ],
    "serif": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
        "/Library/Fonts/Times New Roman.ttf", "C:/Windows/Fonts/times.ttf",
    ],
    "serif-bold": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "/Library/Fonts/Times New Roman Bold.ttf", "C:/Windows/Fonts/timesbd.ttf",
    ],
    "mono": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "C:/Windows/Fonts/consola.ttf",
    ],
    "mono-bold": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
        "C:/Windows/Fonts/consolab.ttf",
    ],
}

_CACHE: Dict[Tuple[str, int], Any] = {}


def _font(face: str, size: int):
    key = (face, size)
    if key in _CACHE:
        return _CACHE[key]
    font = None
    for path in _FACES.get(face, _FACES["sans"]):
        try:
            font = ImageFont.truetype(path, size)
            break
        except Exception:
            continue
    if font is None:
        try:
            font = ImageFont.load_default(size=size)
        except Exception:
            font = ImageFont.load_default()
    _CACHE[key] = font
    return font


def _bold_face(style: igstyles.Style) -> str:
    return {"serif": "serif-bold", "mono": "mono-bold"}.get(style.typeface, "sans-bold")


def _faces(style: igstyles.Style) -> Dict[str, Any]:
    """The handful of sizes a layout needs, in the style's own typeface."""
    tf = style.typeface if style.typeface in ("sans", "serif", "mono") else "sans"
    bold = _bold_face(style)
    return {
        "kicker": _font(bold, 20),
        "title": _font(bold, 56),
        "value": _font(bold, 68),
        "label": _font(tf, 24),
        "small": _font(tf, 19),
        "fact": _font(tf, 25),
    }


# ------------------------------------------------------------------ drawing


def _mix(a: RGB, b: RGB, t: float) -> RGB:
    t = max(0.0, min(1.0, t))
    return (int(a[0] + (b[0] - a[0]) * t), int(a[1] + (b[1] - a[1]) * t),
            int(a[2] + (b[2] - a[2]) * t))


def _shade(c: RGB, k: float) -> RGB:
    """k<0 darkens toward black, k>0 lightens toward white."""
    return _mix(c, (255, 255, 255) if k > 0 else (0, 0, 0), abs(k))


def _lum(c: RGB) -> float:
    def ch(v: float) -> float:
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def _contrast(a: RGB, b: RGB) -> float:
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _readable(fg: RGB, bg: RGB, minimum: float = 4.5) -> RGB:
    """Accents are chosen for punch, not legibility: a signature yellow on cream is
    authentic riso and unreadable. Push the ink away from the page until it clears
    `minimum` contrast instead of dropping the colour."""
    if _contrast(fg, bg) >= minimum:
        return fg
    step = -0.03 if _lum(bg) > 0.45 else 0.03
    cand = fg
    for _ in range(24):
        cand = _shade(cand, step)
        if _contrast(cand, bg) >= minimum:
            return cand
    return cand


def _wrap(draw, text: str, font, max_w: int) -> List[str]:
    words = str(text or "").split()
    if not words:
        return []
    lines, cur = [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def _clip(draw, text: str, font, max_w: int) -> str:
    """Single line, ellipsised — for tags that must not wrap."""
    text = str(text or "")
    if draw.textlength(text, font=font) <= max_w:
        return text
    while text and draw.textlength(text + "…", font=font) > max_w:
        text = text[:-1]
    return text + "…"


def _fit_size(draw, text: str, face: str, size: int, max_w: int,
              min_size: int = 28) -> int:
    while size > min_size and draw.textlength(text, font=_font(face, size)) > max_w:
        size -= 2
    return size


def _tracked(draw, xy, text: str, font, fill, tracking: float = 2.0) -> float:
    """Letter-spaced uppercase label (kickers). Returns the end x."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


def _overlay(base: Image.Image, draw_fn) -> Image.Image:
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(ov))
    return Image.alpha_composite(base.convert("RGBA"), ov).convert("RGB")


def _gradient(paper: RGB, to: RGB, size: Tuple[int, int] = (W, H)) -> Image.Image:
    img = Image.new("RGB", size)
    px = cast(Any, img.load())
    w, h = size
    for y in range(h):
        row = _mix(paper, to, y / max(1, h - 1))
        for x in range(w):
            px[x, y] = row
    return img


# --------------------------------------------------------------- decorations


def _decor_grid(img: Image.Image, style: igstyles.Style, step: int = 30) -> Image.Image:
    line = _shade(style.paper, 0.10) if style.tone == "light" else _shade(style.paper, 0.13)

    def paint(d):
        for x in range(0, W + step, step):
            d.line([x, 0, x, H], fill=line + (255,), width=1)
        for y in range(0, H + step, step):
            d.line([0, y, W, y], fill=line + (255,), width=1)
    return _overlay(img, paint)


def _decor_ticks(img: Image.Image, style: igstyles.Style) -> Image.Image:
    acc = style.accents[0]
    ink = style.muted

    def paint(d):
        for (x, y, dx, dy) in ((26, 26, 1, 1), (W - 26, 26, -1, 1),
                               (26, H - 26, 1, -1), (W - 26, H - 26, -1, -1)):
            d.line([x, y, x + 26 * dx, y], fill=ink + (170,), width=1)
            d.line([x, y, x, y + 26 * dy], fill=ink + (170,), width=1)
            d.line([x, y, x + 9 * dx, y], fill=acc + (255,), width=3)
    return _overlay(img, paint)


def _decor_halftone(img: Image.Image, style: igstyles.Style) -> Image.Image:
    acc = style.accents[1 % len(style.accents)]

    def paint(d):
        r = 2.2
        for gy in range(0, 132, 12):
            for gx in range(0, 200, 12):
                if (gx // 12 + gy // 12) % 3 == 0:
                    continue
                x, y = W - M - 196 + gx, H - 176 + gy
                d.ellipse([x - r, y - r, x + r, y + r], fill=acc + (60,))
    return _overlay(img, paint)


def _decor_scanlines(img: Image.Image, style: igstyles.Style) -> Image.Image:
    def paint(d):
        for y in range(0, H, 4):
            d.line([0, y, W, y], fill=(255, 255, 255, 9))
    return _overlay(img, paint)


def _decor_glow(img: Image.Image, style: igstyles.Style) -> Image.Image:
    """Two soft accent blooms — blurred, so they read as light, not as shapes."""
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    a, b = style.accents[0], style.accents[1 % len(style.accents)]
    gd.ellipse([-200, -240, 600, 360], fill=_shade(a, -0.25))
    gd.ellipse([W - 560, H - 440, W + 220, H + 140], fill=_shade(b, -0.45))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    return Image.blend(img, glow, 0.30)


def _decor_wobble_rule(draw, x0: int, y: int, x1: int, fill, width: int = 2, seed: int = 1):
    """A hand-drawn horizontal rule: two jittered passes."""
    for k in range(2):
        pts = []
        for i, x in enumerate(range(x0, x1 + 1, 26)):
            jitter = math.sin((i + seed) * 1.7 + k) * 1.7
            pts.append((x, y + jitter + k * 0.8))
        draw.line(pts, fill=fill, width=width, joint="curve")


def _decor_overprint(img: Image.Image, style: igstyles.Style) -> Image.Image:
    """Second ink, off-register: translucent blocks offset from the grid."""
    acc = style.accents[1 % len(style.accents)]

    def paint(d):
        d.rectangle([W - 300, 30, W - M + 46, 176], fill=acc + (34,))
        d.rectangle([M - 34, H - 330, 190, H - 150], fill=style.accents[0] + (22,))
    return _overlay(img, paint)


def _decor_tape(img: Image.Image, style: igstyles.Style) -> Image.Image:
    tape = Image.new("RGBA", (150, 44), (255, 255, 255, 92))
    td = ImageDraw.Draw(tape)
    for i in range(0, 150, 9):
        td.line([i, 0, i, 44], fill=(0, 0, 0, 10))

    out = img.convert("RGBA")
    for cx, cy, angle in ((M + 140, 108, 12), (W - M - 150, H - 128, -9)):
        rot = tape.rotate(angle, expand=True)
        out.alpha_composite(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)))
    return out.convert("RGB")


# ------------------------------------------------------------------ header


def _header(img: Image.Image, style: igstyles.Style, f: Dict[str, Any], title: str,
            kicker: Optional[str] = None, meta: str = "") -> Tuple[Image.Image, int]:
    """Kicker + title (+ a quiet meta line on the right). Returns the content top."""
    d = ImageDraw.Draw(img)
    acc = style.accents[0]
    kick = (kicker or style.kicker or "INFOGRAPHIC").upper()

    if "hard-border" in style.decor:
        kw = d.textlength(kick, font=f["kicker"]) + 26
        d.rectangle([M - 4, 42, M - 4 + kw, 82], fill=style.ink)
        _tracked(d, (M + 9, 50), kick, f["kicker"], style.card, 1.4)
    else:
        _tracked(d, (M, 50), kick, f["kicker"], _readable(acc, style.paper), 3.0)
        d.line([M, 78, M + 72, 78], fill=acc, width=3)

    if meta:
        mw = d.textlength(meta, font=f["small"])
        d.text((W - M - mw, 54), meta, font=f["small"], fill=style.muted)

    y = 92
    for line in _wrap(d, title or "Infographic", f["title"], W - 2 * M)[:2]:
        d.text((M, y), line, font=f["title"], fill=style.ink)
        y += 60
    if "hairline" in style.decor:
        d.line([M, y + 22, W - M, y + 22], fill=style.ink, width=2)
        return img, y + 48
    return img, y + 26


# --------------------------------------------------------------- takeaway


def _takeaway_band(style: igstyles.Style, f: Dict[str, Any], text: str,
                   draw) -> Tuple[Optional[Any], int, int]:
    """Measure the closing band: (font, height, lines). Height 0 = no band."""
    text = str(text or "").strip()
    if not text:
        return None, 0, 0
    tf = style.typeface if style.typeface in ("sans", "serif", "mono") else "sans"
    max_w = W - 2 * M - 56
    for size in (24, 22, 20, 18):
        font = _font(tf, size)
        lines = _wrap(draw, text, font, max_w)
        if len(lines) <= 2:
            break
    else:
        lines = lines[:2]
    height = 44 + len(lines) * (size + 9)
    return font, height, len(lines)


def _takeaway(img: Image.Image, style: igstyles.Style, f: Dict[str, Any], text: str,
              band_h: int, band_y: int) -> Image.Image:
    """Tinted slab (light styles) or card slab (dark) with a TAKEAWAY kicker."""
    text = str(text or "").strip()
    if not text or band_h <= 0:
        return img
    d = ImageDraw.Draw(img)
    font, _, _ = _takeaway_band(style, f, text, d)
    if font is None:
        return img
    tint = 0.10 if style.tone == "light" else 0.16
    # rule-led styles get a plain slab and a rule instead of a colour wash: a pale
    # pink band under a Swiss grid reads as a different designer's work
    bg = style.card if ("hairline" in style.decor and style.tone == "light") \
        else _mix(style.paper, style.accents[0], tint)
    radius = min(style.radius, 16) if style.radius else 0
    box = [M, band_y, W - M, band_y + band_h]
    if radius:
        d.rounded_rectangle(box, radius=radius, fill=bg)
    else:
        d.rectangle(box, fill=bg)
    d.rectangle([M, band_y, M + 5, band_y + band_h], fill=style.accents[0])
    if "hairline" in style.decor and style.tone == "light":
        d.line([M, band_y, W - M, band_y], fill=style.ink, width=2)
    kick_fill = style.accents[0] if style.tone == "dark" else _shade(style.accents[0], -0.18)
    _tracked(d, (M + 22, band_y + 12), "TAKEAWAY", f["kicker"],
             _readable(kick_fill, bg, 3.0), 2.6)
    ty = band_y + 38
    for line in _wrap(d, text, font, W - 2 * M - 56)[:2]:
        d.text((M + 22, ty), line, font=font, fill=style.ink)
        ty += font.size + 9
    return img


# --------------------------------------------------------------- stat tiles


def _stat_tile(d, style: igstyles.Style, f: Dict[str, Any], box, stat: Dict[str, Any],
               accent: RGB, dense: bool = False, fill: Optional[RGB] = None) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    radius = style.radius
    card = fill or style.card

    if "offset-shadow" in style.decor:
        d.rectangle([x0 + 7, y0 + 7, x1 + 7, y1 + 7], fill=style.ink)

    if radius:
        d.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=card)
    else:
        d.rectangle([x0, y0, x1, y1], fill=card)
    if style.border:
        width = 4 if "hard-border" in style.decor else 1
        if radius:
            d.rounded_rectangle([x0, y0, x1, y1], radius=radius, outline=style.border,
                                width=width)
        else:
            d.rectangle([x0, y0, x1, y1], outline=style.border, width=width)

    pad = 18 if h < 130 else 20
    d.rectangle([x0 + pad, y0 + pad, x0 + pad + 32, y0 + pad + 4], fill=accent)

    value = str(stat.get("value", "")).strip()
    label = str(stat.get("label", "")).strip()
    detail = str(stat.get("detail") or "").strip()

    vface = _bold_face(style)
    lfont = f["small"] if (dense or h < 150) else f["label"]
    inner_w = w - 2 * pad
    top = pad + 24

    # Fit inside the tile instead of overflowing into the gap below it: shrink the
    # numeral, then the label, then drop the optional detail line.
    vsize, lab_lines, show_detail = 62, [], False
    for cand in range(62 if not dense else 54, 26, -2):
        lab = _wrap(d, label, lfont, inner_w)[:2]
        need = top + cand + 10 + len(lab) * (lfont.size + 6)
        if detail:
            need += f["small"].size + 8
        if need <= h - pad // 2:
            vsize, lab_lines, show_detail = cand, lab, bool(detail)
            break
        vsize, lab_lines = cand, lab
    vfont = _font(vface, vsize)
    d.text((x0 + pad, y0 + top), value, font=vfont, fill=_readable(accent, card))

    ly = y0 + top + vsize + 10
    for line in lab_lines:
        d.text((x0 + pad, ly), line, font=lfont, fill=style.ink)
        ly += lfont.size + 6
    if show_detail and ly + f["small"].size <= y1 - 6:
        d.text((x0 + pad, ly + 4), _clip(d, detail, f["small"], inner_w),
               font=f["small"], fill=style.muted)


# ---------------------------------------------------------------- facts block


def _fact_rows(draw, style: igstyles.Style, f: Dict[str, Any], facts: List[Dict[str, Any]],
               width: int) -> List[Tuple[List[str], str]]:
    rows = []
    for q in facts:
        text = str(q.get("text", "")).strip()
        src = str(q.get("source") or "").strip()
        rows.append((_wrap(draw, text, f["fact"], width - 30)[:2], src))
    return rows


def _facts_height(rows: List[Tuple[List[str], str]], kicker: bool = True) -> int:
    h = 30 if kicker else 0
    for lines, src in rows:
        h += len(lines) * 32 + (24 if src else 0) + 18
    return h


def _draw_facts(img: Image.Image, style: igstyles.Style, f: Dict[str, Any],
                rows: List[Tuple[List[str], str]], y: int, kicker: bool = True) -> Image.Image:
    d = ImageDraw.Draw(img)
    if kicker:
        _tracked(d, (M, y), "KEY FACTS", f["kicker"], style.muted, 2.4)
        y += 32
    for lines, src in rows:
        d.rectangle([M, y + 5, M + 4, y + 30], fill=style.accents[0])
        for j, line in enumerate(lines):
            d.text((M + 18, y + j * 32), line, font=f["fact"], fill=style.ink)
        y += len(lines) * 32
        if src:
            d.text((M + 18, y + 2), _clip(d, src, f["small"], 260), font=f["small"],
                   fill=style.muted)
            y += 24
        y += 18
    return img


# --------------------------------------------------------------- families


def _family_cards(img, style, f, data, y0, y1, take_h) -> Image.Image:
    d = ImageDraw.Draw(img)
    stats = [s for s in (data.get("stats") or []) if isinstance(s, dict)][:6]
    facts = [q for q in (data.get("quotes") or []) if isinstance(q, dict)][:3]

    n = max(1, len(stats))
    cols = 3 if n >= 3 else n
    nrows = int(math.ceil(n / cols))
    tw = (W - 2 * M - (cols - 1) * GAP) // cols

    # Space budget: tiles get a floor height first, facts get whatever is left —
    # so a six-stat sheet drops a fact line instead of overlapping the tiles.
    avail = y1 - y0
    tile_floor = 118 if nrows > 1 else 150
    tile_block = nrows * tile_floor + (nrows - 1) * GAP
    all_rows = _fact_rows(d, style, f, facts, W - 2 * M) if facts else []
    rows: List[Tuple[List[str], str]] = []
    for k in range(len(all_rows), -1, -1):
        if _facts_height(all_rows[:k]) + 22 <= avail - tile_block:
            rows = all_rows[:k]
            break
    fact_h = (_facts_height(rows) + 22) if rows else 0
    grid_bottom = y1 - fact_h
    th = min(200, (grid_bottom - y0 - (nrows - 1) * GAP) // nrows)

    bento = style.id == "bento"
    for i, stat in enumerate(stats):
        r, c = divmod(i, cols)
        yy = y0 + r * (th + GAP)
        last_row = (r == nrows - 1)
        in_last = n - r * cols
        if bento and in_last < cols and last_row and n > cols:
            # a short final row spreads its tiles across the full width
            rem = in_last
            bw = (W - 2 * M - (rem - 1) * GAP) // rem
            box = (M + c * (bw + GAP), yy, M + c * (bw + GAP) + bw, yy + th)
        else:
            box = (M + c * (tw + GAP), yy, M + c * (tw + GAP) + tw, yy + th)
        fill = None
        if bento:
            accent = style.accents[i % len(style.accents)]
            fill = _mix(style.card, accent, 0.06) if i % 2 else style.card
        _stat_tile(d, style, f, box, stat, style.accents[i % len(style.accents)],
                   dense=nrows > 1, fill=fill)

    if rows:
        img = _draw_facts(img, style, f, rows, grid_bottom + 12)
    return img


def _family_rows(img, style, f, data, y0, y1, take_h) -> Image.Image:
    d = ImageDraw.Draw(img)
    stats = [s for s in (data.get("stats") or []) if isinstance(s, dict)][:4]
    facts = [q for q in (data.get("quotes") or []) if isinstance(q, dict)][:2]

    rows = _fact_rows(d, style, f, facts, W - 2 * M) if facts else []
    fact_h = _facts_height(rows) + 10 if rows else 0
    bottom = y1 - fact_h

    n = max(1, len(stats))
    rh = (bottom - y0) // n
    vface = _bold_face(style)
    label_x = M + 430

    for i, stat in enumerate(stats):
        ry = y0 + i * rh
        acc = style.accents[i % len(style.accents)]
        value = str(stat.get("value", "")).strip()
        label = str(stat.get("label", "")).strip()
        detail = str(stat.get("detail") or "").strip()

        vsize = _fit_size(d, value, vface, 74, label_x - M - 40, 34)
        vfont = _font(vface, vsize)
        d.text((M, ry + (rh - vsize) // 2 - 8), value, font=vfont,
               fill=_readable(acc, style.paper) if (i % 2 == 0 or len(style.accents) == 1)
               else style.ink)

        lab_lines = _wrap(d, label, f["label"], W - M - label_x)[:2]
        block_h = len(lab_lines) * (f["label"].size + 6) + (26 if detail else 0)
        ly = ry + (rh - block_h) // 2 - 6
        for line in lab_lines:
            d.text((label_x, ly), line, font=f["label"], fill=style.ink)
            ly += f["label"].size + 6
        if detail:
            d.text((label_x, ly + 2), _clip(d, detail, f["small"], W - M - label_x),
                   font=f["small"], fill=style.muted)

        rule_y = ry + rh - 6
        if "wobble" in style.decor:
            _decor_wobble_rule(d, M, rule_y, W - M, style.border or style.muted, 2, i + 3)
        elif i < n - 1:
            d.line([M, rule_y, W - M, rule_y], fill=_shade(style.paper, -0.14), width=1)

    if rows:
        img = _draw_facts(img, style, f, rows, bottom + 14, kicker=False)
    return img


def _family_poster(img, style, f, data, y0, y1, take_h) -> Image.Image:
    d = ImageDraw.Draw(img)
    stats = [s for s in (data.get("stats") or []) if isinstance(s, dict)][:4]
    facts = [q for q in (data.get("quotes") or []) if isinstance(q, dict)][:3]

    n = max(1, len(stats))
    tw = (W - 2 * M - (n - 1) * GAP) // n
    th = 200
    for i, stat in enumerate(stats):
        x = M + i * (tw + GAP)
        acc = style.accents[i % len(style.accents)]
        d.rounded_rectangle([x, y0, x + tw, y0 + th], radius=style.radius, fill=style.card)
        d.rounded_rectangle([x, y0, x + tw, y0 + 5], radius=2, fill=acc)
        value = str(stat.get("value", "")).strip()
        vface = _bold_face(style)
        vsize = _fit_size(d, value, vface, 58, tw - 32, 28)
        d.text((x + 16, y0 + 30), value, font=_font(vface, vsize),
               fill=_readable(acc, style.card))
        ly = y0 + 30 + 58 + 12          # fixed baseline so every tile's label aligns
        for line in _wrap(d, str(stat.get("label", "")), f["label"], tw - 32)[:2]:
            d.text((x + 16, ly), line, font=f["label"], fill=style.ink)
            ly += f["label"].size + 6

    fy = y0 + th + 42
    for q in facts:
        text = str(q.get("text", "")).strip()
        src = str(q.get("source") or "").strip()
        d.text((M, fy - 2), "—", font=f["fact"], fill=style.accents[0])
        lines = _wrap(d, text, f["fact"], W - 2 * M - 90)[:2]
        for j, line in enumerate(lines):
            d.text((M + 40, fy + j * 32), line, font=f["fact"], fill=style.ink)
        fy += len(lines) * 32
        if src:
            d.text((M + 40, fy + 2), _clip(d, src, f["small"], 320), font=f["small"],
                   fill=style.muted)
            fy += 24
        fy += 20
        if fy > y1 - 40:
            break
    return img


def _magnitude(raw: str) -> Tuple[Optional[float], str]:
    """Read '£10m', '3.2k', '70%' as (number, unit tag) so a bar can compare it,
    and so bars are refused across units (houses vs pounds is not a scale).
    Returns (None, '') when the value is not a quantity at all."""
    text = raw.strip().lower()
    tag = "count"
    if any(c in text for c in ("£", "$", "€")):
        tag = "money"
    if text.endswith("%"):
        tag = "pct"
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


def _family_kpi(img, style, f, data, y0, y1, take_h) -> Image.Image:
    d = ImageDraw.Draw(img)
    stats = [s for s in (data.get("stats") or []) if isinstance(s, dict)][:6]

    # A bar is drawn only when every value parses as a number: its length is the
    # stat's share of the largest one, so the bar restates the printed numbers
    # instead of inventing a trend.
    parsed = [_magnitude(str(s.get("value", ""))) for s in stats]
    nums = [v for v, _tag in parsed]
    tags = {tag for _v, tag in parsed}
    # Bars only when every value is a number in the same unit: a card comparing
    # houses with pounds would draw a chart that means nothing.
    bars = bool(nums) and all(v is not None for v in nums) and len(tags) == 1
    scale = max([v for v in nums if v is not None], default=0.0) if bars else 0.0

    n = max(1, len(stats))
    cols = 2 if n <= 4 else 3
    nrows = int(math.ceil(n / cols))
    tw = (W - 2 * M - (cols - 1) * GAP) // cols
    th = min(212, (y1 - y0 - (nrows - 1) * GAP) // nrows)

    for i, stat in enumerate(stats):
        r, c = divmod(i, cols)
        x = M + c * (tw + GAP)
        yy = y0 + r * (th + GAP)
        acc = style.accents[i % len(style.accents)]
        d.rounded_rectangle([x, yy, x + tw, yy + th], radius=style.radius, fill=style.card)
        if style.border:
            d.rounded_rectangle([x, yy, x + tw, yy + th], radius=style.radius,
                                outline=style.border, width=1)
        d.rectangle([x + 18, yy + 16, x + 18 + 22, yy + 19], fill=acc)

        value = str(stat.get("value", "")).strip()
        vface = _bold_face(style)
        vsize = _fit_size(d, value, vface, 52, tw - 36, 26)
        d.text((x + 18, yy + 26), value, font=_font(vface, vsize), fill=style.ink)

        if not bars:
            d.line([x + 18, yy + th - 22, x + 70, yy + th - 22], fill=acc, width=2)
        ly = yy + 26 + vsize + 8
        for line in _wrap(d, str(stat.get("label", "")), f["label"], tw - 36)[:2]:
            d.text((x + 18, ly), line, font=f["label"], fill=style.muted)
            ly += f["label"].size + 4

        num = nums[i]
        if bars and num is not None and scale > 0:
            frac = max(0.04, min(1.0, num / scale))
            bar_y = yy + th - 20
            d.rounded_rectangle([x + 18, bar_y, x + tw - 18, bar_y + 6], radius=3,
                                fill=_shade(style.card, -0.10))
            d.rounded_rectangle([x + 18, bar_y, x + 18 + int((tw - 36) * frac),
                                 bar_y + 6], radius=3, fill=acc)
    return img


_FAMILY_FN = {
    "cards": _family_cards,
    "rows": _family_rows,
    "poster": _family_poster,
    "kpi": _family_kpi,
}


# ------------------------------------------------------------------- public


def render(data: Dict[str, Any], title: str, style_name: str = "") -> Image.Image:
    """Draw one infographic. `data` is the model's structured payload:
    {title, takeaway, stats[], quotes[]}. Unknown styles fall back to the default."""
    data = data if isinstance(data, dict) else {}
    style = igstyles.resolve(style_name)
    f = _faces(style)

    if style.family == "poster":
        img = _gradient(style.paper, _shade(style.paper, -0.55))
    else:
        img = Image.new("RGB", (W, H), style.paper)

    if "grid" in style.decor:
        img = _decor_grid(img, style)
    if "ticks" in style.decor:
        img = _decor_ticks(img, style)
    if "glow" in style.decor:
        img = _decor_glow(img, style)
    if "overprint" in style.decor:
        img = _decor_overprint(img, style)
    if "hard-border" in style.decor:
        ImageDraw.Draw(img).rectangle([0, 0, W - 1, H - 1], outline=style.ink, width=8)

    stats = [s for s in (data.get("stats") or []) if isinstance(s, dict)]
    # the meta line must count what is actually drawn: the row layouts show four
    shown = min(len(stats), 4 if style.family in ("rows", "poster") else 6)
    take = str(data.get("takeaway") or "").strip()
    band_font, band_h, _ = _takeaway_band(style, f, take, ImageDraw.Draw(img))
    band_y = H - 28 - band_h if band_h else H

    img, y0 = _header(img, style, f, data.get("title") or title,
                      meta=f"{style.label} · {shown} stats")

    y1 = (band_y - 22) if band_h else (H - 30)
    fn = _FAMILY_FN.get(style.family, _family_cards)
    img = fn(img, style, f, data, y0 + 10, y1, band_h)

    if "halftone" in style.decor:
        img = _decor_halftone(img, style)
    if "scanlines" in style.decor:
        img = _decor_scanlines(img, style)
    if "tape" in style.decor:
        img = _decor_tape(img, style)

    img = _takeaway(img, style, f, take, band_h, band_y)
    return img


def render_thumb(data: Dict[str, Any], title: str, style_name: str,
                 size: Tuple[int, int] = (300, 225)) -> Image.Image:
    """Small preview for a picker: the real style at 1/4 scale."""
    img = render(data, title, style_name)
    resample = getattr(Image, "Resampling", Image).LANCZOS
    return img.resize(size, resample)
