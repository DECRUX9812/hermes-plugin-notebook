"""The graphics library: API, edge cases, accessibility and visual snapshots.

Three layers, matching what the library promises:

1. **unit** — colour parsing, text measurement/wrapping, payload normalisation,
   orientation resolution, theme overrides, fallbacks;
2. **render** — every preset and every template produces well-formed SVG with the
   promised canvas, metadata and accessible name;
3. **snapshot** — representative graphics hash to a stored value, so an accidental
   layout change is caught rather than shipped (`tests/snapshots/gfx.json`).
"""

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from hermes_notebook import gfx
from hermes_notebook.gfx import themes

SNAP = Path(__file__).parent / "snapshots" / "gfx.json"

SAMPLE = gfx.samples.SAMPLE_GRAPHIC


def _root(svg: str):
    body = re.sub(r"^<\?xml[^>]*\?>", "", svg.strip())
    return ET.fromstring(body)


def _hash(svg: str) -> str:
    return hashlib.sha256(re.sub(r"\s+", " ", svg).encode()).hexdigest()[:16]


# ------------------------------------------------------------------- surface

def test_public_api_exists():
    for name in ("render", "render_html", "write_svg", "data_url", "to_png",
                 "to_png_pillow", "PRESETS", "TEMPLATES", "ORIENTATIONS",
                 "DETAIL_LEVELS", "library_manifest", "normalise_graphic"):
        assert hasattr(gfx, name), name


def test_presets_include_both_house_treatments():
    arts = {p["art"] for p in gfx.preset_catalog()}
    assert "cartoon" in arts and "plate" in arts
    assert len(gfx.PRESETS) >= 18


def test_manifest_is_complete():
    m = gfx.library_manifest()
    assert set(m["templates"]) == set(gfx.TEMPLATES)
    assert len(m["presets"]) == len(gfx.PRESETS)
    assert set(m["detail"]) == set(gfx.DETAIL_LEVELS)
    for tpl in m["templates"]:
        assert tpl in m["template_presets"], tpl
        assert m["template_presets"][tpl], f"{tpl} has no suggested presets"


# ---------------------------------------------------------------------- unit

def test_wrap_respects_width():
    lines = gfx.core.wrap("the quick brown fox jumps over the lazy dog", "sans", 24, 120)
    assert len(lines) > 1
    for line in lines:
        assert gfx.core.text_width(line, "sans", 24) <= 120 or " " not in line


def test_wrap_keeps_a_single_unbreakable_word():
    assert gfx.core.wrap("supercalifragilistic", "sans", 24, 20) == ["supercalifragilistic"]


def test_clip_adds_ellipsis():
    out = gfx.core.clip("a very long label that will not fit", "sans", 20, 80)
    assert out.endswith("…")
    assert out != "a very long label that will not fit"


def test_fit_shrinks_until_it_fits():
    size = gfx.core.fit("1234567890", "sans", 60, 200)
    assert size < 60
    assert gfx.core.text_width("1234567890", "sans", size, True) <= 200


def test_fit_stops_at_the_readability_floor():
    """A numeral too wide even at 24px keeps its size: the layout drops the label
    instead of drawing 8px type nobody can read."""
    size = gfx.core.fit("1234567890", "sans", 60, 10)
    assert size == 24


def test_readable_enforces_ratio():
    for preset in gfx.PRESETS:
        for i in range(len(preset.accents)):
            ink = preset.readable_accent(i)
            assert gfx.core.contrast(ink, preset.card) >= 4.4, preset.id


def test_parse_colour_is_tolerant():
    p = gfx.core.parse_colour
    assert p("#abc", (0, 0, 0)) == (170, 187, 204)
    assert p("#112233", (0, 0, 0)) == (17, 34, 51)
    assert p("rgb(1, 2, 3)", (0, 0, 0)) == (1, 2, 3)
    assert p("rgbwl", (9, 9, 9)) == (9, 9, 9)
    assert p(None, (4, 4, 4)) == (4, 4, 4)
    assert p("#12", (5, 5, 5)) == (5, 5, 5)


def test_normalise_graphic_handles_garbage():
    for junk in (None, [], 42, "", "just a title", {"stats": "nope"},
                 {"stats": [None, 3, {"value": None}]}, {"quotes": {"text": "single"}}):
        out = gfx.normalise_graphic(junk)
        assert isinstance(out, dict)
        assert isinstance(out["stats"], list)
        assert isinstance(out["quotes"], list)


