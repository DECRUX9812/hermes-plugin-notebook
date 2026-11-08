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
ART = ("none", "cartoon", "plate", "mesh", "clay", "sumi", "deco", "dither", "hud")

#: Layout families the templates know how to fill.
FAMILIES = ("cards", "rows", "poster", "kpi", "feature", "strip")


class Preset:
    """One look. Immutable by convention; the registry is module data."""

    __slots__ = ("id", "label", "blurb", "best_for", "family", "base", "paper", "ink",
                 "muted", "card", "accents", "border", "radius", "typeface", "decor",
                 "kicker", "tone", "art", "default_template")

    def __init__(self, id: str, label: str, blurb: str, best_for: str, family: str,
                 base: str, paper: RGB, ink: RGB, muted: RGB, card: RGB,
                 accents: List[RGB], border: Optional[RGB] = None, radius: int = 0,
                 typeface: str = "sans", decor: Tuple[str, ...] = (),
                 kicker: str = "INFOGRAPHIC", tone: str = "light", art: str = "none",
                 default_template: str = "infographic"):
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
        self.default_template = default_template

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
        decor=("outline", "art"), kicker="IN PICTURES", tone="light", art="cartoon", default_template="cover"),
    Preset(
        "realistic", "Realistic", "Deep neutrals, layered light, soft shadow and film grain.",
        "Reports, product paint, anything that should look photographed rather than drawn.",
        "feature", "house-plate", paper=(0x14, 0x17, 0x1C), ink=(0xF4, 0xF6, 0xF8),
        muted=(0xC2, 0xC9, 0xD3), card=(0x24, 0x2B, 0x35),
        accents=[(0x6E, 0xE7, 0xFF), (0xFF, 0xB4, 0x5C), (0x9C, 0xF5, 0xC0)],
        border=(0x3E, 0x4A, 0x5C), radius=14, typeface="sans",
        decor=("plate", "art"), kicker="OBSERVED", tone="dark", art="plate", default_template="infographic"),
]

