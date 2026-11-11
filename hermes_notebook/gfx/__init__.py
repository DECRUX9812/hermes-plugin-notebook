"""gfx — a reusable HTML/SVG graphics library.

Compose NotebookLM-class visuals from primitives, layouts, themes and templates
instead of hand-building one-off art.

Quick start::

    from hermes_notebook import gfx

    svg = gfx.render(
        {"title": "Tidal power", "stats": [...], "quotes": [...],
         "takeaway": "Output is set by the site."},
        template="infographic", preset="blueprint", orientation="portrait")

    gfx.write_svg("poster.svg", graphic, preset="cartoon", template="cover")
    html = gfx.render_html(graphic, preset="realistic", template="key_figure")
    gfx.to_png(graphic, "poster.png", preset="neon", scale=2)   # needs Chrome

Public surface:

* `render` / `render_html` / `write_svg` / `write_html` / `data_url` — output;
* `to_png` / `to_png_pillow` — raster fallbacks;
* `PRESETS` / `resolve_preset` / `preset_catalog` — the looks;
* `TEMPLATES` / `TEMPLATE_PRESETS` — the compositions;
* `ORIENTATIONS` / `DETAIL_LEVELS` / `library_manifest` — the controls a host app
  needs to build a picker without hard-coding our names;
* `Frame`, `core`, `illustrate`, `templates`, `themes` — the extension points.
"""

from __future__ import annotations

from .document import (DETAIL_LEVELS, ORIENTATIONS, canvas_for, chrome_path, data_url,
                       library_manifest, normalise_graphic, render, render_html, svg_to_png,
                       to_png, to_png_pillow, write_html, write_svg)
from .samples import SAMPLE_GRAPHIC, SAMPLE_SMALL
from .themes import (ART, ALIASES, BY_ID, DEFAULT_PRESET, FAMILIES, PRESETS, Preset,
                     catalog as preset_catalog, house_presets, is_known as preset_known,
                     of_family, resolve as resolve_preset, with_art)
from .templates import (Frame, TEMPLATE_PRESETS, TEMPLATES, facts_block, header,
                        takeaway, takeaway_measure, tile)
from . import blueprint, core, illustrate, isometrics, samples, templates, themes
from . import blocks, charts, compose, icons

__all__ = [
    "render", "render_html", "write_svg", "write_html", "data_url",
    "to_png", "to_png_pillow", "svg_to_png", "chrome_path",
    "PRESETS", "BY_ID", "Preset", "resolve_preset", "preset_catalog", "preset_known",
    "house_presets", "of_family", "with_art", "DEFAULT_PRESET", "ALIASES", "ART", "FAMILIES",
    "TEMPLATES", "TEMPLATE_PRESETS", "Frame", "header", "takeaway", "takeaway_measure",
    "facts_block", "tile",
    "ORIENTATIONS", "DETAIL_LEVELS", "canvas_for", "library_manifest", "normalise_graphic",
    "core", "illustrate", "isometrics", "blueprint", "samples", "templates", "themes",
    "blocks", "charts", "compose", "icons",
    "SAMPLE_GRAPHIC", "SAMPLE_SMALL",
]

__version__ = "1.0.0"
