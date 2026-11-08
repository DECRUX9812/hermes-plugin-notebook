"""Illustration treatments — the cartoon and realistic artwork the pack adds.

Both are built from primitives so they stay editable, themeable and tiny:

* `cartoon` — flat fills, 4px ink outlines, offset shadows, a picture-book sky with
  sun, hills and clouds, plus reusable figures and blobs;
* `plate` — a photographic *lighting* treatment, not a photograph: a key light in
  the upper left, a rim light opposite, a horizon, a soft vignette and film grain.

The distinction matters for honesty: a `plate` background looks photographed, but
it is still drawn, and nothing in it is a stock image of a real thing.
"""

from __future__ import annotations

import math
from typing import List, Tuple

from . import core
from .themes import Preset

RGB = Tuple[int, int, int]


# ------------------------------------------------------------------ cartoon


def cartoon_sky(w: int, h: int, p: Preset, horizon: float = 0.62) -> List[str]:
    """Picture-book backdrop, three layers deep: a warm sky, a sun with a glow and
    rays, puffy outlined clouds, and three hill bands that overlap so the scene has
    depth instead of a single arc."""
    sky_top = core.shade(p.paper, 0.20)
    sky_bottom = core.mix(p.paper, p.accents[3 % len(p.accents)], 0.16)
    green = p.accents[2 % len(p.accents)]
    hills = [core.mix(p.paper, green, t) for t in (0.22, 0.38, 0.58)]
    out: List[str] = [
        core.gradient("sky", sky_top, sky_bottom, "vertical"),
        f'<rect width="{w}" height="{h}" fill="url(#sky)"/>',
    ]

    # sun: glow, disc, rays
    sx, sy, sr = w * 0.83, h * 0.16, h * 0.062
    out += [core.radial("sunGlow", core.mix(core.shade(p.accents[3 % len(p.accents)], 0.25), p.paper, 0.15),
                        core.mix(sky_top, p.paper, 0.2)),
            f'<circle cx="{sx:.0f}" cy="{sy:.0f}" r="{sr * 3.2:.0f}" fill="url(#sunGlow)" opacity="0.85"/>']
    for i in range(10):
        a = i * math.pi / 5 + 0.18
        out.append(core.line(sx + math.cos(a) * (sr + 9), sy + math.sin(a) * (sr + 9),
                             sx + math.cos(a) * (sr + 24), sy + math.sin(a) * (sr + 24),
                             p.ink, 3, 0.8, cap="round"))
    out += [core.circle(sx, sy, sr, fill=core.hexed(p.accents[3 % len(p.accents)])),
            core.circle(sx, sy, sr, fill="none", stroke=p.ink, sw=3)]

    for cx, cy, sc in ((w * 0.15, h * 0.15, 1.0), (w * 0.42, h * 0.09, 0.66),
                       (w * 0.66, h * 0.20, 0.5)):
        out += _cloud(cx, cy, sc * h * 0.048, p)

    # birds: two ticks that read as distance
    for bx, by in ((w * 0.56, h * 0.13), (w * 0.60, h * 0.16)):
        out.append(core.path(f"M{bx:.0f} {by:.0f} q 7 -7 14 0 q 7 -7 14 0",
                             stroke=p.ink, sw=2, fill="none", opacity=0.55))

    hy = h * horizon
    out.append(core.path(
        f"M0 {hy + 30} Q {w * 0.18} {hy - 54} {w * 0.40} {hy + 4} "
        f"T {w * 0.74} {hy - 18} T {w} {hy + 8} L {w} {h} L 0 {h}",
        fill=core.hexed(hills[0])))
    out.append(core.path(
        f"M0 {hy + 86} Q {w * 0.26} {hy + 6} {w * 0.52} {hy + 62} "
        f"T {w} {hy + 44} L {w} {h} L 0 {h}", fill=core.hexed(hills[1])))
    out.append(core.path(
        f"M0 {hy + 132} Q {w * 0.34} {hy + 62} {w * 0.63} {hy + 116} "
        f"T {w} {hy + 100} L {w} {h} L 0 {h}",
        fill=core.hexed(hills[2]), stroke=p.ink, sw=3))

    # no filler props: a scene with five shapes reads as illustration, the same
    # scene with scattered extras reads as clip art
    return out


