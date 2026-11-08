"""Core of the graphics library: colour, measured text, SVG primitives.

Three things live here, and everything else in `gfx` is built from them:

* **colour** — mixing, WCAG contrast, and `readable()`, which pushes an accent
  colour away from its background until it can legally be used for glyphs;
* **text** — measurement (Pillow metrics on the DejaVu fallback, which is wider
  than Inter, so measured widths are an upper bound), wrapping, fitting, clipping;
* **primitives** — small builders that emit SVG source strings.

Nothing here knows what a graphic is. Presets live in `themes.py`, composition in
`templates.py`, and documents in `document.py`.
"""

from __future__ import annotations

import math
from html import escape
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from PIL import ImageFont

RGB = Tuple[int, int, int]

#: Type stacks per face. Every face ends in a font that ships with a bare Linux
#: image, so a document never depends on the host having our first choice.
FONT_STACK = {
    "sans": "'Inter var','Inter','DejaVu Sans','Helvetica Neue',Arial,sans-serif",
    "serif": "'Iowan Old Style','Charter','DejaVu Serif',Georgia,serif",
    "mono": "'JetBrains Mono','DejaVu Sans Mono',ui-monospace,monospace",
}

_METRIC_PATHS = {
    ("sans", False): "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ("sans", True): "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ("serif", False): "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    ("serif", True): "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    ("mono", False): "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ("mono", True): "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
}

_METRICS: Dict[Tuple[str, bool, int], Any] = {}


# --------------------------------------------------------------------- colour


def hexed(c: RGB) -> str:
    return "#%02x%02x%02x" % (max(0, min(255, int(c[0]))),
                              max(0, min(255, int(c[1]))),
                              max(0, min(255, int(c[2]))))


def mix(a: RGB, b: RGB, t: float) -> RGB:
    t = max(0.0, min(1.0, t))
    return (int(a[0] + (b[0] - a[0]) * t), int(a[1] + (b[1] - a[1]) * t),
            int(a[2] + (b[2] - a[2]) * t))


def shade(c: RGB, k: float) -> RGB:
    """k<0 darkens toward black, k>0 lightens toward white."""
    return mix(c, (255, 255, 255) if k > 0 else (0, 0, 0), abs(k))


def luminance(c: RGB) -> float:
    def channel(v: float) -> float:
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])


def contrast(a: RGB, b: RGB) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def readable(fg: RGB, bg: RGB, minimum: float = 4.5) -> RGB:
    """Accent colours are picked for punch, not legibility. Move the glyph colour
    away from the page until it clears `minimum`; the bright accent stays available
    for rules, bars and swatches."""
    if contrast(fg, bg) >= minimum:
        return fg
    step = -0.03 if luminance(bg) > 0.45 else 0.03
    cand = fg
    for _ in range(24):
        cand = shade(cand, step)
        if contrast(cand, bg) >= minimum:
            return cand
    return cand


def pick_ink(bg: RGB, dark: RGB = (18, 18, 20), light: RGB = (250, 250, 252)) -> RGB:
    """The legible ink for an arbitrary background — used when a template lands on
    a colour it did not choose (artwork, user theme)."""
    return dark if contrast(dark, bg) >= contrast(light, bg) else light


def parse_colour(value: Any, fallback: RGB) -> RGB:
    """Tolerant colour parsing for user input: '#rgb', '#rrggbb', 'rgb(1,2,3)',
    a name we happen to know, or a tuple. Malformed input falls back, never raises."""
    if isinstance(value, (tuple, list)) and len(value) >= 3:
        try:
            return (int(value[0]), int(value[1]), int(value[2]))
        except Exception:
            return fallback
    text = str(value or "").strip().lower()
    if not text:
        return fallback
    if text.startswith("#"):
        body = text[1:]
        if len(body) == 3:
            body = "".join(ch * 2 for ch in body)
        if len(body) == 6:
            try:
                return (int(body[0:2], 16), int(body[2:4], 16), int(body[4:6], 16))
            except Exception:
                return fallback
        return fallback
    if text.startswith("rgb(") and text.endswith(")"):
        parts = [p.strip() for p in text[4:-1].split(",")]
        if len(parts) >= 3:
            try:
                return (int(float(parts[0])), int(float(parts[1])), int(float(parts[2])))
            except Exception:
                return fallback
    return fallback


# ----------------------------------------------------------------------- text


def metric_font(face: str, bold: bool, size: int):
    key = (face, bold, size)
    if key in _METRICS:
        return _METRICS[key]
    path = _METRIC_PATHS.get((face, bold)) or _METRIC_PATHS[("sans", bold)]
    try:
        font = ImageFont.truetype(path, size)
    except Exception:                                   # pragma: no cover
        try:
            font = ImageFont.load_default(size=size)
        except Exception:
            font = ImageFont.load_default()
    _METRICS[key] = font
    return font


