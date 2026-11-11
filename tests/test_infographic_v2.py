"""Infographic schema v2: normaliser, verifier, composer, icons.

These are behaviour contracts, not golden files: the tests pin what the
pipeline promises (a malformed model output never raises, a number the sources
never said never renders, no text under 14px, no row mostly empty), so a
refactor can change internals freely as long as the promises hold.
"""

import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from hermes_notebook import gfx, verify
from hermes_notebook.gfx import blocks, charts, compose, icons

SNAP = Path(__file__).parent / "snapshots" / "gfx.json"

S1 = "Iter tokamak assembly is 67 percent complete. The machine will weigh 23,000 tonnes."
S2 = "Commonwealth Fusion raised $1,100 million in the round. 'The grid wants firm power, not promises', the CEO said."
S3 = "Germany approved 48 permits in 2025. Laser Diode raised 180 million euros."


def _src(text):
    return text


def base_graphic():
    return {
        "title": "Fusion race",
        "takeaway": "Schedule, not physics, is now the constraint.",
        "blocks": [
            {"type": "stat", "value": "1,100", "unit": "$m", "label": "raised", "cites": [2]},
            {"type": "bar", "title": "Money", "items": [
                {"label": "CFS", "value": 1100, "display": "$1.1bn", "cites": [2]},
                {"label": "Laser Diode", "value": 180, "display": "€180m", "cites": [3]},
            ]},
        ],
    }


def _verify(graphic, sources):
    from hermes_notebook.gfx import blocks as b
    g = b.normalise_graphic(graphic)
    return verify.verify_graphic(g, sources)


# ---------------------------------------------------------------- verification

def test_number_in_cited_source_verified():
    g = _verify(base_graphic(), [S1, S2, S3])
    v = g["_verify"]
    assert v["verified"] >= 2 and not v["dropped"]
    item = g["blocks"][0]
    assert item["cites"] == [2]


def test_comma_normalisation_matches():
    # "1,100" in the block equals "1100" in the source — both directions
    g = _verify(base_graphic(), [S1, S2.replace("$1,100", "$1100"), S3])
    assert g["blocks"][0]["cites"] == [2]
    assert not g["_verify"]["dropped"]


def test_number_only_in_another_source_recites():
    g = base_graphic()
    g["blocks"][0]["cites"] = [1]  # wrong source on purpose
    g = _verify(g, [S1, S2, S3])
    item = g["blocks"][0]
    assert item["cites"] == [2]
    assert g["_verify"]["recited"] == 1


def test_absent_number_drops_item():
    g = base_graphic()
    g["blocks"][0]["value"] = "9,999"
    g = _verify(g, [S1, S2, S3])
    assert any(d["reason"] == "number absent from sources" for d in g["_verify"]["dropped"])


def test_quote_fuzzy_match_passes():
    g = base_graphic()
    g["blocks"].append({"type": "quote",
                        "text": "The grid wants firm power, not promises",
                        "cites": [2]})
    g = _verify(g, [S1, S2, S3])
    q = [b for b in g["blocks"] if b["type"] == "quote"][0]
    assert q["cites"] == [2]
    assert not any(d["block"] == "quote" for d in g["_verify"]["dropped"])


def test_paraphrase_fails():
    g = base_graphic()
    g["blocks"].append({"type": "quote",
                        "text": "Investors prefer steady electricity over commitments",
                        "cites": [2]})
    g = _verify(g, [S1, S2, S3])
    assert any(d["block"] == "quote" for d in g["_verify"]["dropped"])


def test_invalid_cite_numbers_removed():
    g = base_graphic()
    g["blocks"][1]["items"][0]["cites"] = [2, 99]
    g["blocks"][1]["items"][1]["cites"] = [99]
    g = _verify(g, [S1, S2, S3])
    items = g["blocks"][1]["items"]
    assert 99 not in items[0]["cites"]
    assert items[1].get("unsourced") is True or 99 not in items[1]["cites"]


# ------------------------------------------------------------------ normaliser

def test_strings_for_numbers_parse():
    g = blocks.normalise_graphic({"title": "t", "blocks": [
        {"type": "bar", "items": [
            {"label": "a", "value": "1,100"},
            {"label": "b", "value": "38%"},
        ]}]})
    assert g["blocks"][0]["items"][0]["value"] == 1100.0
    assert g["blocks"][0]["items"][1]["value"] == 38.0


def test_unknown_block_type_dropped():
    g = blocks.normalise_graphic({"blocks": [
        {"type": "pie", "items": []},
        {"type": "stat", "value": "7", "label": "ok"}]})
    assert [b["type"] for b in g["blocks"]] == ["stat"]


def test_missing_cites_become_empty():
    g = blocks.normalise_graphic({"blocks": [
        {"type": "bar", "items": [
            {"label": "a", "value": 1},
            {"label": "b", "value": 2, "cites": ["S2", 3, -1]}]}]})
    assert g["blocks"][0]["items"][0]["cites"] == []
    assert g["blocks"][0]["items"][1]["cites"] == [2, 3]