def _cloud_pts(cx: float, cy: float, r: float) -> List[Tuple[float, float]]:
    """Three-lobe puff: a flat base with two humps, sampled as a closed path."""
    pts: List[Tuple[float, float]] = []
    lobes = ((-1.05, 0.15, 0.62), (-0.25, -0.55, 0.85), (0.75, 0.05, 0.66))
    for lx, ly, lr in lobes:
        cx_l, cy_l, r_l = cx + lx * r * 1.1, cy + ly * r, r * lr
        for i in range(12):
            a = math.pi + i * math.pi / 11
            pts.append((cx_l + math.cos(a) * r_l * 1.25, cy_l + math.sin(a) * r_l))
    pts.append((cx + 1.25 * r, cy + r * 0.55))
    pts.append((cx - 1.35 * r, cy + r * 0.55))
    return pts


def _cloud(cx: float, cy: float, r: float, p: Preset) -> List[str]:
    body = " ".join(f"{'M' if i == 0 else 'L'}{x:.1f} {y:.1f}"
                    for i, (x, y) in enumerate(_cloud_pts(cx, cy, r)))
    return [core.path(body, fill=core.hexed(p.card), stroke=p.ink, sw=3, close=True)]


def figure(cx: float, base_y: float, height: float, p: Preset, accent_index: int = 0,
           arms: str = "up") -> List[str]:
    """A standing figure: head, torso, two arms. Flat fill, ink outline."""
    head_r = height * 0.11
    body_top = base_y - height + head_r * 2
    fill = p.accents[accent_index % len(p.accents)]
    out = [core.circle(cx, base_y - height + head_r, head_r, fill=core.hexed(p.card),
                       stroke=p.ink, sw=3)]
    out.append(core.path(
        f"M{cx - head_r * 1.15:.1f} {body_top + height * 0.62:.1f} "
        f"Q {cx:.1f} {body_top - height * 0.04:.1f} {cx + head_r * 1.15:.1f} "
        f"{body_top + height * 0.62:.1f} Z",
        fill=core.hexed(fill), stroke=p.ink, sw=3, close=True))
    # legs: two strokes under the torso, so the shape reads as a standing person
    hip_y = body_top + height * 0.58
    for side in (-1, 1):
        out.append(core.path(
            f"M{cx + side * head_r * 0.42:.1f} {hip_y:.1f} L "
            f"{cx + side * head_r * 0.55:.1f} {base_y:.1f}", stroke=p.ink, sw=4,
            fill="none", cap="round"))
    shoulder_y = body_top + height * 0.14
    for side in (-1, 1):
        if arms == "up":
            elbow_x = cx + side * height * 0.17
            hand_y = shoulder_y - height * 0.16
        else:
            elbow_x = cx + side * height * 0.22
            hand_y = shoulder_y + height * 0.12
        out.append(core.path(
            f"M{cx + side * head_r * 1.05:.1f} {shoulder_y:.1f} "
            f"Q {elbow_x:.1f} {shoulder_y - height * 0.02:.1f} "
            f"{elbow_x + side * height * 0.04:.1f} {hand_y:.1f}",
            stroke=p.ink, sw=4, fill="none", cap="round"))
    return out


def blob(cx: float, cy: float, r: float, p: Preset, accent_index: int = 1,
         seed: int = 3, outline: bool = True) -> List[str]:
    pts = []
    for i in range(24):
        a = 2 * math.pi * i / 24
        wobble = 1 + 0.12 * math.sin(a * 3 + seed) + 0.06 * math.cos(a * 5 - seed)
        pts.append((cx + math.cos(a) * r * wobble, cy + math.sin(a) * r * wobble))
    d = " ".join(f"{'M' if i == 0 else 'L'}{x:.1f} {y:.1f}" for i, (x, y) in enumerate(pts))
    return [core.path(d, close=True,
                      fill=core.hexed(p.accents[accent_index % len(p.accents)]),
                      stroke=p.ink if outline else None, sw=3)]