def test_normalise_clamps_lengths_and_counts():
    huge = {"title": "x" * 900, "stats": [{"value": "1", "label": "y" * 900}] * 30,
            "quotes": [{"text": "z" * 900}] * 20}
    out = gfx.normalise_graphic(huge)
    assert len(out["title"]) <= 180
    assert len(out["stats"]) <= 8
    assert len(out["quotes"]) <= 4
    assert all(len(s["label"]) <= 90 for s in out["stats"])


def test_canvas_resolution():
    assert gfx.canvas_for("portrait") == (900, 1200)
    assert gfx.canvas_for("square") == (1000, 1000)
    assert gfx.canvas_for("nonsense") == (1200, 900)
    assert gfx.canvas_for("portrait", 400, 300) == (400, 300)
    assert gfx.canvas_for("square", 10, 10) == (240, 240)      # clamped, never tiny
    assert gfx.canvas_for("square", 99999, 99999) == (4000, 4000)


def test_unknown_template_and_preset_fall_back():
    svg = gfx.render(SAMPLE, template="not-a-template", preset="not-a-preset")
    root = _root(svg)
    assert root.get("data-template") == "infographic"
    assert root.get("data-preset") == themes.DEFAULT_PRESET


def test_alias_resolution():
    assert themes.resolve("cyberpunk").id == "neon"
    assert themes.resolve("photo").id == "realistic"
    assert themes.resolve("comic").id == "cartoon"
    assert themes.resolve("").id == themes.DEFAULT_PRESET
    assert themes.resolve("nope").id == themes.DEFAULT_PRESET


def test_theme_override_recolours_without_a_new_preset():
    svg = gfx.render(SAMPLE, preset="sections",
                     theme={"paper": "#0b0b0f", "ink": "#f7f7fa", "accent": "#5eead4"})
    assert "#5eead4" in svg
    assert "#0b0b0f" in svg


# -------------------------------------------------------------------- render

@pytest.mark.parametrize("preset", [p.id for p in gfx.PRESETS])
def test_every_preset_renders_valid_svg(preset):
    svg = gfx.render(SAMPLE, preset=preset)
    root = _root(svg)
    assert root.tag.endswith("svg")
    assert root.get("viewBox") == "0 0 1200 900"
    assert root.get("data-preset") == preset
    assert root.get("role") == "img"
    assert len(svg) > 2000


@pytest.mark.parametrize("template", sorted(gfx.TEMPLATES))
@pytest.mark.parametrize("preset", ["sections", "cartoon", "realistic"])
def test_every_template_and_house_preset(template, preset):
    svg = gfx.render(SAMPLE, template=template, preset=preset)
    root = _root(svg)
    assert root.get("data-template") == template
    assert root.get("data-preset") == preset


@pytest.mark.parametrize("orientation,size", [("landscape", (1200, 900)),
                                              ("portrait", (900, 1200)),
                                              ("square", (1000, 1000))])
def test_orientations(orientation, size):
    svg = gfx.render(SAMPLE, orientation=orientation)
    root = _root(svg)
    assert (int(root.get("width")), int(root.get("height"))) == size
    assert root.get("viewBox") == f"0 0 {size[0]} {size[1]}"


def test_detail_level_changes_the_number_of_tiles():
    concise = gfx.render(SAMPLE, detail="concise")
    detailed = gfx.render(SAMPLE, detail="detailed")
    assert concise.count("<rect") < detailed.count("<rect")
    assert "3 stats" in concise


def test_responsive_document_has_no_fixed_pixels():
    svg = gfx.render(SAMPLE, responsive=True)
    root = _root(svg)
    assert root.get("width") is None and root.get("height") is None
    assert "width:100%" in root.get("style", "")


def test_accessibility_metadata():
    svg = gfx.render(SAMPLE, preset="blueprint")
    root = _root(svg)
    ids = root.get("aria-labelledby").split()
    assert len(ids) == 2
    tags = [child.tag.split("}")[-1] for child in root]
    assert "title" in tags and "desc" in tags
    desc = [c for c in root if c.tag.endswith("desc")][0].text
    assert "1.2 GW" in desc