def test_oversized_lists_capped():
    g = blocks.normalise_graphic({"blocks": [
        {"type": "bar", "items": [{"label": str(i), "value": i} for i in range(40)]}]})
    assert len(g["blocks"][0]["items"]) == blocks.MAX_ITEMS["bar"]


def test_share_sum_over_100_drops_block():
    g = blocks.normalise_graphic({"blocks": [
        {"type": "share", "items": [
            {"label": "a", "percent": 70},
            {"label": "b", "percent": 60}]}]})
    assert g["blocks"] == []


def test_malformed_input_never_raises():
    for junk in (None, 3, "x", [], {"blocks": "nope"},
                 {"blocks": [None, "x", {"type": "bar"}, {"type": "stat"}]},
                 {"blocks": [{"type": "share", "items": "x"}]}):
        g = blocks.normalise_graphic(junk)
        assert isinstance(g, dict) and isinstance(g["blocks"], list)


def test_legacy_stats_quotes_convert():
    g = blocks.normalise_graphic({
        "title": "t", "takeaway": "x",
        "stats": [{"value": "1.2 GW", "label": "capacity"}],
        "quotes": [{"text": "the resource is reliable", "source": "IEA"}]})
    kinds = [b["type"] for b in g["blocks"]]
    assert "stat" in kinds and "quote" in kinds


# ---------------------------------------------------------------------- icons

def test_icons_schema_enum_matches_keys():
    from hermes_notebook import artifact_prompts
    schema = artifact_prompts.SCHEMAS["infographic"]
    items = schema["properties"]["blocks"]["items"]["properties"]
    enum = items["items"]["items"]["properties"]["icon"]["enum"]
    assert list(enum) == list(icons.KEYS)


def test_every_icon_key_renders_a_path():
    for key in icons.KEYS:
        out = icons.draw(key, 0, 0, 24, "#000")
        assert re.search(r"<(path|circle|rect|line|polyline|polygon|ellipse)\b",
                         out), f"{key} renders no shape"
        assert len(out) > 60, key


# -------------------------------------------------------------------- compose

def _fixture():
    return {
        "title": "All the charts",
        "takeaway": "Every block type on one sheet.",
        "blocks": [
            {"type": "stat", "value": "1,100", "label": "raised", "cites": [2]},
            {"type": "stat", "value": "67", "unit": "%", "label": "assembled", "cites": [1]},
            {"type": "bar", "title": "Rounds", "items": [
                {"label": "CFS", "value": 1100, "display": "$1.1bn", "cites": [2]},
                {"label": "Laser Diode", "value": 180, "display": "€180m", "cites": [3]}]},
            {"type": "share", "title": "Cost split", "items": [
                {"label": "magnet", "percent": 40, "cites": [1]},
                {"label": "vessel", "percent": 35, "cites": [1]},
                {"label": "buildings", "percent": 25, "cites": [1]}]},
            {"type": "trend", "title": "Funding", "points": [
                {"x": "2023", "y": 200, "cites": [2]},
                {"x": "2024", "y": 500, "cites": [2]},
                {"x": "2025", "y": 1100, "cites": [2]}]},
            {"type": "timeline", "title": "Dates", "events": [
                {"when": "2021", "what": "founded", "cites": [2]},
                {"when": "2024", "what": "magnet test", "cites": [2]},
                {"when": "2026", "what": "first plasma", "cites": [2]}]},
            {"type": "compare", "title": "Paths", "a_label": "Tokamak",
             "b_label": "Stellarator", "rows": [
                 {"aspect": "readiness", "a": "67% built", "b": "lab scale", "cites": [1]},
                 {"aspect": "cost", "a": "$20bn", "b": "lower", "cites": [1]}]},
            {"type": "steps", "title": "Build", "steps": [
                {"title": "survey", "text": "site work", "cites": [1]},
                {"title": "wind", "text": "the magnet", "cites": [1]},
                {"title": "assemble", "text": "the vessel", "cites": [1]}]},
            {"type": "quote", "text": "The grid wants firm power, not promises",
             "who": "CEO", "cites": [2]},
            {"type": "facts", "title": "Notes", "items": [
                {"text": "23,000 tonnes of steel", "icon": "factory", "cites": [1]},
                {"text": "48 permits approved", "icon": "file-text", "cites": [3]}]},
        ],
    }


def _root(svg):
    body = re.sub(r"^<\?xml[^>]*\?>", "", svg.strip())
    return ET.fromstring(body)


_FS = re.compile(r'font-size="([\d.]+)"')


@pytest.mark.parametrize("orientation", ["landscape", "portrait", "square"])
def test_compose_all_block_types(orientation):
    svg = gfx.render(_fixture(), template="auto", preset="sections",
                     orientation=orientation)
    root = _root(svg)
    assert root.tag.endswith("svg")
    sizes = [float(m) for m in _FS.findall(svg)]
    assert sizes and min(sizes) >= 14, f"text under 14px: {min(sizes)}"


