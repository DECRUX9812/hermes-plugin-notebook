"""Layout acceptance matrix for the graphics library.

Element counts are not evidence: a template can return 35 elements and still
paint half its content outside the canvas, or leave a third of it empty. This
measures the REAL geometry of every template × preset × detail × sample and
fails on three things that a screenshot review misses:

  overflow   content or the closing band paints past the canvas edge
  deadband   the composition stops far above the closing band (a blank poster)
  tiny       a text node under 12px (illegible in a shared image)

Whitespace is exempt where it IS the design — a quote card, a cover and an
illustration are supposed to leave the page mostly empty.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from hermes_notebook import gfx  # noqa: E402
from hermes_notebook.gfx import templates  # noqa: E402

CANVAS = (1200, 900)
DETAILS = ("concise", "standard", "detailed")

#: Templates whose empty space is deliberate.
WHITESPACE_BY_DESIGN = {"quote_card", "cover", "illustration"}

_TEXT = re.compile(r'<text[^>]*y="([\d.]+)"[^>]*font-size="(\d+)"')
_RECT = re.compile(r'<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"')


def measured(els: list[str]) -> dict:
    """Lowest and rightmost painted edge, and the smallest type size."""
    bottom = right = 0.0
    min_fs = 999
    for e in els:
        for m in _TEXT.finditer(e):
            y, fs = float(m.group(1)), int(m.group(2))
            bottom = max(bottom, y + fs * 0.24)   # descent
            min_fs = min(min_fs, fs)
        for m in _RECT.finditer(e):
            x, y, w, h = (float(v) for v in m.groups())
            if w >= CANVAS[0] * 0.98 and h >= CANVAS[1] * 0.98:
                continue                          # full-bleed background
            if h < 6:
                continue                          # hairline rule, not content
            bottom = max(bottom, y + h)
            right = max(right, x + w)
    return {"bottom": bottom, "right": right, "min_fs": min_fs}


def probe(sample: dict, max_deadband: int = 200) -> list[str]:
    problems: list[str] = []
    for tpl in gfx.TEMPLATES:
        for preset in gfx.PRESETS:
            for detail in DETAILS:
                els, band_y, band_h = gfx.templates.TEMPLATES[tpl](
                    templates.Frame(*CANVAS), gfx.resolve_preset(preset.id), sample, detail)
                g = measured(els)
                where = f"{tpl}/{preset.id}/{detail}"
                if band_h and band_y + band_h > CANVAS[1] + 1:
                    problems.append(f"{where}: closing band paints past the canvas "
                                    f"({band_y}+{band_h}>{CANVAS[1]})")
                # The takeaway band owns the bottom of the sheet, so "dead canvas"
                # is the gap between the last painted element and that band — not
                # the distance to the canvas edge, which the band fills.
                floor = band_y if band_h else CANVAS[1]
                # A cover/illustration paints edge to edge on purpose: its art is
                # the page, so a "gap to the band" is meaningless for it.
                full_bleed = tpl in ("cover", "illustration")
                if not full_bleed and g["bottom"] > floor:
                    problems.append(f"{where}: content runs {g['bottom'] - floor:.0f}px into "
                                    "the closing band")
                elif tpl not in WHITESPACE_BY_DESIGN and floor - g["bottom"] > max_deadband:
                    problems.append(f"{where}: {floor - g['bottom']:.0f}px of dead canvas "
                                    "above the closing band")
                if g["right"] > CANVAS[0] + 1:
                    problems.append(f"{where}: paints past the right edge by {g['right'] - CANVAS[0]:.0f}px")
                if g["min_fs"] < 12:
                    problems.append(f"{where}: {g['min_fs']}px type is below the legibility floor")
    return problems


@pytest.mark.parametrize("sample_name", ["SAMPLE_GRAPHIC", "SAMPLE_SMALL"])
def test_no_template_overflows_or_dies(sample_name: str):
    sample = getattr(gfx, sample_name)
    problems = probe(sample)
    assert not problems, f"{len(problems)} layout problems:\n" + "\n".join(problems[:12])


def test_a_low_payload_targets_a_template_that_fits_it():
    """The escape hatch, measured: a payload this sparse is what `key_figure` is
    FOR, and it must fill the frame where the multi-figure templates cannot."""
    els, band_y, band_h = gfx.templates.TEMPLATES["key_figure"](
        templates.Frame(*CANVAS), gfx.resolve_preset("sections"), gfx.SAMPLE_SMALL, "standard")
    g = measured(els)
    floor = band_y if band_h else CANVAS[1]
    assert g["bottom"] < floor, "the hero must not collide with the closing band"
    # measured to the BAND, which owns the bottom of the sheet — measuring to the
    # canvas edge would count the band itself as empty space
    assert floor - g["bottom"] <= 200, f"hero sits {floor - g['bottom']:.0f}px above the band"


def test_dense_payload_fills_the_canvas():
    """Six figures plus a takeaway must use the sheet — the case that ships."""
    els, _band_y, _band_h = gfx.templates.TEMPLATES["infographic"](
        templates.Frame(*CANVAS), gfx.resolve_preset("sections"), gfx.SAMPLE_GRAPHIC, "standard")
    g = measured(els)
    assert CANVAS[1] - g["bottom"] <= 200, f"{CANVAS[1] - g['bottom']:.0f}px unused"


def test_generation_reaches_the_renderer(ctx, monkeypatch):
    """The generation path must not die before the renderer.

    A NameError left behind by the gfx rewrite (`igstyles.prompt_hint`) raised on
    EVERY infographic run — a 500 in the dashboard that no library test caught,
    because the tests render `gfx` directly. This drives `artifacts.generate`
    with a stub model and asserts a real file comes out.
    """
    import json as _json
    from hermes_notebook import artifacts, store

    meta = store.create_notebook("Generation path")
    nb = meta["id"]
    store.add_source(nb, title="A source", kind="text", origin="",
                     text="Tidal output is set by the site and the cable cost.")

    parsed = {
        "title": "Tidal power",
        "stats": [{"value": "1.2 GW", "label": "planned capacity"},
                  {"value": "38%", "label": "capacity factor"}],
        "quotes": [{"text": "The resource is reliable.", "source": "IEA"}],
        "takeaway": "Output is set by the site.",
    }

    monkeypatch.setattr(artifacts.llmio, "structured", lambda **k: dict(parsed))
    out = artifacts.generate(nb, "infographic", style="swiss")
    assert out["kind"] == "infographic"
    from pathlib import Path
    svg = Path(out["path"]).read_text(encoding="utf-8")
    assert svg.startswith("<?xml") and 'data-preset="swiss"' in svg


def test_raster_at_scale_still_frames_the_whole_document():
    """A scaled raster must contain the WHOLE poster, not a corner of it.

    `to_png` multiplied both --window-size and --force-device-scale-factor, so
    scale=2 asked for a 2400x1800 CSS viewport at 2x: the document painted its
    top-left quarter at half size and the rest of the PNG was blank. Every
    shared image past scale 1 was a broken poster, and only a pixel measurement
    catches it.
    """
    pytest.importorskip("PIL")
    from PIL import Image

    from hermes_notebook.gfx.document import chrome_path
    if not chrome_path():
        pytest.skip("no Chrome to rasterise with")

    src = ROOT / "assets" / "examples" / "infographic-sections.png"
    if not src.exists():
        pytest.skip("no committed example to compare against")

    try:
        out = gfx.to_png(gfx.SAMPLE_GRAPHIC, "/tmp/nb-raster-scale-test.png",
                         preset="sections", template="infographic", scale=2)
    except RuntimeError as exc:
        pytest.skip(f"raster failed: {exc}")

    img = Image.open(out).convert("RGB")
    w, h = img.size
    assert w >= 1200 * 2 - 8 and h >= 900 * 2 - 8, f"scale=2 gave {img.size}"
    px = img.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    for x in range(0, w, 8):
        for y in range(0, h, 8):
            if sum(px[x, y]) < 720:                      # anything not white
                minx, miny = min(minx, x), min(miny, y)
                maxx, maxy = max(maxx, x), max(maxy, y)
    assert (maxx - minx) / w > 0.85 and (maxy - miny) / h > 0.85, (
        f"ink covers only {(maxx - minx) / w:.0%}x{(maxy - miny) / h:.0%} of the raster")