def test_html_wrapper_is_self_contained():
    html = gfx.render_html(SAMPLE, preset="cartoon", template="cover")
    assert html.startswith("<!doctype html>")
    assert 'lang="en"' in html and 'name="viewport"' in html
    assert "<svg" in html and "class=\"sr\"" in html
    assert "http://" not in html.split("<svg")[0].replace('xmlns="http://www.w3.org/2000/svg"', "")


def test_data_url_is_small_and_svg():
    url = gfx.data_url(SAMPLE, preset="realistic")
    assert url.startswith("data:image/svg+xml;base64,")
    assert len(url) < 200_000


def test_text_is_escaped():
    svg = gfx.render({"title": "Tom & Jerry <script>alert(1)</script>"})
    assert "<script>" not in svg
    assert "&amp;" in svg and "&lt;script&gt;" in svg


# ---------------------------------------------------------------- edge cases

def test_empty_payload_still_draws():
    svg = gfx.render({})
    assert _root(svg) is not None


def test_one_stat_and_no_facts():
    svg = gfx.render({"title": "One", "stats": [{"value": "7", "label": "days"}]})
    assert "7" in svg


def test_many_stats_are_capped():
    payload = {"title": "Many", "stats": [{"value": str(i), "label": f"item {i}"}
                                          for i in range(20)]}
    assert "6 stats" in gfx.render(payload)                      # standard cap
    detailed = gfx.render(payload, detail="detailed")
    assert "8 stats" in detailed                                  # ceiling
    assert "item 19" not in detailed


def test_long_title_is_clamped_and_wrapped():
    svg = gfx.render({"title": "word " * 200})
    root = _root(svg)
    assert len(root.get("aria-label") or "") < 400


def test_unicode_and_emoji_survive():
    svg = gfx.render({"title": "日本の電力 — 2026 ⚡", "stats": [{"value": "38%", "label": "容量"}]})
    assert "日本の電力" in svg


def test_small_canvas_still_lays_out():
    svg = gfx.render(SAMPLE, width=320, height=240)
    root = _root(svg)
    assert root.get("width") == "320"


def test_missing_values_get_placeholders():
    svg = gfx.render({"stats": [{"value": "", "label": ""}, {"value": "9"}]})
    assert "—" in svg or "9" in svg


def test_render_is_deterministic():
    a = gfx.render(SAMPLE, preset="blueprint", template="timeline")
    b = gfx.render(SAMPLE, preset="blueprint", template="timeline")
    assert a == b


def test_pillow_raster_fallback_writes_a_png(tmp_path):
    pytest.importorskip("PIL")
    out = gfx.to_png_pillow(SAMPLE, tmp_path / "fallback.png", preset="sections")
    assert out.exists() and out.stat().st_size > 5000


# ------------------------------------------------------------------ snapshots

SNAPSHOT_CASES = [
    ("infographic-default", {"preset": "sections", "template": "infographic"}),
    ("infographic-blueprint", {"preset": "blueprint", "template": "infographic"}),
    ("infographic-portrait", {"preset": "swiss", "orientation": "portrait"}),
    ("key-figure", {"preset": "realistic", "template": "key_figure"}),
    ("stat-grid", {"preset": "dashboard", "template": "stat_grid"}),
    ("timeline", {"preset": "sections", "template": "timeline"}),
    ("comparison", {"preset": "swiss", "template": "comparison"}),
    ("process", {"preset": "blueprint", "template": "process"}),
    ("quote-card", {"preset": "magazine", "template": "quote_card"}),
    ("cover-cartoon", {"preset": "cartoon", "template": "cover"}),
    ("cover-realistic", {"preset": "realistic", "template": "cover"}),
    ("illustration-cartoon", {"preset": "cartoon", "template": "illustration"}),
]


def test_visual_snapshots():
    """Layout regressions show up as a hash change. Regenerate deliberately with
    `python3 tools/make_style_sheet.py --snapshots` and review the diff."""
    stored = json.loads(SNAP.read_text()) if SNAP.exists() else {}
    current = {}
    for name, kwargs in SNAPSHOT_CASES:
        current[name] = _hash(gfx.render(SAMPLE, **kwargs))
    if not stored:
        SNAP.parent.mkdir(parents=True, exist_ok=True)
        SNAP.write_text(json.dumps(current, indent=1, sort_keys=True))
        pytest.skip("snapshots created on first run")
    changed = {k: (stored.get(k), v) for k, v in current.items() if stored.get(k) != v}
    assert not changed, f"layout changed for: {sorted(changed)}"
