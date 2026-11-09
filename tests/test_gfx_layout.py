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
from hermes_notebook.gfx import isometrics, templates  # noqa: E402

CANVAS = (1200, 900)
DETAILS = ("concise", "standard", "detailed")

#: Templates whose empty space is deliberate.
WHITESPACE_BY_DESIGN = {"quote_card", "cover", "illustration"}

#: Fractional sizes are the norm (10.5px, 11.5px). An integer-only pattern
#: silently matched nothing and left min_fs at its sentinel, so the legibility
#: check never fired on exactly the labels it was written for.
_TEXT = re.compile(r'<text[^>]*y="([\d.]+)"[^>]*font-size="([\d.]+)"')
_RECT = re.compile(r'<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"')


def measured(els: list[str]) -> dict:
    """Lowest and rightmost painted edge, and the smallest type size."""
    bottom = right = 0.0
    min_fs = 999
    for e in els:
        for m in _TEXT.finditer(e):
            y, fs = float(m.group(1)), float(m.group(2))
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
                # Body copy floor is 12px at the authored canvas size. A dense
                # blueprint poster carries micro-labels (taxonomy tags, bench
                # identifiers) by design and ships at 2x, where 9px is 18 device
                # pixels — so it gets a stated 9px floor instead of an exemption.
                floor_fs = 9.0 if tpl == "blueprint_evolution" else 12.0
                if g["min_fs"] < floor_fs:
                    problems.append(f"{where}: {g['min_fs']}px type is below the "
                                    f"{floor_fs}px floor for this template")
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


# ---------------------------------------------------------------- blueprint

def _blueprint_payload() -> dict:
    """A payload with every zone populated at the count the schema asks for."""
    return {
        "title": "Parametric CAD engine — from sliders to solvers",
        "subtitle": "Legacy constraint stack rebuilt as a solver-backed graph",
        "current_gaps": [
            {"title": "Manual sliders", "icon_type": "iso_grid_cube",
             "spec": "Parameters edited by hand; no dependency graph between features"},
            {"title": "No constraint solver", "icon_type": "kinematic_node_graph",
             "spec": "Geometry re-evaluated per edit; assemblies drift out of tolerance"},
            {"title": "Software rendering", "icon_type": "oscilloscope_trace",
             "spec": "CPU raster only; no PBR path and no per-frame budget"},
            {"title": "Closed file format", "icon_type": "file_pipeline_nodes",
             "spec": "Proprietary binary export; no STEP or USD interchange"},
            {"title": "No load telemetry", "icon_type": "test_ramp_and_rig",
             "spec": "Field failures reported by email weeks after deployment"},
        ],
        "evolution_matrix": [
            {"domain": "Kinematics", "before_label": "sliders", "after_label": "Jacobian IK",
             "key_upgrade": "Replaces manual sliders with Jacobian IK solvers"},
            {"domain": "Topology", "before_label": "flat list", "after_label": "DAG",
             "key_upgrade": "Feature tree becomes a directed acyclic graph"},
            {"domain": "Render", "before_label": "CPU raster", "after_label": "deferred PBR",
             "key_upgrade": "Deferred path with per-frame GPU budget"},
            {"domain": "Telemetry", "before_label": "email", "after_label": "OTel traces",
             "key_upgrade": "OpenTelemetry spans on every solve"},
            {"domain": "Interchange", "before_label": "proprietary", "after_label": "STEP + USD",
             "key_upgrade": "Dual export, round-trip verified in CI"},
        ],
        "core_pillars": [
            {"title": "Core Engine / Physics", "diagram_type": "iso_grid_cube",
             "concise_spec": "Rigid-body solver at 240 Hz, contact cached across frames"},
            {"title": "Graph / Control", "diagram_type": "kinematic_node_graph",
             "concise_spec": "DAG evaluation with incremental invalidation on edit"},
            {"title": "Rendering / Parametric", "diagram_type": "oscilloscope_trace",
             "concise_spec": "Deferred PBR at 1440p, 16 ms per-frame budget"},
            {"title": "Telemetry / Diagnostics", "diagram_type": "oscilloscope_trace",
             "concise_spec": "OTel spans per solve, flame graphs in release builds"},
            {"title": "Open Interchange", "diagram_type": "file_pipeline_nodes",
             "concise_spec": "STEP AP242 and USDZ export, schema-validated"},
        ],
        "expansion_stages": [
            {"label": "Desktop", "detail": "single-user, local GPU", "value": "1 seat"},
            {"label": "Studio", "detail": "shared asset store", "value": "8 seats"},
            {"label": "Fleet", "detail": "headless solver nodes", "value": "64 nodes"},
            {"label": "Cloud", "detail": "multi-tenant, autoscaled", "value": "unbounded"},
        ],
        "validation_benches": [
            {"title": "IK convergence", "bench_icon": "kinematic_node_graph",
             "test_criteria": "Solver reaches target pose in under 12 iterations"},
            {"title": "Frame budget", "bench_icon": "oscilloscope_trace",
             "test_criteria": "P99 frame under 16 ms at 1440p with 2M tris"},
            {"title": "Round-trip fidelity", "bench_icon": "file_pipeline_nodes",
             "test_criteria": "STEP export reimports bit-identical topology"},
            {"title": "Load rig", "bench_icon": "test_ramp_and_rig",
             "test_criteria": "Bench holds 500 N for 10^6 cycles without drift"},
        ],
        "source": "notebook: parametric CAD audit",
    }


