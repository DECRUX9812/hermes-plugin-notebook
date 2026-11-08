#!/usr/bin/env python3
"""Render a screenshot as terminal ASCII art — the no-GUI verification path.

Usage: python3 tests/shot_ascii.py tests/shots/evidence-home-sigils.png [width]

Why this exists: this environment has no browser host and the agent's image
reader may be unavailable, so PNG evidence can't be displayed inline. ASCII
art preserves layout — panels, cards, text blocks — well enough to verify a
screen at a glance. For color, pipe through `img2txt -f ansi` (caca-utils)
when your terminal supports it.
"""
import sys

RAMP = " .,:;irsXA253hMHGS#9B&@"  # dark -> light


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    path = sys.argv[1]
    width = int(sys.argv[2]) if len(sys.argv) > 2 else 110
    try:
        from PIL import Image
    except ImportError:
        print("PIL not available — install pillow or use: img2txt " + path)
        return 1
    img = Image.open(path).convert("L")
    # chars are ~2x taller than wide: shrink height by ~0.5 for correct aspect
    w, h = img.size
    height = max(1, int(width * (h / w) * 0.5))
    img = img.resize((width, height))
    px = img.load()
    for y in range(height):
        print("".join(RAMP[min(len(RAMP) - 1, px[x, y] * len(RAMP) // 256)]
                      for x in range(width)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