def util_escape(value: Any) -> str:
    """XML-safe text for <title>/<desc>/HTML slots."""
    return escape(str(value if value is not None else ""), quote=True)


def text_width(body: str, face: str, size: int, bold: bool = False,
               tracking: float = 0.0) -> float:
    body = str(body or "")
    width = float(metric_font(face, bold, size).getlength(body))
    if tracking and body:
        width += tracking * (len(body) - 1)
    return width


def wrap(body: str, face: str, size: int, max_w: float, bold: bool = False,
         limit: Optional[int] = None) -> List[str]:
    """Greedy word wrap against measured widths. A single word wider than the box is
    left intact (clipping is the caller's decision, not the wrapper's)."""
    words = str(body or "").split()
    if not words:
        return []
    lines: List[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if not cur or text_width(trial, face, size, bold) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines[:limit] if limit else lines


def clip(body: str, face: str, size: int, max_w: float, bold: bool = False,
         ellipsis: str = "…") -> str:
    body = str(body or "")
    if text_width(body, face, size, bold) <= max_w:
        return body
    while body and text_width(body + ellipsis, face, size, bold) > max_w:
        body = body[:-1]
    return body + ellipsis


def fit(body: str, face: str, size: int, max_w: float, bold: bool = True,
        min_size: int = 24, step: int = 2) -> int:
    """Largest size <= `size` at which the single line fits."""
    while size > min_size and text_width(body, face, size, bold) > max_w:
        size -= step
    return size


def clamp_words(body: str, words: int) -> str:
    parts = str(body or "").split()
    return " ".join(parts[:words]) + ("…" if len(parts) > words else "")


# ----------------------------------------------------------------- primitives


def paint(c: Any) -> str:
    """A colour tuple, or a raw paint reference such as `url(#grid)` / `none`."""
    if c is None:
        return "none"
    if isinstance(c, str):
        return c
    return hexed(c)


def text(x: float, y: float, body: str, size: int, fill: Any, face: str = "sans",
         bold: bool = False, anchor: str = "start", opacity: float = 1.0,
         tracking: float = 0.0, weight: Optional[int] = None,
         baseline: str = "") -> str:
    """One text run. `y` is the baseline unless `baseline` is given."""
    if body is None or str(body) == "":
        return ""
    attrs = [
        f'x="{x:.1f}"', f'y="{y:.1f}"',
        f'font-family="{FONT_STACK.get(face, FONT_STACK["sans"])}"',
        f'font-size="{size}"',
        f'font-weight="{weight or (700 if bold else 400)}"',
        f'fill="{paint(fill)}"',
    ]
    if anchor != "start":
        attrs.append(f'text-anchor="{anchor}"')
    if opacity < 1.0:
        attrs.append(f'opacity="{opacity:.2f}"')
    if tracking:
        attrs.append(f'letter-spacing="{tracking}"')
    if baseline:
        attrs.append(f'dominant-baseline="{baseline}"')
    return f'<text {" ".join(attrs)}>{escape(str(body))}</text>'


def rect(x: float, y: float, w: float, h: float, fill: Any = None, stroke: Any = None,
         sw: float = 1, r: float = 0, opacity: float = 1.0, dash: str = "",
         extra: str = "") -> str:
    if w <= 0 or h <= 0:
        return ""
    parts = [f'x="{x:.1f}"', f'y="{y:.1f}"', f'width="{w:.1f}"', f'height="{h:.1f}"']
    if r:
        parts.append(f'rx="{min(r, min(w, h) / 2):.1f}"')
    parts.append(f'fill="{paint(fill)}"')
    if stroke:
        parts += [f'stroke="{paint(stroke)}"', f'stroke-width="{sw}"']
    if opacity < 1.0:
        parts.append(f'opacity="{opacity:.2f}"')
    if dash:
        parts.append(f'stroke-dasharray="{dash}"')
    if extra:
        parts.append(extra)
    return f'<rect {" ".join(parts)}/>'


def line(x1: float, y1: float, x2: float, y2: float, stroke: Any, sw: float = 1,
         opacity: float = 1.0, dash: str = "", cap: str = "") -> str:
    parts = [f'x1="{x1:.1f}"', f'y1="{y1:.1f}"', f'x2="{x2:.1f}"', f'y2="{y2:.1f}"',
             f'stroke="{paint(stroke)}"', f'stroke-width="{sw}"']
    if opacity < 1.0:
        parts.append(f'opacity="{opacity:.2f}"')
    if dash:
        parts.append(f'stroke-dasharray="{dash}"')
    if cap:
        parts.append(f'stroke-linecap="{cap}"')
    return f'<line {" ".join(parts)}/>'


def circle(cx: float, cy: float, r: float, fill: Any = None, stroke: Any = None,
           sw: float = 1, opacity: float = 1.0) -> str:
    parts = [f'cx="{cx:.1f}"', f'cy="{cy:.1f}"', f'r="{r:.1f}"', f'fill="{paint(fill)}"']
    if stroke:
        parts += [f'stroke="{paint(stroke)}"', f'stroke-width="{sw}"']
    if opacity < 1.0:
        parts.append(f'opacity="{opacity:.2f}"')
    return f'<circle {" ".join(parts)}/>'


def ellipse(cx: float, cy: float, rx: float, ry: float, fill: Any = None,
            opacity: float = 1.0) -> str:
    return (f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" '
            f'fill="{paint(fill)}" opacity="{opacity:.2f}"/>')


def path(d: str, fill: Any = None, stroke: Any = None, sw: float = 1,
         opacity: float = 1.0, cap: str = "round", close: bool = False) -> str:
    parts = [f'd="{d}{" Z" if close else ""}"', f'fill="{paint(fill)}"']
    if stroke:
        parts += [f'stroke="{paint(stroke)}"', f'stroke-width="{sw}"',
                  f'stroke-linecap="{cap}"', 'stroke-linejoin="round"']
    if opacity < 1.0:
        parts.append(f'opacity="{opacity:.2f}"')
    return f'<path {" ".join(parts)}/>'


def group(children: Iterable[str], transform: str = "", opacity: float = 1.0,
          clip: str = "") -> str:
    inner = "".join(c for c in children if c)
    if not inner:
        return ""
    attrs = []
    if transform:
        attrs.append(f'transform="{transform}"')
    if opacity < 1.0:
        attrs.append(f'opacity="{opacity:.2f}"')
    if clip:
        attrs.append(f'clip-path="url(#{clip})"')
    return f'<g {" ".join(attrs)}>{inner}</g>'


def gradient(ident: str, top: RGB, bottom: RGB, angle: str = "vertical") -> str:
    coords = ('x1="0" y1="0" x2="0" y2="1"' if angle == "vertical"
              else 'x1="0" y1="0" x2="1" y2="1"')
    return (f'<linearGradient id="{ident}" {coords}>'
            f'<stop offset="0" stop-color="{hexed(top)}"/>'
            f'<stop offset="1" stop-color="{hexed(bottom)}"/></linearGradient>')


def radial(ident: str, inner: RGB, outer: RGB) -> str:
    return (f'<radialGradient id="{ident}">'
            f'<stop offset="0" stop-color="{hexed(inner)}"/>'
            f'<stop offset="1" stop-color="{hexed(outer)}"/></radialGradient>')


def pattern(ident: str, w: float, h: float, body: str) -> str:
    return (f'<pattern id="{ident}" width="{w}" height="{h}" patternUnits="userSpaceOnUse">'
            f'{body}</pattern>')


def filter_blur(ident: str, sigma: float) -> str:
    return (f'<filter id="{ident}" x="-40%" y="-60%" width="180%" height="240%">'
            f'<feGaussianBlur stdDeviation="{sigma}"/></filter>')


def filter_grain(ident: str, frequency: float = 0.85, strength: float = 0.06) -> str:
    """Photographic grain: fractal noise, desaturated, composited at low alpha.
    Deterministic — the seed is fixed, so two renders of the same input match."""
    return (f'<filter id="{ident}"><feTurbulence type="fractalNoise" '
            f'baseFrequency="{frequency}" numOctaves="3" seed="11" stitchTiles="stitch"/>'
            f'<feColorMatrix type="saturate" values="0"/>'
            f'<feComponentTransfer><feFuncA type="linear" slope="{strength}"/>'
            f'</feComponentTransfer></filter>')


def filter_soft_shadow(ident: str, dy: float = 8, blur: float = 12,
                       strength: float = 0.22) -> str:
    return (f'<filter id="{ident}" x="-30%" y="-30%" width="160%" height="170%">'
            f'<feDropShadow dx="0" dy="{dy}" stdDeviation="{blur}" '
            f'flood-color="#000000" flood-opacity="{strength}"/></filter>')


def wobble_d(x1: float, y1: float, x2: float, y2: float, seed: int = 1,
             amp: float = 1.7, step: float = 26) -> str:
    """A hand-drawn rule: a polyline with a sine offset."""
    count = max(2, int((x2 - x1) / step) + 1)
    pts = []
    for i in range(count):
        t = i / (count - 1)
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t + math.sin((i + seed) * 1.7) * amp
        pts.append(f'{"M" if i == 0 else "L"}{x:.1f} {y:.1f}')
    return " ".join(pts)


def svg_size_attrs(w: int, h: int, responsive: bool = False) -> str:
    if responsive:
        return f'viewBox="0 0 {w} {h}" style="width:100%;height:auto;display:block"'
    return f'width="{w}" height="{h}" viewBox="0 0 {w} {h}"'


def sequence(items: Sequence[Any], limit: Optional[int] = None) -> List[Any]:
    """Tolerant list: accepts None, a single dict, or a list of dicts."""
    if items is None:
        return []
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, (list, tuple)):
        return []
    good = [i for i in items if isinstance(i, dict)]
    return good[:limit] if limit else good
