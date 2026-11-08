"""Theme presets — the looks the library can draw, as data.

A preset is a palette, a typeface, a layout family and an art treatment. The
sixteen infographic looks are re-exported from `igstyles` (one palette source in
the repo, not two), and the library adds the two treatments it exists to
provide: `cartoon` and `realistic`.

Both new treatments are drawn from primitives, not photographs: `cartoon` uses
flat shapes, thick outlines and offset shadows; `realistic` uses layered
gradients, a soft vignette, drop shadows and film grain. That is stated plainly
in the docs, because a "realistic" preset that quietly implied photography would
be a lie the moment someone opened the SVG.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from .. import igstyles
from . import core

RGB = Tuple[int, int, int]

#: Art treatments a preset may ask for. `none` = type and colour only.
ART = ("none", "cartoon", "plate")

#: Layout families the templates know how to fill.
FAMILIES = ("cards", "rows", "poster", "kpi", "feature", "strip")


class Preset:
    """One look. Immutable by convention; the registry is module data."""

    __slots__ = ("id", "label", "blurb", "best_for", "family", "base", "paper", "ink",
                 "muted", "card", "accents", "border", "radius", "typeface", "decor",
                 "kicker", "tone", "art")

    def __init__(self, id: str, label: str, blurb: str, best_for: str, family: str,
                 base: str, paper: RGB, ink: RGB, muted: RGB, card: RGB,
                 accents: List[RGB], border: Optional[RGB] = None, radius: int = 0,
                 typeface: str = "sans", decor: Tuple[str, ...] = (),
                 kicker: str = "INFOGRAPHIC", tone: str = "light", art: str = "none"):
        self.id = id
        self.label = label
        self.blurb = blurb
        self.best_for = best_for
        self.family = family
        self.base = base
        self.paper = paper
        self.ink = ink
        self.muted = muted
        self.card = card
        self.accents = accents
        self.border = border
        self.radius = radius
        self.typeface = typeface
        self.decor = decor
        self.kicker = kicker
        self.tone = tone
        self.art = art if art in ART else "none"

    # -- derived ---------------------------------------------------------
    @property
    def on_paper(self) -> RGB:
        return core.readable(self.ink, self.paper)

    @property
    def on_card(self) -> RGB:
        return core.readable(self.ink, self.card)

    def accent_on(self, i: int = 0) -> RGB:
        return self.accents[i % len(self.accents)]

    def readable_accent(self, i: int = 0, bg: Optional[RGB] = None) -> RGB:
        return core.readable(self.accent_on(i), bg or self.card)

    def swatch(self) -> List[str]:
        return [core.hexed(c) for c in [self.paper, self.card, *self.accents[:3], self.ink]]

    def as_dict(self) -> Dict[str, Any]:
        return {"id": self.id, "label": self.label, "blurb": self.blurb,
                "best_for": self.best_for, "family": self.family, "base": self.base,
                "tone": self.tone, "typeface": self.typeface, "art": self.art,
                "swatch": self.swatch()}


def _from_style(style: igstyles.Style) -> Preset:
    return Preset(style.id, style.label, style.blurb, style.best_for, style.family,
                  style.base, style.paper, style.ink, style.muted, style.card,
                  list(style.accents), style.border, style.radius, style.typeface,
                  tuple(style.decor), style.kicker, style.tone, art="none")


#: The two house treatments. Names are deliberately plain: "cartoon" and
#: "realistic" are what people ask for, not "claymorphism" and "photoreal".
_HOUSE: List[Preset] = [
    Preset(
        "cartoon", "Cartoon", "Thick outlines, flat fills, friendly shapes and a picture-book sky.",
        "Explainers, classroom material, anything for a non-specialist audience.",
        "feature", "house-cartoon", paper=(0xFD, 0xF4, 0xE3), ink=(0x1B, 0x1B, 0x2A),
        muted=(0x5A, 0x54, 0x4C), card=(0xFF, 0xFD, 0xF6),
        accents=[(0xFF, 0x6B, 0x35), (0x2E, 0x86, 0xE0), (0x39, 0xB5, 0x7A),
                 (0xF2, 0xC0, 0x3D)],
        border=(0x1B, 0x1B, 0x2A), radius=22, typeface="sans",
        decor=("outline", "art"), kicker="IN PICTURES", tone="light", art="cartoon",
    ),
    Preset(
        "realistic", "Realistic", "Deep neutrals, layered light, soft shadow and film grain.",
        "Reports, product paint, anything that should look photographed rather than drawn.",
        "feature", "house-plate", paper=(0x14, 0x17, 0x1C), ink=(0xF4, 0xF6, 0xF8),
        muted=(0xC2, 0xC9, 0xD3), card=(0x24, 0x2B, 0x35),
        accents=[(0x6E, 0xE7, 0xFF), (0xFF, 0xB4, 0x5C), (0x9C, 0xF5, 0xC0)],
        border=(0x3E, 0x4A, 0x5C), radius=14, typeface="sans",
        decor=("plate", "art"), kicker="OBSERVED", tone="dark", art="plate",
    ),
]

PRESETS: List[Preset] = [_from_style(s) for s in igstyles.STYLES] + _HOUSE
BY_ID: Dict[str, Preset] = {p.id: p for p in PRESETS}

#: Words people and agents actually type, mapped onto ids.
ALIASES: Dict[str, str] = dict(igstyles.ALIASES)
ALIASES.update({
    "cartoonish": "cartoon", "comic": "cartoon", "illustration": "cartoon",
    "picture": "cartoon", "kids": "cartoon", "storybook": "cartoon",
    "photo": "realistic", "photographic": "realistic", "cinematic": "realistic",
    "editorial-photo": "realistic", "premium": "realistic", "lux": "realistic",
})

DEFAULT_PRESET = "sections"


def resolve(name: str) -> Preset:
    """A preset for any name, always: unknown or malformed input returns the
    default, because a cosmetic argument must never kill a render."""
    key = str(name or "").strip().lower().replace("_", "-").replace(" ", "-")
    if key in BY_ID:
        return BY_ID[key]
    if key in ALIASES:
        return BY_ID[ALIASES[key]]
    return BY_ID[DEFAULT_PRESET]


def is_known(name: str) -> bool:
    key = str(name or "").strip().lower().replace("_", "-").replace(" ", "-")
    return key in BY_ID or key in ALIASES


def catalog() -> List[Dict[str, Any]]:
    return [p.as_dict() for p in PRESETS]


def ids() -> List[str]:
    return [p.id for p in PRESETS]


def of_family(family: str) -> List[Preset]:
    return [p for p in PRESETS if p.family == family]


def with_art(art: str) -> List[Preset]:
    return [p for p in PRESETS if p.art == art]


def house_presets() -> List[Preset]:
    """The two treatments this library adds over a plain style pack."""
    return list(_HOUSE)