#: The second wave. Each one is a different design language, not a recolour: a
#: newspaper page, an annual report, a museum label, a film poster, a data desk, art
#: deco, and three modern treatments (glass, clay, ink wash). Added because "more
#: looks" is only worth anything if the looks are actually different.
_MORE: List[Preset] = [
    Preset(
        "newspaper", "Newspaper", "Salmon stock, serif headline, black rules, one deep red.",
        "Investigations, policy, anything that should read like it went to press.",
        "cards", "ft-salmon", paper=(0xFF, 0xF1, 0xE5), ink=(0x1A, 0x1A, 0x1A),
        muted=(0x5C, 0x55, 0x4D), card=(0xFF, 0xF8, 0xF0),
        accents=[(0x9E, 0x2B, 0x25), (0x0F, 0x54, 0x60)], border=(0xE2, 0xCE, 0xB8),
        radius=0, typeface="serif", decor=("hairline",), kicker="THE BRIEF", default_template="infographic"),
    Preset(
        "annual", "Annual Report", "White grid, navy and gold, small caps, footnoted calm.",
        "Board material, year-in-review, anything that must look audited.",
        "kpi", "annual-report", paper=(0xFF, 0xFF, 0xFF), ink=(0x0E, 0x11, 0x16),
        muted=(0x54, 0x5C, 0x67), card=(0xF7, 0xF8, 0xFA),
        accents=[(0x1F, 0x4E, 0x79), (0xC8, 0xA1, 0x5A), (0x2F, 0x6F, 0x5F)],
        border=(0xDF, 0xE3, 0xE8), radius=0, decor=("hairline", "ticks"),
        kicker="ANNUAL REVIEW", default_template="stat_grid"),
    Preset(
        "museum", "Museum", "Gallery label: hairline rules, tiny caps, enormous margins.",
        "Objects, places, one idea given room — where restraint is the point.",
        "rows", "museum-label", paper=(0xF4, 0xF1, 0xEA), ink=(0x17, 0x16, 0x14),
        muted=(0x6B, 0x63, 0x57), card=(0xFB, 0xF9, 0xF4),
        accents=[(0x7A, 0x6A, 0x55), (0x8C, 0x3B, 0x2E)], border=(0xDD, 0xD6, 0xC7),
        radius=0, decor=("hairline",), kicker="PLATE 01", default_template="quote_card"),
    Preset(
        "film", "Film Poster", "Condensed caps on black, one red accent, a single spotlight.",
        "A launch, a screening, a story with a poster instead of a page.",
        "poster", "film-poster", paper=(0x0B, 0x0B, 0x0C), ink=(0xF5, 0xF3, 0xEE),
        muted=(0xB9, 0xB4, 0xAB), card=(0x15, 0x15, 0x17),
        accents=[(0xE8, 0x45, 0x2B), (0xF5, 0xD0, 0x6F)], border=(0x2C, 0x2C, 0x31),
        radius=0, typeface="condensed", decor=(), kicker="A FILM ABOUT", tone="dark",
        art="plate", default_template="cover"),
    Preset(
        "data-desk", "Data Desk", "White sheet, annotation red, tick marks, chart discipline.",
        "Investigations with numbers, benchmarks, a story told by a chart.",
        "kpi", "data-journalism", paper=(0xFF, 0xFF, 0xFF), ink=(0x10, 0x10, 0x10),
        muted=(0x5A, 0x5A, 0x5A), card=(0xF3, 0xF4, 0xF6),
        accents=[(0xD7, 0x26, 0x3D), (0x1B, 0x99, 0x8B), (0x2B, 0x4C, 0x7E)],
        border=(0xE5, 0xE7, 0xEB), radius=4, decor=("hairline", "ticks"),
        kicker="DATA DESK", default_template="comparison"),
    Preset(
        "deco", "Art Deco", "Black and gold: framed, rayed, symmetrical, theatrical.",
        "Anniversaries, galas, premium covers — when it should feel engraved.",
        "poster", "art-deco", paper=(0x0E, 0x0D, 0x0B), ink=(0xF3, 0xE9, 0xD2),
        muted=(0xC4, 0xB6, 0x92), card=(0x16, 0x14, 0x0F),
        accents=[(0xC9, 0xA2, 0x27), (0xE8, 0xD8, 0xA6)], border=(0x3A, 0x33, 0x24),
        radius=2, typeface="serif", decor=(), kicker="MMXXVI", tone="dark", art="deco", default_template="cover"),
    Preset(
        "glass", "Glass", "Mesh gradient behind frosted panels — modern product light.",
        "Product, AI, SaaS launches; a screenshot that looks like an app.",
        "cards", "mesh-gradient", paper=(0x0B, 0x10, 0x20), ink=(0xF2, 0xF5, 0xFF),
        muted=(0xB6, 0xC2, 0xE0), card=(0x1B, 0x24, 0x40),
        accents=[(0x7C, 0x9C, 0xFF), (0x6E, 0xE7, 0xB7), (0xF0, 0xAB, 0xFC)],
        border=(0x39, 0x46, 0x6B), radius=22, decor=(), kicker="PRODUCT NOTE",
        tone="dark", art="mesh", default_template="stat_grid"),
    Preset(
        "clay", "Clay", "Soft matte tiles with real shadows — tactile, not flat.",
        "Friendly product explainers, onboarding, anything meant to feel touchable.",
        "cards", "claymorphism", paper=(0xF6, 0xEF, 0xE9), ink=(0x2B, 0x21, 0x1C),
        muted=(0x6B, 0x5A, 0x50), card=(0xFF, 0xF9, 0xF4),
        accents=[(0xE8, 0x87, 0x5E), (0x6F, 0xA8, 0x9A), (0x9A, 0x7E, 0xB8)],
        border=None, radius=26, decor=(), kicker="IN SHORT", tone="light", art="clay", default_template="infographic"),
    Preset(
        "sumi", "Ink Wash", "Rice paper, two brush strokes, vermilion seal, serif.",
        "Philosophy, craft, history — material that benefits from silence.",
        "rows", "sumi-e", paper=(0xF7, 0xF4, 0xEC), ink=(0x1A, 0x1A, 0x18),
        muted=(0x63, 0x5D, 0x53), card=(0xFD, 0xFB, 0xF5),
        accents=[(0x2F, 0x3B, 0x45), (0xA3, 0x3B, 0x2B)], border=(0xD9, 0xD2, 0xC3),
        radius=0, typeface="serif", decor=("hairline",), kicker="NOTES", tone="light",
        art="sumi", default_template="quote_card"),
]