def test_blueprint_zones_are_all_populated():
    """Every zone of the poster must paint, at every preset.

    A multi-zone template can silently skip a zone (an empty array, a wrong
    coordinate) and still look "busy" — this checks each authored rectangle for
    ink after a real render, so a blank zone is a failure, not a screenshot the
    reviewer has to notice.
    """
    payload = _blueprint_payload()
    zones = __import__("hermes_notebook.gfx.blueprint", fromlist=["zones"]).zones()
    for preset in ("sections", "blueprint", "terminal", "carbon"):
        els, _by, _bh = gfx.templates.TEMPLATES["blueprint_evolution"](
            templates.Frame(*CANVAS), gfx.resolve_preset(preset), payload, "standard")
        svg = "".join(els)
        for label in ("CAPABILITY EVOLUTION", "DOMAIN &amp; SCALE", "VALIDATION BENCHES"):
            assert label in svg, f"{preset}: the {label} zone heading is missing"
        # the five signal colours must all be present: a poster that drops one
        # ribbon colour breaks the colour-to-domain mapping a reader learns
        for name, rgb in (("amber", (245, 158, 11)), ("purple", (139, 92, 246)),
                          ("cyan", (6, 182, 212)), ("coral", (239, 68, 68)),
                          ("emerald", (16, 185, 129))):
            hexed = "#%02x%02x%02x" % rgb
            assert hexed in svg, f"{preset}: the {name} signal colour is missing"
    assert set(zones) == {"header", "gaps", "matrix", "pillars", "expansion", "benches"}


def test_blueprint_fills_its_canvas_and_survives_sparse_payloads():
    """Missing arrays must degrade, never raise — and the zones still fill."""
    for payload in (_blueprint_payload(), {"title": "Bare"}, gfx.SAMPLE_GRAPHIC):
        els, _by, _bh = gfx.templates.TEMPLATES["blueprint_evolution"](
            templates.Frame(*CANVAS), gfx.resolve_preset("sections"), payload, "standard")
        g = measured(els)
        assert g["bottom"] <= CANVAS[1] + 1, f"overflows by {g['bottom'] - CANVAS[1]:.0f}px"
        assert g["right"] <= CANVAS[0] + 1
        assert g["min_fs"] >= 9.0, f"{g['min_fs']}px below the blueprint floor"
        assert CANVAS[1] - g["bottom"] < 40, "the poster must reach its own floor"


def test_blueprint_schema_matches_the_renderer():
    """Every key the schema asks the model for is a key the renderer reads.

    This is the drift that makes a prompt do wasted work: a schema field nobody
    draws costs tokens and returns a paragraph that lands nowhere.
    """
    from hermes_notebook import artifacts
    from hermes_notebook.gfx import blueprint

    schema = artifacts._STRUCT_SCHEMAS["blueprint_evolution"]
    props = schema["properties"]
    assert set(schema["required"]) <= set(props)
    icon_enum = (props["current_gaps"]["items"]["properties"]["icon_type"]["enum"])
    assert set(icon_enum) == set(isometrics.KINDS), "schema enum and renderer vocabulary differ"

    src = (ROOT / "hermes_notebook" / "gfx" / "blueprint.py").read_text()
    for key in ("current_gaps", "evolution_matrix", "core_pillars",
                "expansion_stages", "validation_benches"):
        assert f'"{key}"' in src, f"the renderer never reads {key}"
    for field in ("icon_type", "before_label", "after_label", "key_upgrade",
                  "concise_spec", "diagram_type", "test_criteria", "bench_icon"):
        assert f'"{field}"' in src, f"the renderer never reads {field}"