def arrow(x1: float, y1: float, x2: float, y2: float, p: Preset,
          accent_index: int = 0) -> List[str]:
    """A chunky cartoon connector with an outlined head."""
    ang = math.atan2(y2 - y1, x2 - x1)
    head = 14
    left = (x2 - head * math.cos(ang - 0.5), y2 - head * math.sin(ang - 0.5))
    right = (x2 - head * math.cos(ang + 0.5), y2 - head * math.sin(ang + 0.5))
    col = core.hexed(p.accents[accent_index % len(p.accents)])
    return [core.line(x1, y1, x2, y2, col, 6, cap="round"),
            core.path(f"M{left[0]:.1f} {left[1]:.1f} L {x2:.1f} {y2:.1f} "
                      f"L {right[0]:.1f} {right[1]:.1f}", fill=col, close=True)]


def cartoon_props(w: int, h: int, p: Preset, ground: float = 0.70) -> List[str]:
    """Scene props that sit ON the hills rather than on top of the layout: a small
    figure on the near hill and two marker flags."""
    ground = h * ground
    out: List[str] = []
    out += figure(w * 0.78, ground + h * 0.05, h * 0.15, p, 1, arms="up")
    for fx in (0.13, 0.24):
        x = w * fx
        out.append(core.line(x, ground + h * 0.07, x, ground - h * 0.05, p.ink, 3))
        out.append(core.path(f"M{x:.0f} {ground - h * 0.03:.0f} L {x + 26:.0f} "
                             f"{ground - h * 0.01:.0f} L {x:.0f} {ground + h * 0.01:.0f}",
                             fill=core.hexed(p.accents[0]), close=True))
    return out


# ------------------------------------------------------------------- plate


def plate_background(w: int, h: int, p: Preset) -> List[str]:
    """A studio-lit cyc wall, drawn: base falloff, a key light, a rim light, a floor
    with its own reflection, a vignette and film grain.

    The point is the *lighting* reading as photographic — soft falloff, a horizon
    that the light wraps around, and grain that keeps large areas from banding. No
    element is a picture of a thing.
    """
    lift = core.shade(p.paper, 0.30)
    deep = core.shade(p.paper, -0.46)
    floor = core.shade(p.paper, -0.20)
    key = core.mix(core.shade(p.paper, 0.62), p.accents[0], 0.20)
    rim = core.mix(p.accents[0], p.paper, 0.30)
    horizon = 0.66

    out: List[str] = [
        core.gradient("plateBase", lift, deep),
        f'<rect width="{w}" height="{h}" fill="url(#plateBase)"/>',
    ]
    # key light: broad, soft, upper-left
    out += [
        core.radial("keyLight", key, deep),
        f'<ellipse cx="{w * 0.26:.0f}" cy="{h * 0.06:.0f}" rx="{w * 0.62:.0f}" '
        f'ry="{h * 0.52:.0f}" fill="url(#keyLight)" opacity="0.55" '
        f'filter="url(#soften)"/>',
    ]
    # rim light: opposite corner, tighter and brighter
    out += [
        core.radial("rimLight", rim, deep),
        f'<ellipse cx="{w * 0.94:.0f}" cy="{h * 0.30:.0f}" rx="{w * 0.30:.0f}" '
        f'ry="{h * 0.30:.0f}" fill="url(#rimLight)" opacity="0.42" '
        f'filter="url(#soften)"/>',
    ]
    # floor: no hard edge. A soft pool of light on the lower third plus a faint
    # horizon haze reads as a surface; a band with a straight top reads as a seam.
    out += [
        core.radial("pool", core.mix(key, deep, 0.55), deep),
        f'<ellipse cx="{w * 0.5:.0f}" cy="{h * 1.02:.0f}" rx="{w * 0.72:.0f}" '
        f'ry="{h * 0.34:.0f}" fill="url(#pool)" opacity="0.55" filter="url(#soften)"/>',
        f'<ellipse cx="{w * 0.5:.0f}" cy="{h * horizon:.0f}" rx="{w * 0.62:.0f}" '
        f'ry="{h * 0.10:.0f}" fill="{core.hexed(core.mix(key, deep, 0.35))}" '
        f'opacity="0.22" filter="url(#soften)"/>',
        core.line(0, h * horizon, w, h * horizon,
                  core.mix(p.accents[0], p.paper, 0.45), 1, 0.10),
    ]
    # vignette
    out += [
        core.radial("vig", core.shade(p.paper, 0.05), (0, 0, 0)),
        f'<rect width="{w}" height="{h}" fill="url(#vig)" opacity="0.50"/>',
        f'<rect width="{w}" height="{h}" filter="url(#grain)" opacity="0.9"/>',
    ]
    return out