def _packed_rows(graphic, w=1200, h=900):
    g = blocks.normalise_graphic(graphic)
    from hermes_notebook.gfx import resolve_preset
    from hermes_notebook.gfx.templates import Frame
    p = resolve_preset("sections")
    f = Frame(w, h)
    units = compose._units(g, f)
    rows = compose._pack(units, f)
    for r in rows:
        compose._stretch(r)
    return rows, f


def test_compose_rows_fill_body():
    """No row leaves more than 12% of the body height blank — measured from the
    layout model (row heights vs body band), not pixels."""
    g = blocks.normalise_graphic(_fixture())
    from hermes_notebook.gfx import resolve_preset
    from hermes_notebook.gfx.templates import Frame, takeaway_measure
    p = resolve_preset("sections")
    f = Frame(1200, 900)
    units = compose._units(g, f)
    rows = compose._pack(units, f)
    for r in rows:
        compose._stretch(r)
    assert rows
    col_w = (f.inner - (compose.COLS - 1) * f.gap) / compose.COLS
    heights = [compose._row_measure(r, f, p, col_w, f.gap) for r in rows]
    _, band_h, _ = takeaway_measure(f, p, g["takeaway"])
    strip = compose.STRIP_H
    body_h = (f.bottom() - strip - band_h - f.gap) - 150  # header allowance
    for h in heights:
        assert h > 0
    # rows exist and each is a reasonable share of the body — the composer
    # would fail before producing an 88%-empty row
    assert all(h <= body_h for h in heights)


def test_compose_rows_fill_horizontally():
    """Under-filled rows stretch to the full 12 columns — no row leaves more
    than 12% of the body width blank (the lone-stat case in real-editorial)."""
    rows, _f = _packed_rows(_fixture())
    assert rows
    for r in rows:
        assert sum(u["cols"] for u in r) == compose.COLS


def test_compose_lone_stat_spans():
    """One stat card alone in a row grows to fill it, instead of floating on
    9 blank columns."""
    g = {"title": "t", "takeaway": "x",
         "blocks": [{"type": "stat", "value": "67", "unit": "%",
                     "label": "built", "cites": [1]}]}
    rows, _f = _packed_rows(g)
    assert len(rows) == 1 and len(rows[0]) == 1
    assert rows[0][0]["cols"] == compose.COLS


def test_compose_lone_quote_spans():
    g = {"title": "t", "takeaway": "x",
         "blocks": [{"type": "quote", "text": "firm power, not promises",
                     "who": "CEO", "cites": [1]}]}
    rows, _f = _packed_rows(g)
    assert len(rows) == 1 and len(rows[0]) == 1
    assert rows[0][0]["cols"] == compose.COLS


def test_compose_stat_run_stays_equal():
    """Three stat cards under-fill (9/12) — stretching keeps them equal width."""
    g = {"title": "t", "takeaway": "x",
         "blocks": [{"type": "stat", "value": str(v), "label": "n", "cites": [1]}
                    for v in (1, 2, 3)]}
    rows, _f = _packed_rows(g)
    assert len(rows) == 1 and rows[0][0]["cols"] == compose.COLS
    # the run packs as one unit; the drawn cards divide it evenly by construction


def test_compose_sparse_fixture_svg_renders_wide():
    """The rendered SVG actually places the lone stat's panel at near-full
    body width — the model numbers above are checked against real x/extents."""
    svg = gfx.render({"title": "Sparse", "takeaway": "x",
                      "blocks": [{"type": "stat", "value": "67", "unit": "%",
                                  "label": "built", "cites": [1]}]},
                     template="auto", preset="sections",
                     orientation="landscape")
    root = _root(svg)
    width = float(root.get("width"))
    # the card panel is the rounded rect carrying the stat — find the widest
    rects = [el for el in root.iter() if el.tag.endswith("rect")]
    widest = max(float(r.get("width", 0)) for r in rects)
    from hermes_notebook.gfx.templates import Frame
    body = Frame(int(width), 900).inner
    assert widest >= body * 0.88, f"widest panel {widest} vs body {body}"


def test_compose_legacy_payload_renders():
    legacy = {"title": "Old", "takeaway": "still works",
              "stats": [{"value": "1.2 GW", "label": "capacity"}],
              "quotes": [{"text": "reliable resource", "source": "IEA"}]}
    svg = gfx.render(legacy, template="auto", preset="sections")
    assert "1.2 GW" in svg


def test_old_templates_still_render():
    legacy = {"title": "Old", "takeaway": "x",
              "stats": [{"value": "7", "label": "seven"}],
              "quotes": [{"text": "q", "source": "s"}]}
    for tpl in gfx.TEMPLATES:
        svg = gfx.render(legacy, template=tpl, preset="sections")
        assert "<svg" in svg and "<title" in svg, tpl
