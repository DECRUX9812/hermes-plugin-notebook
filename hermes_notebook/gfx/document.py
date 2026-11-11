"""Documents — orientation, assembly, accessibility, serialisation, fallbacks.

`render()` is the library's front door: give it a graphic dict, a template, a
preset, and an orientation, and get SVG source back. Everything else here exists
so that callers can stop thinking:

* orientation presets (landscape / portrait / square / explicit pixels) and the
  responsive variant;
* an accessible document (`<title>`, `<desc>`, `role="img"`, labelled by ids) and an
  HTML wrapper with a text alternative;
* a themed render (`theme=` overrides the preset's colours without making a new
  preset);
* serialisation helpers (`write_svg`, `write_html`, `data_url`);
* a raster fallback (`to_png`) through headless Chrome, and a Pillow fallback note.

Failure is always graceful: a bad template name falls back to `infographic`, a bad
preset to the default, a malformed graphic to an empty one, and long strings are
clamped before they reach a `<text>` node.
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from . import core, illustrate, templates
from .themes import BY_ID, DEFAULT_PRESET, Preset, resolve as resolve_preset

#: Named canvases. NotebookLM offers square / portrait / landscape; so do we.
ORIENTATIONS: Dict[str, Tuple[int, int]] = {
    "landscape": (1200, 900),
    "portrait": (900, 1200),
    "square": (1000, 1000),
    "16:9": (1280, 720),
    "9:16": (720, 1280),
    "1:1": (1000, 1000),
    "4:3": (1200, 900),
}

DETAIL_LEVELS = ("concise", "standard", "detailed")

#: Hard ceilings that keep a malformed payload from producing a document nobody can
#: open (SVG with 40k words of text is not a poster).
MAX_TITLE_CHARS = 180
MAX_STATS = 8
MAX_FACTS = 4


def _clamp_text(value: Any, limit: int) -> str:
    text = str(value if value is not None else "").strip()
    text = re.sub(r"\s+", " ", text)
    return text[:limit]


def normalise_graphic(graphic: Any) -> Dict[str, Any]:
    """Tolerant payload: wrong types, missing keys and absurd lengths are handled
    here once, so no template has to defend itself."""
    if not isinstance(graphic, dict):
        if isinstance(graphic, str):
            graphic = {"title": graphic}
        else:
            graphic = {}
    out: Dict[str, Any] = dict(graphic)
    out["title"] = _clamp_text(out.get("title"), MAX_TITLE_CHARS)
    out["takeaway"] = _clamp_text(out.get("takeaway") or out.get("subtitle"), 360)

    stats = core.sequence(out.get("stats"), MAX_STATS)
    fixed_stats: List[Dict[str, Any]] = []
    for s in stats:
        value = _clamp_text(s.get("value") if s.get("value") is not None else s.get("number"), 24)
        label = _clamp_text(s.get("label") or s.get("name"), 90)
        if not value and not label:
            continue
        fixed_stats.append({"value": value or "—", "label": label or "—",
                            "detail": _clamp_text(s.get("detail") or s.get("note"), 110)})
    out["stats"] = fixed_stats

    quotes = core.sequence(out.get("quotes"), MAX_FACTS)
    out["quotes"] = [{"text": _clamp_text(q.get("text") or q.get("fact"), 220),
                      "source": _clamp_text(q.get("source") or q.get("attribution"), 80)}
                     for q in quotes if _clamp_text(q.get("text") or q.get("fact"), 220)]

    events = core.sequence(out.get("events"), 10)
    out["events"] = [{"when": _clamp_text(e.get("when") or e.get("date"), 32),
                      "what": _clamp_text(e.get("what") or e.get("text") or e.get("label"), 160)}
                     for e in events]
    steps = core.sequence(out.get("steps"), 8)
    out["steps"] = [{"title": _clamp_text(s.get("title") or s.get("label"), 90),
                     "text": _clamp_text(s.get("text") or s.get("detail"), 220)} for s in steps]
    return out


def _themed(preset: Preset, theme: Optional[Dict[str, Any]]) -> Preset:
    """Colour overrides on top of a preset — for host apps that pass their own tokens
    instead of picking a preset."""
    if not isinstance(theme, dict) or not theme:
        return preset
    clone = Preset.__new__(Preset)
    for slot in Preset.__slots__:
        setattr(clone, slot, getattr(preset, slot))
    paper = core.parse_colour(theme.get("paper") or theme.get("bg"), preset.paper)
    ink = core.parse_colour(theme.get("ink") or theme.get("fg") or theme.get("text"), preset.ink)
    card = core.parse_colour(theme.get("card") or theme.get("surface"), preset.card)
    accents = preset.accents
    raw = theme.get("accents") or theme.get("accent")
    if isinstance(raw, (list, tuple)) and raw:
        accents = [core.parse_colour(c, preset.accents[0]) for c in raw][:5]
    elif raw:
        accents = [core.parse_colour(raw, preset.accents[0])] + preset.accents[1:]
    clone.paper, clone.ink, clone.card = paper, ink, card
    clone.muted = core.parse_colour(theme.get("muted"), preset.muted)
    clone.accents = accents
    clone.tone = "light" if core.luminance(paper) > 0.5 else "dark"
    return clone


def canvas_for(orientation: Any = "landscape",
               width: Optional[int] = None, height: Optional[int] = None) -> Tuple[int, int]:
    """Explicit pixels win; then a named orientation; then landscape. Nonsense
    sizes are clamped to something a screen can show."""
    if width and height:
        return (max(240, min(4000, int(width))), max(240, min(4000, int(height))))
    key = str(orientation or "landscape").strip().lower()
    return ORIENTATIONS.get(key, ORIENTATIONS["landscape"])



def _defs(f: templates.Frame, p: Preset) -> List[str]:
    out: List[str] = list(illustrate.defs_for(p))
    if "grid" in p.decor:
        line = core.hexed(core.shade(p.paper, 0.10 if p.tone == "light" else 0.13))
        out.append(core.pattern("grid", 30, 30,
                                f'<path d="M30 0H0V30" fill="none" stroke="{line}" '
                                f'stroke-width="1"/>'))
    if "halftone" in p.decor:
        acc = core.hexed(p.accents[1 % len(p.accents)])
        out.append(core.pattern("dot", 12, 12,
                                f'<circle cx="3" cy="3" r="2.2" fill="{acc}" opacity="0.26"/>'))
    if "scanlines" in p.decor:
        out.append(core.pattern("scan", 4, 4,
                                '<rect width="4" height="1" fill="#ffffff" opacity="0.035"/>'))
    if "tape" in p.decor:
        out.append(core.pattern("tape", 9, 9,
                                '<rect width="9" height="9" fill="#ffffff" opacity="0.42"/>'
                                '<rect width="3" height="9" fill="#000000" opacity="0.05"/>'))
    if "glow" in p.decor:
        out.append(core.filter_blur("glow", 70))
    if f.aspect < 0.8:                      # portrait needs a taller art horizon
        out.append(core.filter_soft_shadow("soft", dy=8, blur=14, strength=0.24))
    return out


#: Templates that put type on a grid, where artwork has to stay behind the content.
_GRID_TEMPLATES = ("infographic", "stat_grid", "timeline", "comparison", "process",
                   "key_figure", "quote_card")


#: Covers put a type plate over the lower half, so the artwork has to compose in
#: the space above it.
_HORIZON = {"cover": 0.30, "illustration": 0.58}


def _background(f: templates.Frame, p: Preset, tpl: str = "") -> List[str]:
    art = illustrate.backdrop(f.w, f.h, p, _HORIZON.get(tpl, 0.52))
    if art:
        if tpl in _GRID_TEMPLATES:
            # a scrim keeps the art as texture instead of competing with the type;
            # a photographed surface keeps more of its light than a cartoon sky does
            scrim = {"plate": 0.30, "mesh": 0.10, "clay": 0.12, "sumi": 0.10,
                     "deco": 0.10, "dither": 0.08, "hud": 0.08}.get(p.art, 0.58)
            art.append(core.rect(0, 0, f.w, f.h, fill=core.shade(p.paper, -0.02),
                                 opacity=scrim))
        return art
    if p.family == "poster":
        return [core.gradient("poster", p.paper, core.shade(p.paper, -0.55)),
                f'<rect width="{f.w}" height="{f.h}" fill="url(#poster)"/>']
    return [core.rect(0, 0, f.w, f.h, fill=p.paper)]


def _decor(f: templates.Frame, p: Preset) -> List[str]:
    out: List[str] = []
    if "grid" in p.decor and p.art == "none":
        out.append(f'<rect width="{f.w}" height="{f.h}" fill="url(#grid)"/>')
    if "glow" in p.decor:
        a, b = p.accents[0], p.accents[1 % len(p.accents)]
        out.append(f'<g filter="url(#glow)" opacity="0.40">'
                   f'<ellipse cx="{f.w * 0.18:.0f}" cy="{f.h * 0.10:.0f}" '
                   f'rx="{f.w * 0.30:.0f}" ry="{f.h * 0.28:.0f}" '
                   f'fill="{core.hexed(core.shade(a, -0.25))}"/>'
                   f'<ellipse cx="{f.w * 0.86:.0f}" cy="{f.h * 0.88:.0f}" '
                   f'rx="{f.w * 0.26:.0f}" ry="{f.h * 0.26:.0f}" '
                   f'fill="{core.hexed(core.shade(b, -0.45))}"/></g>')
    if "overprint" in p.decor:
        acc = p.accents[1 % len(p.accents)]
        out.append(core.rect(f.w - 300, 30, 300 - f.m + 46, 146, fill=acc, opacity=0.15))
        out.append(core.rect(f.m - 34, f.h - 330, 224, 180, fill=p.accents[0], opacity=0.10))
    if "ticks" in p.decor:
        ink, acc = p.muted, p.accents[0]
        for (x, y, dx, dy) in ((26, 26, 1, 1), (f.w - 26, 26, -1, 1),
                               (26, f.h - 26, 1, -1), (f.w - 26, f.h - 26, -1, -1)):
            out += [core.line(x, y, x + 26 * dx, y, ink, 1, 0.65),
                    core.line(x, y, x, y + 26 * dy, ink, 1, 0.65),
                    core.line(x, y, x + 9 * dx, y, acc, 3)]
    if "hard-border" in p.decor:
        out.append(core.rect(4, 4, f.w - 8, f.h - 8, fill=None, stroke=p.ink, sw=8))
    if "halftone" in p.decor:
        out.append(core.rect(f.w - f.m - 196, f.h - 176, 196, 132, fill="url(#dot)"))
    if "scanlines" in p.decor:
        out.append(core.rect(0, 0, f.w, f.h, fill="url(#scan)"))
    if "tape" in p.decor:
        for (cx, cy, angle) in ((f.m + 140, 108, 12), (f.w - f.m - 150, f.h - 128, -9)):
            out.append(f'<g transform="rotate({angle} {cx} {cy})">'
                       f'{core.rect(cx - 75, cy - 22, 150, 44, fill="url(#tape)")}</g>')
    return out


def render(graphic: Any, template: str = "infographic", preset: Optional[str] = None,
           *, orientation: Any = "landscape", detail: str = "standard",
           width: Optional[int] = None, height: Optional[int] = None,
           theme: Optional[Dict[str, Any]] = None, responsive: bool = False,
           inline: bool = False, desc: str = "") -> str:
    """Render one graphic to SVG source.

    Args:
        graphic: the payload — `title`, `stats[{value,label,detail}]`,
            `quotes[{text,source}]`, `takeaway`, plus template-specific keys
            (`events`, `steps`, `left`/`right`).
        template: one of `templates.TEMPLATES`; unknown names fall back.
        preset: a theme id (`sections`, `blueprint`, `cartoon`, `realistic`, …).
        orientation: `landscape` | `portrait` | `square` | any key of ORIENTATIONS.
        detail: `concise` | `standard` | `detailed` — caps how many items are drawn.
        theme: colour overrides applied on top of the preset
            (`{"paper": "#0b0b0f", "accent": "#5eead4"}`).
        responsive: emit viewBox + 100% width instead of fixed pixels.
        inline: drop the XML prolog (for embedding in HTML or a data URL).
        desc: accessible description; a summary is generated when empty.
    """
    g = normalise_graphic(graphic)
    # the preset resolves first: "auto" means "the composition this look reaches for"
    p = _themed(resolve_preset(preset or DEFAULT_PRESET), theme)
    requested = (template or "auto").strip().lower()
    # "auto" is the measured block composer; a preset's default_template is what
    # an explicit template name (or a non-infographic kind) still reaches for.
    if requested in ("", "auto", "default"):
        requested = "auto"
    tpl_name = requested if requested in templates.TEMPLATES or requested == "auto" \
        else "infographic"
    detail = detail if detail in DETAIL_LEVELS else "standard"

    w, h = canvas_for(orientation, width, height)
    f = templates.Frame(w, h)
    title_id, desc_id = "gfx-title", "gfx-desc"

    body = _background(f, p, tpl_name) + _decor(f, p)
    if tpl_name == "auto":
        from . import compose
        els, band_y, band_h = compose.compose(f, p, g, detail)
    else:
        els, band_y, band_h = templates.TEMPLATES[tpl_name](f, p, g, detail)
    body += els
    if band_h:
        body += templates.takeaway(f, p, str(g.get("takeaway") or ""), band_y)

    title = g.get("title") or p.label
    description = desc or _describe(g, p, tpl_name)
    prolog = "" if inline else '<?xml version="1.0" encoding="UTF-8"?>'
    return (
        f'{prolog}<svg xmlns="http://www.w3.org/2000/svg" '
        f'{"viewBox" if False else ""}{core.svg_size_attrs(w, h, responsive)} '
        f'role="img" aria-labelledby="{title_id} {desc_id}" '
        f'data-template="{tpl_name}" data-preset="{p.id}" '
        f'data-detail="{detail}">'
        f'<title id="{title_id}">{core.util_escape(title)}</title>'
        f'<desc id="{desc_id}">{core.util_escape(description)}</desc>'
        f'<defs>{"".join(_defs(f, p))}</defs>'
        f'{"".join(body)}</svg>'
    )


def _describe(g: Dict[str, Any], p: Preset, tpl: str) -> str:
    """A short text alternative that says what the picture contains."""
    bits = [f"{p.label} {tpl.replace('_', ' ')}"]
    if g.get("title"):
        bits.append(f"titled “{g['title']}”")
    stats = g.get("stats") or []
    if stats:
        sample = "; ".join(f"{s['value']} {s['label']}" for s in stats[:3])
        bits.append(f"showing {len(stats)} figures ({sample})")
    if g.get("takeaway"):
        bits.append(f"takeaway: {g['takeaway']}")
    return ". ".join(bits) + "."


def render_html(graphic: Any, **kwargs: Any) -> str:
    """A responsive, self-contained HTML page around the SVG — for iframes, docs and
    anywhere an `<img>` is not enough (links, selection, screen readers)."""
    svg = render(graphic, responsive=True, inline=True, **kwargs)
    g = normalise_graphic(graphic)
    title = g.get("title") or "Graphic"
    alt = _describe(g, resolve_preset(kwargs.get("preset") or DEFAULT_PRESET),
                    kwargs.get("template", "infographic"))
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f'<title>{core.util_escape(title)}</title>'
        '<style>html,body{margin:0;background:#101216;color:#e8eaee;'
        'font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:24px}'
        '.stage{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px #0006}'
        '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}'
        '@media (prefers-color-scheme:light){html,body{background:#f6f7f9;color:#1b1d22}}'
        '</style></head><body><main>'
        f'<div class="stage">{svg}</div>'
        f'<p class="sr">{core.util_escape(alt)}</p>'
        '</main></body></html>'
    )


def write_svg(path: Any, graphic: Any, **kwargs: Any) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(graphic, **kwargs), encoding="utf-8")
    return out


def write_html(path: Any, graphic: Any, **kwargs: Any) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_html(graphic, **kwargs), encoding="utf-8")
    return out


def data_url(graphic: Any, **kwargs: Any) -> str:
    """`data:image/svg+xml;base64,…` — kilobytes, crisp at any size."""
    raw = render(graphic, inline=False, **kwargs).encode("utf-8")
    return "data:image/svg+xml;base64," + base64.b64encode(raw).decode("ascii")


#: Where a raster is genuinely required (a slide deck, a chat preview, a print
#: shop), rasterise the SVG rather than redrawing it. Chrome/Chromium is the only
#: dependency; when it is missing, callers get a clear error and can fall back to
#: `gfx.to_png_pillow` / `igrender.render` (the Pillow renderer).
_CHROME_CANDIDATES = ("google-chrome", "chromium", "chromium-browser",
                      "/usr/bin/google-chrome", "/usr/bin/chromium")


def chrome_path() -> Optional[str]:
    for cand in _CHROME_CANDIDATES:
        if os.path.sep in cand:
            if Path(cand).exists():
                return cand
        else:
            from shutil import which
            hit = which(cand)
            if hit:
                return hit
    # playwright/hermes-managed chromium — same binary, different parking spot
    import glob
    home = str(Path.home())
    for pat in (f"{home}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome",
                    f"{home}/.cache/ms-playwright/chromium_headless_shell-*/chrome-linux*/headless_shell",
                    f"{home}/.hermes/tools/chromium-*/chrome-linux*/chrome"):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None


def to_png(graphic: Any, path: Any, *, scale: float = 1.0, **kwargs: Any) -> Path:
    """Rasterise a render through headless Chrome. Raises RuntimeError when no
    browser is installed — callers should catch that and use the Pillow path."""
    browser = chrome_path()
    if not browser:
        raise RuntimeError("no Chrome/Chromium available to rasterise the SVG")
    w, h = canvas_for(kwargs.get("orientation", "landscape"),
                      kwargs.get("width"), kwargs.get("height"))
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        html = Path(tmp) / "g.html"
        html.write_text(
            "<!doctype html><meta charset=utf-8>"
            f"<style>html,body{{margin:0}}svg{{display:block}}</style>"
            + render(graphic, inline=True, responsive=False, **kwargs),
            encoding="utf-8")
        # --window-size is in CSS pixels and --force-device-scale-factor multiplies
        # it into device pixels. Multiplying BOTH (the old code did) asked Chrome
        # for a 2400x1800 CSS viewport at 2x and photographed the 4800x3600
        # result: the 1200x900 document painted only its top-left quarter, at
        # exactly half size in each axis. scale=1 hid the bug because 1 is
        # identity; every scale>1 request was broken.
        cmd = [browser, "--headless=new", "--no-sandbox", "--disable-gpu",
               "--hide-scrollbars", "--virtual-time-budget=4000",
               f"--force-device-scale-factor={scale}",
               f"--window-size={int(w)},{int(h)}",
               f"--screenshot={out}", html.as_uri()]
        proc = subprocess.run(cmd, capture_output=True, timeout=120)
        if proc.returncode != 0 or not out.exists():
            raise RuntimeError(f"chrome failed to rasterise: {proc.stderr[-400:]!r}")
    return out


def to_png_pillow(graphic: Any, path: Any, preset: Optional[str] = None,
                  **kwargs: Any) -> Path:
    """Fallback raster: the Pillow renderer from the infographic pack. Same catalog,
    same payload, so a box without a browser still produces a PNG."""
    from .. import igrender          # local import: optional path
    g = normalise_graphic(graphic)
    img = igrender.render(g, g.get("title") or "Infographic", preset or DEFAULT_PRESET)
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")
    return out


def library_manifest() -> Dict[str, Any]:
    """Machine-readable inventory: templates, presets, orientations, detail levels.
    Host apps read this to build a picker without hard-coding our names."""
    return {
        "templates": sorted(templates.TEMPLATES),
        "presets": list(BY_ID.values()) and [p.as_dict() for p in BY_ID.values()],
        "orientations": {k: list(v) for k, v in ORIENTATIONS.items()},
        "detail": list(DETAIL_LEVELS),
        "template_presets": templates.TEMPLATE_PRESETS,
        "version": 1,
    }