def specular_streak(w: int, h: int, p: Preset) -> List[str]:
    """A single thin highlight crossing the sheet — the thing that reads as glass."""
    x = w * 0.18
    return [core.path(f"M{x:.0f} 0 L {x + w * 0.10:.0f} 0 L {x - w * 0.02:.0f} {h} "
                      f"L {x - w * 0.12:.0f} {h}", fill=core.hexed(
                          core.mix(p.accents[0], (255, 255, 255), 0.7)), opacity=0.05)]


# ------------------------------------------------------- glass / clay / sumi / deco


def mesh_background(w: int, h: int, p: Preset) -> List[str]:
    """Modern SaaS mesh: three huge blurred colour fields over a deep base. Reads as
    a gradient because the blobs are far larger than the sheet, never as circles."""
    base = core.shade(p.paper, -0.10)
    out: List[str] = [core.gradient("meshBase", core.shade(p.paper, 0.06), base),
                      f'<rect width="{w}" height="{h}" fill="url(#meshBase)"/>']
    blobs = ((0.18, 0.10, 0.55, p.accents[0]), (0.86, 0.22, 0.48, p.accents[1 % len(p.accents)]),
             (0.62, 0.92, 0.60, p.accents[2 % len(p.accents)]), (0.04, 0.82, 0.42,
                                                                 p.accents[0]))
    for fx, fy, fr, col in blobs:
        out.append(core.radial("meshBlob", core.mix(col, p.paper, 0.10), base))
        out.append(f'<ellipse cx="{w * fx:.0f}" cy="{h * fy:.0f}" rx="{w * fr:.0f}" '
                   f'ry="{h * fr:.0f}" fill="url(#meshBlob)" opacity="0.55" '
                   f'filter="url(#soften)"/>')
    out.append(f'<rect width="{w}" height="{h}" filter="url(#grain)" opacity="0.6"/>')
    return out


def clay_background(w: int, h: int, p: Preset) -> List[str]:
    """Claymorphism: a warm, almost matte surface with a single soft light from the
    top and a faint warm bounce at the bottom."""
    out: List[str] = [
        core.gradient("clayBase", core.shade(p.paper, 0.10), core.shade(p.paper, -0.06)),
        f'<rect width="{w}" height="{h}" fill="url(#clayBase)"/>',
        core.radial("clayLight", core.shade(p.paper, 0.30), core.shade(p.paper, -0.05)),
        f'<ellipse cx="{w * 0.30:.0f}" cy="{h * -0.05:.0f}" rx="{w * 0.70:.0f}" '
        f'ry="{h * 0.45:.0f}" fill="url(#clayLight)" opacity="0.55" filter="url(#soften)"/>',
        f'<ellipse cx="{w * 0.80:.0f}" cy="{h * 1.02:.0f}" rx="{w * 0.45:.0f}" '
        f'ry="{h * 0.30:.0f}" fill="{core.hexed(core.mix(p.accents[1 % len(p.accents)], p.paper, 0.7))}" '
        f'opacity="0.35" filter="url(#soften)"/>',
    ]
    return out


