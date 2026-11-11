"""The isometric micro-diagram vocabulary.

These are drawn, deterministic, and must stay inside the box they are given: an
icon that overflows its slot is clipped by the card that holds it, and a card
that clips its own diagram reads as a rendering bug. The bounds are measured by
RASTERISING and reading pixels, because the SVG coordinates of a path are not
its painted extent (bezier control points sit outside the curve).
"""

from __future__ import annotations

import hashlib
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from hermes_notebook.gfx import core, isometrics  # noqa: E402


def test_vocabulary_is_stable_and_documented():
    """The schema enum, the renderer and the catalogue are one list."""
    assert set(isometrics.KINDS) == set(isometrics.catalogue())
    for kind in isometrics.KINDS:
        assert isometrics.catalogue()[kind].strip(), f"{kind} has no description"


@pytest.mark.parametrize("kind", isometrics.KINDS)
def test_every_helper_emits_real_svg(kind: str):
    els = isometrics.draw(kind, 20, 20, 56, (245, 158, 11))
    assert len(els) >= 6, f"{kind} drew only {len(els)} elements"
    assert all(isinstance(e, str) and e.startswith("<") for e in els)
    svg = "".join(els)
    # no placeholder junk: a helper that silently returns nothing paints a gap
    assert "nan" not in svg.lower() and "inf" not in svg.lower()


@pytest.mark.parametrize("kind", isometrics.KINDS)
def test_helpers_are_deterministic(kind: str):
    """Same arguments, byte-identical output — otherwise a snapshot is useless."""
    a = "".join(isometrics.draw(kind, 10, 10, 64, (6, 182, 212)))
    b = "".join(isometrics.draw(kind, 10, 10, 64, (6, 182, 212)))
    assert hashlib.sha256(a.encode()).hexdigest() == hashlib.sha256(b.encode()).hexdigest()


def test_unknown_kind_falls_back_instead_of_raising():
    """A schema can outrun the renderer; a plainer icon beats a failed poster."""
    els = isometrics.draw("not_a_thing", 10, 10, 56, (139, 92, 246))
    assert els, "the fallback drew nothing"
    assert isometrics.draw("", 10, 10, 56, (139, 92, 246))


def test_icons_stay_inside_their_box_measured_by_pixels():
    """The painted extent of each icon fits its `size` box, at two scales."""
    pytest.importorskip("PIL")
    from PIL import Image

    from hermes_notebook.gfx.document import chrome_path
    browser = chrome_path()
    if not browser:
        pytest.skip("no Chrome to rasterise with")

    box = 240
    for kind in isometrics.KINDS:
        for size in (56, 120):
            origin = (box - size) // 2 + 20
            svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
                   'viewBox="0 0 %d %d">%s%s</svg>'
                   % (box, box, box, box, core.rect(0, 0, box, box, fill=(255, 255, 255)),
                      "".join(isometrics.draw(kind, origin, origin, size, (37, 99, 235),
                                              (255, 255, 255)))))
            with tempfile.TemporaryDirectory() as tmp:
                html = Path(tmp) / "g.html"
                html.write_text("<style>html,body{margin:0}</style>" + svg, encoding="utf-8")
                png = Path(tmp) / "g.png"
                subprocess.run([browser, "--headless=new", "--no-sandbox", "--disable-gpu",
                                "--hide-scrollbars", "--virtual-time-budget=2000",
                                f"--window-size={box},{box}", f"--screenshot={png}",
                                html.as_uri()], capture_output=True, timeout=60)
                img = Image.open(png).convert("RGB")
            px = img.load()
            minx, miny, maxx, maxy = box, box, 0, 0
            for x in range(box):
                for y in range(box):
                    if sum(px[x, y]) < 740:
                        minx, miny = min(minx, x), min(miny, y)
                        maxx, maxy = max(maxx, x), max(maxy, y)
            assert maxx - origin <= size + 1, f"{kind}@{size}: painted {maxx - origin}px wide"
            assert maxy - origin <= size + 1, f"{kind}@{size}: painted {maxy - origin}px tall"
            assert maxx > origin and maxy > origin, f"{kind}@{size}: drew nothing"
