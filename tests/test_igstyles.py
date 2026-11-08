"""The bundled infographic style pack: catalog integrity, and every style draws.

These are the guarantees the page and the tools depend on:

* the catalog is consistent (unique ids, real families, valid hex swatches);
* an unknown or alias name never fails a generation run;
* all sixteen looks render a full 1200x900 sheet, in the tone they claim;
* the looks are actually different from each other on the same payload;
* degenerate payloads (huge title, no quotes, no takeaway) still draw.
"""

import re

import pytest

from hermes_notebook import artifacts, igrender, igstyles

HEX = re.compile(r"^#[0-9a-f]{6}$")

SAMPLE = {
    "title": "Tidal power — the three facts that decide a project",
    "takeaway": "Output is set by the site, the cost by the cable, and the "
                "schedule by the consent — in that order.",
    "stats": [
        {"value": "1.2 GW", "label": "planned capacity", "detail": "at the best site"},
        {"value": "38%", "label": "capacity factor", "detail": "measured over 4 years"},
        {"value": "£1.4bn", "label": "cable cost", "detail": "two-thirds of capex"},
        {"value": "11 yrs", "label": "consent timeline", "detail": "median for tidal"},
        {"value": "24", "label": "turbines", "detail": "in the first array"},
        {"value": "60 m", "label": "mean depth", "detail": "at the sill"},
    ],
    "quotes": [
        {"text": "The resource is reliable; the grid connection is what sinks projects.",
         "source": "IEA Marine"},
        {"text": "Consenting takes longer than construction on every project reviewed.",
         "source": "Offshore Review"},
    ],
}


# ------------------------------------------------------------------- catalog

def test_catalog_is_consistent():
    styles = igstyles.STYLES
    assert len(styles) >= 12, "the pack should offer a real spread of looks"
    ids = [s.id for s in styles]
    assert len(set(ids)) == len(ids), "style ids must be unique"
    assert igstyles.DEFAULT_STYLE in ids
    for s in styles:
        assert s.family in igstyles.FAMILIES, f"{s.id}: unknown family {s.family}"
        assert s.typeface in ("sans", "serif", "mono"), s.id
        assert s.label and s.blurb and s.best_for, s.id
        for deco in s.decor:
            assert deco in igstyles.DECOR, f"{s.id}: unknown decoration {deco}"
        for hexv in s.hexes():
            assert HEX.match(hexv), f"{s.id}: bad swatch {hexv}"


def test_catalog_reaches_both_tones_and_layouts():
    families = {s.family for s in igstyles.STYLES}
    assert families == set(igstyles.FAMILIES), "every layout family must be offered"
    tones = {s.tone for s in igstyles.STYLES}
    assert tones == {"light", "dark"}


def test_aliases_point_at_real_styles():
    for alias, target in igstyles.ALIASES.items():
        assert target in igstyles.BY_ID, f"alias {alias} -> missing {target}"


def test_common_names_resolve():
    assert igstyles.resolve("").id == igstyles.DEFAULT_STYLE
    assert igstyles.resolve("not-a-style").id == igstyles.DEFAULT_STYLE
    assert igstyles.resolve("Dark").id == "poster"
    assert igstyles.resolve("neo_brutalist").id == "brutalist"
    assert igstyles.resolve("cyberpunk").id == "neon"
    assert igstyles.resolve("sections").id == "sections"
    assert not igstyles.is_known("nope")
    assert igstyles.is_known("bento")


def test_catalog_payload_shape_matches_the_page():
    row = igstyles.catalog()[0]
    assert set(row) >= {"id", "label", "blurb", "family", "swatch", "tone"}
    assert len(row["swatch"]) >= 3


def test_prompt_hint_is_per_family():
    hints = {fam: igstyles.prompt_hint(next(s for s in igstyles.STYLES
                                           if s.family == fam))
             for fam in igstyles.FAMILIES}
    assert all(hints.values())
    assert len(set(hints.values())) == len(hints), "hints must differ per family"


# ------------------------------------------------------------------ rendering

@pytest.mark.parametrize("style", igstyles.ids())
def test_every_style_renders(style):
    pytest.importorskip("PIL")
    img = igrender.render(SAMPLE, "Tidal power", style)
    assert img.size == (1200, 900)
    assert img.mode == "RGB"
    # a drawn sheet has real tonal range; a blank one collapses to a few pixels
    assert len(img.getcolors(maxcolors=1 << 20) or []) > 200