def sumi_background(w: int, h: int, p: Preset) -> List[str]:
    """Ink wash: two soft brush strokes in the corner, paper tone, nothing else. The
    stroke is a filled path with a blurred twin underneath, which is how a wash reads
    as pigment rather than as a shape."""
    ink = core.mix(p.ink, p.paper, 0.55)
    vermilion = core.mix(p.accents[1 % len(p.accents)], p.paper, 0.35)
    out: List[str] = [
        core.gradient("sumiPaper", core.shade(p.paper, 0.04), core.shade(p.paper, -0.04)),
        f'<rect width="{w}" height="{h}" fill="url(#sumiPaper)"/>',
        f'<g filter="url(#soften)"><path d="M{w * 0.06:.0f} {h * 0.20:.0f} '
        f'Q {w * 0.30:.0f} {h * 0.02:.0f} {w * 0.58:.0f} {h * 0.16:.0f} '
        f'Q {w * 0.34:.0f} {h * 0.20:.0f} {w * 0.06:.0f} {h * 0.24:.0f} Z" '
        f'fill="{core.hexed(ink)}" opacity="0.20"/></g>',
        f'<g filter="url(#soften)"><path d="M{w * 0.94:.0f} {h * 0.94:.0f} '
        f'Q {w * 0.62:.0f} {h * 0.86:.0f} {w * 0.40:.0f} {h * 1.02:.0f} '
        f'Q {w * 0.70:.0f} {h * 0.98:.0f} {w * 0.94:.0f} {h * 0.98:.0f} Z" '
        f'fill="{core.hexed(ink)}" opacity="0.14"/></g>',
        core.circle(w * 0.90, h * 0.16, h * 0.018, fill=vermilion, opacity=0.85),
        f'<rect width="{w}" height="{h}" filter="url(#grain)" opacity="0.5"/>',
    ]
    return out


def deco_background(w: int, h: int, p: Preset) -> List[str]:
    """Art deco: a gold frame, a fan of rays behind the type, and double rules. All
    strokes, no fills — the restraint is the style."""
    gold = p.accents[0]
    out: List[str] = [
        core.gradient("decoBase", core.shade(p.paper, 0.06), p.paper),
        f'<rect width="{w}" height="{h}" fill="url(#decoBase)"/>',
    ]
    inset = int(min(w, h) * 0.035)
    out += [core.rect(inset, inset, w - 2 * inset, h - 2 * inset, fill="none",
                      stroke=gold, sw=1.2, opacity=0.55),
            core.rect(inset + 7, inset + 7, w - 2 * (inset + 7), h - 2 * (inset + 7),
                      fill="none", stroke=gold, sw=0.8, opacity=0.30)]
    # fan of rays, anchored below the top edge
    cx, cy = w * 0.5, h * 0.06
    for i in range(13):
        a = math.pi * (i / 12)
        out.append(core.line(cx, cy, cx + math.cos(a) * w * 0.55, cy + math.sin(a) * h * 0.55,
                             gold, 0.9, 0.16))
    out.append(core.circle(cx, cy, h * 0.035, fill="none", stroke=gold, sw=1.2, opacity=0.5))
    return out


def dither_background(w: int, h: int, p: Preset) -> List[str]:
    """One-bit pretence: a dot screen and a halftone band, exactly the trick a
    two-colour print uses to fake a midtone."""
    ink = p.ink
    out: List[str] = [
        core.gradient("dithBase", core.shade(p.paper, 0.08), core.shade(p.paper, -0.03)),
        f'<rect width="{w}" height="{h}" fill="url(#dithBase)"/>',
        '<pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse">'
        f'<circle cx="1.5" cy="1.5" r="1.3" fill="{core.hexed(ink)}" opacity="0.16"/></pattern>',
        '<pattern id="dotsBig" width="10" height="10" patternUnits="userSpaceOnUse">'
        f'<circle cx="3" cy="3" r="2.4" fill="{core.hexed(p.accents[0])}" opacity="0.12"/>'
        '</pattern>',
        f'<rect width="{w}" height="{h}" fill="url(#dots)"/>',
        f'<rect y="{int(h * 0.62)}" width="{w}" height="{h - int(h * 0.62)}" fill="url(#dotsBig)"/>',
    ]
    for i in range(9):
        y = h * (0.10 + i * 0.030)
        out.append(core.line(0, y, w, y, ink, 1, 0.05))
    return out