#: Third wave, palettes lifted from Open Design's own token files (hud, dithered,
#: theverge, ibm, arc, spacex) rather than invented here. Each keeps that system's
#: signature: HUD brackets, a dot screen, tabloid neon, Carbon structure, Arc warmth,
#: aerospace mono.
_OPEN_DESIGN: List[Preset] = [
    Preset(
        "hud", "HUD", "Phosphor green on black glass, reticle grid, corner brackets.",
        "Systems, telemetry, mission status — data read at a glance.",
        "kpi", "hud", paper=(0x09, 0x0B, 0x12), ink=(0xF8, 0xFA, 0xFC),
        muted=(0x94, 0xA3, 0xB8), card=(0x12, 0x17, 0x22),
        accents=[(0x22, 0xC5, 0x5E), (0xFB, 0xBF, 0x24), (0x60, 0xA5, 0xFA)],
        border=(0x1D, 0x26, 0x36), radius=2, typeface="mono", decor=("ticks",),
        kicker="SYS // STATUS", tone="dark", art="hud", default_template="key_figure"),
    Preset(
        "dither", "Dithered", "Sepia stock, dot screen, halftone band — a two-colour print.",
        "Zines, retro tech, anything that should look printed on an old machine.",
        "poster", "dithered", paper=(0xFF, 0xF4, 0xCF), ink=(0x2A, 0x18, 0x10),
        muted=(0x59, 0x36, 0x25), card=(0xFF, 0xFA, 0xF0),
        accents=[(0xD2, 0x4B, 0x1F), (0x3D, 0x8F, 0x4F), (0xF2, 0xA9, 0x3B)],
        border=(0xD9, 0xAA, 0x7A), radius=0, decor=(), kicker="PRINTED 1-BIT",
        tone="light", art="dither", default_template="timeline"),
    Preset(
        "verge", "Tabloid", "Black, neon pink, yellow — a technology cover that shouts.",
        "Reviews, launches, opinion — where the cover is the argument.",
        "poster", "theverge", paper=(0x05, 0x05, 0x05), ink=(0xFF, 0xFF, 0xFF),
        muted=(0x9C, 0xA3, 0xAF), card=(0x11, 0x11, 0x11),
        accents=[(0xFF, 0x00, 0xA8), (0xFA, 0xCC, 0x15), (0x22, 0xC5, 0x5E)],
        border=(0x2B, 0x2B, 0x2B), radius=0, decor=(), kicker="THE COVER STORY",
        tone="dark", default_template="cover"),
    Preset(
        "carbon", "Carbon", "IBM structure: white sheet, 1px grid, one blue, mono labels.",
        "Enterprise, engineering, process documentation that must look exact.",
        "rows", "ibm", paper=(0xFF, 0xFF, 0xFF), ink=(0x16, 0x16, 0x16),
        muted=(0x52, 0x52, 0x52), card=(0xF4, 0xF4, 0xF4),
        accents=[(0x0F, 0x62, 0xFE), (0x24, 0xA1, 0x48), (0xF1, 0xC2, 0x1B)],
        border=(0xE0, 0xE0, 0xE0), radius=0, typeface="sans",
        decor=("hairline", "ticks", "grid"), kicker="CARBON", default_template="process"),
    Preset(
        "arc", "Arc", "Warm pastel mesh behind soft white panels — friendly and modern.",
        "Product explainers, onboarding, anything that should feel inviting.",
        "cards", "arc", paper=(0xFD, 0xF3, 0xEC), ink=(0x1A, 0x1A, 0x1F),
        muted=(0x54, 0x54, 0x5A), card=(0xFF, 0xFF, 0xFF),
        accents=[(0xFF, 0x5F, 0x5F), (0xFF, 0x7E, 0x5F), (0xFE, 0xB4, 0x7B)],
        border=(0xEC, 0xE5, 0xDB), radius=18, decor=(), kicker="A SHORT TOUR",
        tone="light", art="mesh", default_template="infographic"),
    Preset(
        "aero", "Aerospace", "Black, hairline, mono specs — a mission sheet that says nothing extra.",
        "Hardware, spacecraft, launch sequences, industrial previews.",
        "kpi", "spacex", paper=(0x00, 0x00, 0x00), ink=(0xF0, 0xF0, 0xFA),
        muted=(0xA8, 0xA8, 0xB8), card=(0x0A, 0x0A, 0x0C),
        accents=[(0x16, 0xA3, 0x4A), (0xEA, 0xB3, 0x08), (0xDC, 0x26, 0x26)],
        border=(0x1A, 0x1A, 0x1E), radius=0, typeface="mono",
        decor=("hairline", "ticks"), kicker="MISSION // TIDAL", tone="dark", default_template="key_figure"),
]

