"""Render the graphics library to contact sheets, example SVGs and PNGs.

    python3 tools/make_graphics_sheet.py               # assets/infographic-styles.png
    python3 tools/make_graphics_sheet.py --templates   # + assets/graphics-templates.png
    python3 tools/make_graphics_sheet.py --examples    # + assets/examples/*.svg|png
    python3 tools/make_graphics_sheet.py --snapshots   # rewrite tests/snapshots/gfx.json

SVGs come from the real renderer using one invented sample payload, so a sheet
compares looks rather than copy. PNGs are rasterised by headless Chrome; with no
browser the sheets are skipped and every SVG is still written.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from hermes_notebook import gfx  # noqa: E402
from hermes_notebook.gfx import samples as gfx_samples  # noqa: E402

SAMPLE = gfx_samples.SAMPLE_GRAPHIC

TEMPLATE_CASES = [("infographic", "sections"), ("key_figure", "realistic"),
                  ("stat_grid", "dashboard"), ("timeline", "sections"),
                  ("comparison", "swiss"), ("process", "cartoon"),
                  ("quote_card", "magazine"), ("cover", "cartoon"),
                  ("illustration", "realistic")]

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


def _sheet_html(tiles, cols: int, tw: int, th: int, title: str, sub: str) -> str:
    width = cols * (tw + 14) + 14
    cells = "".join(
        f'<figure><img src="{path}" width="{tw}" height="{th}">'
        f'<figcaption><b>{label}</b><span>{sublabel}</span></figcaption></figure>'
        for (path, label, sublabel) in tiles)
    return (
        "<!doctype html><meta charset=utf-8><title>sheet</title>"
        "<style>body{margin:0;background:#f7f6f2;font:14px/1.35 system-ui,sans-serif;"
        f"width:{width}px"
        "header{padding:20px 16px 6px}h1{font:600 22px/1.2 system-ui;margin:0}"
        "p{color:#6b6b72;margin:4px 0 0;font-size:13px}"
        f".g{{display:grid;grid-template-columns:repeat({cols},{tw}px);gap:14px;"
        "padding:14px 16px 22px}figure{margin:0}"
        "img{border-radius:10px;border:1px solid #ddd9d0;display:block}"
        "figcaption{padding:6px 2px 0;display:flex;gap:6px;align-items:baseline}"
        "figcaption b{font-size:12.5px}figcaption span{font-size:11px;color:#86868e}"
        "</style>"
        f"<header><h1>{title}</h1><p>{sub}</p></header>"
        f'<div class="g">{cells}</div>'
    )


def _shoot(html: str, out: Path, width: int, height: int) -> bool:
    browser = gfx.chrome_path()
    if not browser:
        print("  (no Chrome — PNG sheet skipped, SVGs written)")
        return False
    # The sheet must live beside the SVGs it references: relative `src` resolves
    # against the document URL, and a temp dir would 404 every tile.
    page = out.parent / (out.stem + ".html")
    page.write_text(html, encoding="utf-8")
    cmd = [browser, "--headless=new", "--no-sandbox", "--disable-gpu",
           "--hide-scrollbars", "--virtual-time-budget=6000",
           f"--window-size={width},{height}",
           f"--screenshot={out}", page.as_uri()]
    try:
        subprocess.run(cmd, capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        return False
    return out.exists()


def main() -> int:
    args = set(sys.argv[1:])
    assets = ROOT / "assets"
    assets.mkdir(exist_ok=True)

    if "--snapshots" in args:
        snap = ROOT / "tests" / "snapshots" / "gfx.json"
        snap.parent.mkdir(parents=True, exist_ok=True)
        data = {name: hashlib.sha256(
                    re.sub(r"\s+", " ", gfx.render(SAMPLE, **kw)).encode()).hexdigest()[:16]
                for name, kw in SNAPSHOT_CASES}
        snap.write_text(json.dumps(data, indent=1, sort_keys=True))
        print(f"snapshots written: {snap.relative_to(ROOT)} ({len(data)} cases)")
        return 0

    style_dir = assets / "styles"
    style_dir.mkdir(exist_ok=True)
    tiles = []
    for preset in gfx.PRESETS:
        # illustrated treatments are shown as covers: an infographic scrim would
        # hide the very artwork that makes them different
        tpl = "cover" if preset.art != "none" else "infographic"
        svg = gfx.render(SAMPLE, preset=preset.id, template=tpl)
        (style_dir / f"{preset.id}.svg").write_text(svg)
        kind = preset.art if preset.art != "none" else preset.family
        tiles.append((f"styles/{preset.id}.svg", preset.label, f"{preset.id} · {kind}"))
    html = _sheet_html(tiles, 4, 600, 450, "hermes-notebook · 18 looks",
                       "one invented sample payload, eighteen bundled looks — "
                       "cartoon and realistic add the illustrated treatments")
    (assets / "styles.html").write_text(html)
    _shoot(html, assets / "infographic-styles.png", 4 * 614 + 14, 5 * 500 + 96)
    print(f"wrote {len(tiles)} style SVGs + assets/infographic-styles.png")

    if "--templates" in args or "--examples" in args:
        ex = assets / "examples"
        ex.mkdir(exist_ok=True)
        tt = []
        for tpl, preset in TEMPLATE_CASES:
            name = f"{tpl}-{preset}"
            (ex / f"{name}.svg").write_text(gfx.render(SAMPLE, template=tpl, preset=preset))
            if "--examples" in args:
                try:
                    gfx.to_png(SAMPLE, ex / f"{name}.png", template=tpl, preset=preset)
                except Exception as exc:
                    print(f"  png skipped for {name}: {exc}")
            tt.append((f"examples/{name}.svg", tpl.replace("_", " ").title(), preset))
        html = _sheet_html(tt, 3, 600, 450, "hermes-notebook · templates",
                           "nine compositions from one payload, built from primitives")
        (assets / "templates.html").write_text(html)
        _shoot(html, assets / "graphics-templates.png", 3 * 614 + 14, 4 * 500 + 96)
        print(f"wrote {len(tt)} template examples")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