def hud_background(w: int, h: int, p: Preset) -> List[str]:
    """Heads-up display: warm-black glass, a 48px reticle grid, corner brackets and a
    header readout. Everything thin, green, and perfectly aligned."""
    green = p.accents[0]
    out: List[str] = [
        core.gradient("hudBase", core.shade(p.paper, 0.06), core.shade(p.paper, -0.12)),
        f'<rect width="{w}" height="{h}" fill="url(#hudBase)"/>',
    ]
    step = 48
    for x in range(0, w, step):
        out.append(core.line(x, 0, x, h, green, 0.7, 0.055))
    for y in range(0, h, step):
        out.append(core.line(0, y, w, y, green, 0.7, 0.055))
    arm, off = 54, 26
    for cx, cy, sx, sy in ((off, off, 1, 1), (w - off, off, -1, 1),
                           (off, h - off, 1, -1), (w - off, h - off, -1, -1)):
        out.append(core.path(f"M{cx} {cy + sy * arm} L {cx} {cy} L {cx + sx * arm} {cy}",
                             stroke=green, sw=2, fill="none", opacity=0.55))
    out.append(core.line(0, off - 10, w, off - 10, green, 1, 0.18))
    out.append(f'<rect width="{w}" height="{h}" filter="url(#grain)" opacity="0.35"/>')
    return out


# ------------------------------------------------------------------- shared


_BACKDROPS = {
    "dither": dither_background,
    "hud": hud_background,
    "mesh": mesh_background,
    "clay": clay_background,
    "sumi": sumi_background,
    "deco": deco_background,
}


def backdrop(w: int, h: int, p: Preset, horizon: float = 0.62) -> List[str]:
    """Whatever art the preset asks for, or nothing at all.

    `horizon` is where the land meets the sky as a fraction of the height: a cover
    puts its type plate over the bottom half, so its horizon has to sit higher or
    the hills disappear behind the plate.
    """
    if p.art == "cartoon":
        return cartoon_sky(w, h, p, horizon) + cartoon_props(w, h, p, horizon + 0.08)
    if p.art == "plate":
        return plate_background(w, h, p) + specular_streak(w, h, p)
    fn = _BACKDROPS.get(p.art)
    return fn(w, h, p) if fn else []


def defs_for(p: Preset) -> List[str]:
    out: List[str] = []
    if p.art in ("mesh", "sumi", "clay", "deco", "dither", "hud"):
        out += [core.filter_blur("soften", 60), core.filter_grain("grain", strength=0.05)]
        if p.art == "clay":
            out += [core.filter_soft_shadow("clay", dy=18, blur=26, strength=0.20)]
        if p.art == "mesh":
            out += [core.filter_soft_shadow("soft", dy=12, blur=24, strength=0.35)]
    if p.art == "plate":
        out += [core.filter_grain("grain", frequency=0.9, strength=0.10),
                core.filter_blur("soften", 60),
                core.filter_soft_shadow("soft", dy=14, blur=26, strength=0.42),
                # a gloss band across the top of a card reads as a lit surface
                '<linearGradient id="cardgloss" x1="0" y1="0" x2="0" y2="1">'
                '<stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/>'
                '<stop offset="0.45" stop-color="#ffffff" stop-opacity="0.02"/>'
                '<stop offset="1" stop-color="#000000" stop-opacity="0.10"/></linearGradient>']
    if p.art == "cartoon" or "outline" in p.decor:
        out += [core.filter_soft_shadow("stick", dy=6, blur=0, strength=0.16)]
    return out


def card_shadow_attr(p: Preset) -> str:
    """Attributes a card should carry so it sits on the artwork rather than on it."""
    if p.art == "plate":
        return 'filter="url(#soft)"'
    if p.art == "mesh":
        return 'filter="url(#soft)"'
    if p.art == "clay":
        return 'filter="url(#clay)"'
    if p.art == "cartoon":
        return 'filter="url(#stick)"'
    return ""