#: Fourth wave, from Meta's Astryx design system (MIT): the palettes are that
#: project's own theme seeds — butter, matcha, gothic, y2k, stone — not invented
#: here. Astryx ships 150+ components and eight themes precisely so a product can
#: change voice without changing structure; these five looks borrow the voices.
_ASTRYX: List[Preset] = [
    Preset(
        "butter", "Butter", "Warm cream stock, cobalt numerals, butter-yellow highlight.",
        "Bright explainers, product tours, anything with a friendly, sure tone.",
        "cards", "astryx-butter", paper=(0xFF, 0xFD, 0xF4), ink=(0x1D, 0x1C, 0x11),
        muted=(0x5C, 0x5A, 0x46), card=(0xFF, 0xFF, 0xFF),
        accents=[(0x22, 0x5B, 0xFF), (0xFF, 0xA3, 0x47), (0xFD, 0xEE, 0x8C)],
        border=(0xED, 0xE7, 0xCE), radius=12, decor=(), kicker="BUTTER",
        tone="light", default_template="stat_grid",
    ),
    Preset(
        "matcha", "Matcha", "Pale green paper, deep olive type, clay and teal accents.",
        "Sustainability, food, slow research, calm evidence.",
        "cards", "astryx-matcha", paper=(0xF3, 0xF5, 0xE9), ink=(0x1E, 0x26, 0x16),
        muted=(0x5A, 0x6B, 0x2A), card=(0xFB, 0xFD, 0xF3),
        accents=[(0x4D, 0x99, 0x00), (0xC4, 0x76, 0x20), (0x2E, 0x6B, 0x5A)],
        border=(0xDC, 0xE3, 0xC6), radius=6, decor=("hairline",), kicker="MATCHA",
        tone="light", default_template="comparison",
    ),
    Preset(
        "gothic", "Gothic", "Charcoal stone, muted jewel accents, serif, hairline rules.",
        "Archives, history, literature — a page that reads as printed and old.",
        "rows", "astryx-gothic", paper=(0x0E, 0x11, 0x13), ink=(0xE8, 0xEA, 0xEC),
        muted=(0x98, 0xA0, 0xA8), card=(0x16, 0x1B, 0x1E),
        accents=[(0xA3, 0x63, 0xBD), (0x6A, 0x9E, 0xB1), (0xC8, 0x7A, 0x4A)],
        border=(0x26, 0x2C, 0x30), radius=0, typeface="serif",
        decor=("hairline",), kicker="GOTHIC", tone="dark", default_template="quote_card",
    ),
    Preset(
        "y2k", "Y2K", "Cream page, hyper-saturated cyan, pink and lime, glossy radii.",
        "Launches, drops, culture — loud, optimistic, unmistakably now.",
        "poster", "astryx-y2k", paper=(0xFF, 0xF6, 0xED), ink=(0x17, 0x1A, 0x24),
        muted=(0x5D, 0x5A, 0x66), card=(0xFF, 0xFF, 0xFF),
        accents=[(0x00, 0xA8, 0xFF), (0xFF, 0x72, 0xB6), (0xC5, 0xE1, 0x7A)],
        border=(0xE9, 0xDF, 0xD3), radius=20, decor=(), kicker="Y2K.01",
        tone="light", default_template="cover",
    ),
    Preset(
        "stone", "Stone", "Warm grey sheet, muted clay and sage, mono labels, no radius.",
        "Field reports, specs, quiet technical notes that still look designed.",
        "rows", "astryx-stone", paper=(0xF4, 0xF3, 0xF1), ink=(0x25, 0x25, 0x2A),
        muted=(0x6E, 0x6E, 0x76), card=(0xFF, 0xFF, 0xFF),
        accents=[(0x8F, 0x71, 0x54), (0x52, 0x8B, 0x49), (0x6C, 0x78, 0x88)],
        border=(0xE2, 0xE2, 0xE8), radius=2, typeface="mono",
        decor=("hairline", "ticks"), kicker="STONE", tone="light",
        default_template="infographic",
    ),
]

