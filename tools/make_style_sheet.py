"""Render the bundled infographic style pack to a contact sheet.

    python3 tools/make_style_sheet.py            # assets/infographic-styles.png
    python3 tools/make_style_sheet.py --thumbs    # + assets/styles/<id>.png

Same sample content for every style, so the sheet compares looks, not copy. The
sample is invented sample data, not notebook output — the sheet is a style
reference, never a claim about a real notebook.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from hermes_notebook import igrender, igstyles  # noqa: E402

SAMPLE = {
    "title": "Tidal power — the three facts that decide a project",
    "takeaway": "Output is set by the site, the cost by the cable, and the schedule by the consent — in that order.",
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

SHEET_TITLE = "hermes-notebook · infographic styles"


def _label_font(size: int = 20):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                 "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


def main() -> int:
    thumbs = "--thumbs" in sys.argv
    cols = 4
    tw, th = 600, 450
    pad = 26
    label_h = 46
    rows = (len(igstyles.STYLES) + cols - 1) // cols
    head = 96
    W = cols * tw + pad * 2
    H = head + rows * (th + label_h) + pad

    sheet = Image.new("RGB", (W, H), (250, 249, 246))
    d = ImageDraw.Draw(sheet)
    f_head = _label_font(30)
    f_sub = _label_font(17)
    f_lab = _label_font(21)
    d.text((pad, 30), SHEET_TITLE, font=f_head, fill=(28, 28, 30))
    d.text((pad, 66), "one sample payload, sixteen bundled looks — "
                      "style ids in the caption", font=f_sub, fill=(110, 110, 116))

    out_dir = ROOT / "assets" / "styles"
    if thumbs:
        out_dir.mkdir(parents=True, exist_ok=True)

    for i, style in enumerate(igstyles.STYLES):
        r, c = divmod(i, cols)
        img = igrender.render(SAMPLE, "Tidal power", style.id)
        tile = img.resize((tw, th), Image.LANCZOS)
        x = pad + c * tw
        y = head + r * (th + label_h)
        sheet.paste(tile, (x, y))
        d.rectangle([x, y, x + tw - 1, y + th - 1], outline=(214, 210, 202))
        d.text((x + 1, y + th + 12), style.label, font=f_lab, fill=(28, 28, 30))
        d.text((x + 1, y + th + 30), f"{style.id} · {style.family}",
               font=f_sub, fill=(120, 120, 126))
        if thumbs:
            img.save(out_dir / f"{style.id}.png")

    dest = ROOT / "assets" / "infographic-styles.png"
    sheet.save(dest)
    print(f"wrote {dest.relative_to(ROOT)} ({W}x{H})")
    if thumbs:
        print(f"wrote {len(igstyles.STYLES)} thumbs to {out_dir.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