def test_blueprint_is_registered_everywhere_it_must_be():
    """Four places have to agree, and they are four separate files.

    A kind the backend can generate but the panel never lists is invisible to the
    user; a kind the panel lists but the backend rejects is a 500. Checking the
    source text keeps this test runnable without the plugin venv (fastapi is not
    importable here) while still failing on real drift.
    """
    from hermes_notebook import artifacts

    assert "blueprint_evolution" in artifacts.ALL_KINDS
    assert "blueprint_evolution" in artifacts._STRUCT_SCHEMAS
    assert "blueprint_evolution" in artifacts._STRUCT_INSTRUCTIONS

    api = (ROOT / "dashboard" / "plugin_api.py").read_text()
    assert '"id": "blueprint_evolution"' in api, "the Studio panel would never list it"
    assert '"blueprint_evolution"' in api and '"group": "visual"' in api

    ui_data = (ROOT / "src" / "20-data.js").read_text()
    assert "blueprint_evolution" in ui_data, "no icon for the kind in the UI"
    ui_icons = (ROOT / "src" / "10-ui.js").read_text()
    assert "blueprint:" in ui_icons, "the glyph the kind name resolves to is missing"

    viewers = (ROOT / "src" / "40-viewers.js").read_text()
    assert "blueprint_evolution" in viewers, "no viewer branch — the artifact opens blank"


def test_every_structured_kind_has_a_brief_and_a_schema():
    """`generate` reads both registries by kind, so a kind missing either one
    fails at import or at the model call — not at review time.

    This is the check that was missing when a blueprint kind was added to
    `STRUCT_KINDS` while the registries still held six entries: the KeyError
    surfaced during test collection, which means it would have surfaced as a 500
    on the first click in the dashboard.
    """
    from hermes_notebook import artifact_prompts, artifacts

    for kind in artifacts.STRUCT_KINDS:
        assert kind in artifact_prompts.SCHEMAS, f"{kind}: no JSON schema"
        assert artifact_prompts.build_instructions(kind), f"{kind}: no brief"
        schema = artifact_prompts.SCHEMAS[kind]
        assert schema.get("type") == "object"
        assert schema.get("required"), f"{kind}: schema requires nothing"
        assert set(schema["required"]) <= set(schema.get("properties") or {})

    for kind in artifacts.MD_KINDS:
        assert kind in artifact_prompts.BRIEFS, f"{kind}: no markdown brief"


def test_blueprint_schema_icons_match_the_renderer():
    """The schema enum is the renderer's vocabulary — imported, not retyped."""
    from hermes_notebook import artifact_prompts

    assert tuple(artifact_prompts.ISO_KINDS) == tuple(isometrics.KINDS)
    schema = artifact_prompts.SCHEMAS["blueprint_evolution"]
    for field in ("current_gaps", "core_pillars", "validation_benches"):
        key = "icon_type" if field == "current_gaps" else (
            "diagram_type" if field == "core_pillars" else "bench_icon")
        enum = schema["properties"][field]["items"]["properties"][key]["enum"]
        assert tuple(enum) == tuple(isometrics.KINDS), f"{field}.{key} drifted"


def test_a_poster_artifact_resolves_its_renderable_file():
    """The panel opens the `primary` file. A run that lists .svg/.json/.png must
    resolve to the image, never to its JSON twin.

    Found live: the blueprint run's primary was `…-blueprint_evolution.json`
    because `svg` was missing from the preference list, so the viewer asked the
    image tag to display a JSON document.
    """
    api = (ROOT / "dashboard" / "plugin_api.py").read_text()
    preference = api.split("for want in (", 1)[1].split(")", 1)[0]
    for ext in ("mp4", "mp3", "png", "svg", "html"):
        assert f'"{ext}"' in preference, f"{ext} is not a preferred primary"
    # a vector poster must beat both its html wrapper and its json twin
    assert preference.index('"svg"') < preference.index('"html"')
    assert preference.index('"svg"') < preference.index('"json"')