PRESETS: List[Preset] = ([_from_style(s) for s in igstyles.STYLES] + _HOUSE + _MORE
                         + _OPEN_DESIGN + _ASTRYX)
BY_ID: Dict[str, Preset] = {p.id: p for p in PRESETS}

#: Words people and agents actually type, mapped onto ids.
ALIASES: Dict[str, str] = dict(igstyles.ALIASES)
ALIASES.update({
    "cartoonish": "cartoon", "comic": "cartoon", "illustration": "cartoon",
    "picture": "cartoon", "kids": "cartoon", "storybook": "cartoon",
    "photo": "realistic", "photographic": "realistic", "cinematic": "realistic",
    "editorial-photo": "realistic", "premium": "realistic", "lux": "realistic",
    "ft": "newspaper", "financial": "newspaper", "press": "newspaper", "broadsheet": "newspaper",
    "report": "annual", "corporate-report": "annual", "investor": "annual",
    "gallery": "museum", "label": "museum", "minimal-museum": "museum",
    "filmposter": "film", "cinema": "film", "screening": "film", "noir": "film",
    "data": "data-desk", "journalism": "data-desk", "pudding": "data-desk",
    "gatsby": "deco", "artdeco": "deco", "gala": "deco", "gold": "deco",
    "frosted": "glass", "saas": "glass", "product": "glass", "mesh": "glass",
    "claymorphism": "clay", "soft": "clay", "tactile": "clay",
    "ink": "sumi", "wash": "sumi", "zen": "sumi", "brush": "sumi",
    "jet": "hud", "cockpit": "hud", "telemetry": "hud", "fighter": "hud",
    "1bit": "dither", "halftone": "dither", "zine": "dither", "printer": "dither",
    "the-verge": "verge", "tabloid": "verge", "neon-pink": "verge",
    "ibm-carbon": "carbon", "enterprise": "carbon", "carbon-grid": "carbon",
    "arc-browser": "arc", "pastel": "arc", "soft-gradient": "arc",
    "spacex": "aero", "space": "aero", "launch": "aero", "rocket": "aero",
    "astryx": "butter", "meta": "butter", "meta-design": "butter",
    "green": "matcha", "olive": "matcha", "sustainable": "matcha",
    "dark-serif": "gothic", "archive": "gothic", "literary": "gothic",
    "y2k-aesthetic": "y2k", "hyperpop": "y2k", "drop": "y2k",
    "field-report": "stone", "spec": "stone", "technical": "stone",
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

#: Which composition a look reaches for when the caller does not choose one. Without
#: this, 33 looks are three layouts in 33 skins.
_TEMPLATE_FOR = {
    "newspaper": "infographic", "annual": "stat_grid", "museum": "quote_card",
    "film": "cover", "data-desk": "comparison", "deco": "cover", "glass": "stat_grid",
    "clay": "infographic", "sumi": "quote_card", "hud": "key_figure",
    "dither": "timeline", "verge": "cover", "carbon": "process", "arc": "infographic",
    "aero": "key_figure", "cartoon": "cover", "realistic": "infographic",
    "editorial": "infographic", "poster": "cover", "swiss": "process",
    "magazine": "quote_card", "bento": "stat_grid", "blueprint": "process",
    "terminal": "key_figure", "neon": "cover", "brutalist": "stat_grid",
    "retro": "timeline", "risograph": "comparison", "kraft": "quote_card",
    "chalkboard": "timeline", "dashboard": "stat_grid", "mission": "key_figure",
    "sections": "infographic",
}

for _p in PRESETS:
    _t = _TEMPLATE_FOR.get(_p.id)
    if _t and _p.default_template != _t:
        _p.default_template = _t