def test_unknown_style_renders_the_default():
    pytest.importorskip("PIL")
    a = igrender.render(SAMPLE, "T", "does-not-exist")
    b = igrender.render(SAMPLE, "T", igstyles.DEFAULT_STYLE)
    assert a.size == b.size == (1200, 900)


def test_styles_look_different_from_each_other():
    """Two styles that render identically mean one of them is not wired up."""
    pytest.importorskip("PIL")
    seen = {}
    for style in igstyles.ids():
        img = igrender.render(SAMPLE, "T", style).resize((60, 45))
        seen[style] = img.tobytes()
    assert len(set(seen.values())) == len(seen), "duplicate renders across styles"


def test_dark_styles_are_dark_and_light_styles_are_light():
    pytest.importorskip("PIL")
    from PIL import ImageStat
    for style in igstyles.STYLES:
        img = igrender.render(SAMPLE, "T", style.id)
        mean = ImageStat.Stat(img.convert("L").resize((40, 30))).mean[0]
        if style.tone == "dark":
            assert mean < 110, f"{style.id} claims dark but averages {mean:.0f}"
        else:
            assert mean > 150, f"{style.id} claims light but averages {mean:.0f}"


def test_thin_payloads_still_draw():
    pytest.importorskip("PIL")
    thin = {"title": "Only a title", "stats": [], "quotes": [], "takeaway": ""}
    for style in igstyles.ids():
        img = igrender.render(thin, "Only a title", style)
        assert img.size == (1200, 900)


def test_overlong_payload_does_not_raise():
    pytest.importorskip("PIL")
    heavy = {
        "title": "A title that is far too long to fit on two lines of a poster and "
                 "keeps going well past the edge of any reasonable headline",
        "takeaway": "A takeaway sentence that is also far too long to sit on two "
                    "lines comfortably, which is exactly the case the layout has to "
                    "survive without clipping anything at all.",
        "stats": [{"value": "123456789012", "label": "a very long label that should "
                                                    "wrap inside its tile",
                   "detail": "and a long detail line that should be dropped if it "
                             "does not fit"} for _ in range(6)],
        "quotes": [{"text": "A fact " * 40, "source": "A source with a long name"}],
    }
    for style in igstyles.ids():
        img = igrender.render(heavy, "T", style)
        assert img.size == (1200, 900)


def test_thumbnail_is_a_quarter_scale():
    pytest.importorskip("PIL")
    thumb = igrender.render_thumb(SAMPLE, "T", "bento")
    assert thumb.size == (300, 225)


# --------------------------------------------------------------- integration

def test_artifacts_renderer_returns_vector_source():
    pytest.importorskip("PIL")
    svg = artifacts._render_infographic(SAMPLE, "T", style="blueprint")
    assert isinstance(svg, str) and svg.lstrip().startswith("<?xml")
    assert 'viewBox="0 0 1200 900"' in svg
    assert 'data-preset="blueprint"' in svg


def test_legacy_style_names_still_work():
    pytest.importorskip("PIL")
    for name in ("sections", "poster", "editorial", ""):
        svg = artifacts._render_infographic(SAMPLE, "T", style=name)
        assert 'viewBox="0 0 1200 900"' in svg


def test_raster_fallback_still_available():
    """A box with no browser still gets a PNG from the same catalog."""
    pytest.importorskip("PIL")
    img = artifacts._raster_infographic(SAMPLE, "T", style="sections")
    assert img.size == (1200, 900)


def test_page_option_lists_every_style():
    pytest.importorskip("PIL")
    pytest.importorskip("fastapi")
    from dashboard import plugin_api
    kinds = {k["id"]: k for k in plugin_api.KINDS}
    spec = kinds["infographic"]["options"][0]
    assert spec["kind"] == "select"
    from hermes_notebook import gfx
    assert spec["choices"] == [p.id for p in gfx.PRESETS]
    assert [i["id"] for i in spec["items"]] == [p.id for p in gfx.PRESETS]
    assert all(i["swatch"] for i in spec["items"])


def test_tool_schema_offers_every_style():
    from hermes_notebook import gfx, schemas
    enum = schemas.NOTEBOOK_GENERATE["parameters"]["properties"]["style"]["enum"]
    assert enum == [p.id for p in gfx.PRESETS]
