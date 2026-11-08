"""Infographic style pack — the bundled looks the Infographic artifact can wear.

One place decides what a style *is*: a palette, a typeface, a layout family and
a short list of decorative treatments. The renderer (`igrender.py`) reads these
specs and knows nothing else, so adding a style is data, not code.

Palettes are taken from real design systems (the `base` field names the one it
came from) so the looks are borrowed from something that already shipped and
held up, rather than invented here.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

RGB = Tuple[int, int, int]

#: Layout families the renderer implements. `cards` = tiled stat blocks,
#: `rows` = editorial rows with oversized numerals, `poster` = dark band with a
#: single accent, `kpi` = dashboard tiles with bar meters.
FAMILIES = ("cards", "rows", "poster", "kpi")

#: Decorations, applied on top of any family. Keep them cheap: each one is a
#: handful of draw calls, not a texture pass.
DECOR = ("grid", "hairline", "halftone", "tape", "glow", "scanlines",
         "hard-border", "offset-shadow", "wobble", "overprint", "ticks")


class Style:
    """One infographic look. Immutable by convention — the catalog is module data."""

    __slots__ = ("id", "label", "blurb", "best_for", "family", "base", "paper",
                 "ink", "muted", "card", "accents", "border", "radius",
                 "typeface", "decor", "kicker", "tone")

    def __init__(self, id: str, label: str, blurb: str, best_for: str, family: str,
                 base: str, paper: RGB, ink: RGB, muted: RGB, card: RGB,
                 accents: List[RGB], border: Optional[RGB] = None, radius: int = 0,
                 typeface: str = "sans", decor: Tuple[str, ...] = (),
                 kicker: str = "INFOGRAPHIC", tone: str = "light"):
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

    def hexes(self) -> List[str]:
        return [_hx(c) for c in [self.paper, self.card, *self.accents[:3], self.ink]]

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id, "label": self.label, "blurb": self.blurb,
            "best_for": self.best_for, "family": self.family, "base": self.base,
            "tone": self.tone, "typeface": self.typeface,
            "swatch": self.hexes(),
        }


def _hx(c: RGB) -> str:
    return "#%02x%02x%02x" % (int(c[0]), int(c[1]), int(c[2]))


# --------------------------------------------------------------------- catalog
# Ordered as the picker draws them: the safe defaults first, then the loud ones.

STYLES: List[Style] = [
    Style(
        "sections", "Sections", "Warm paper, white stat cards, one accent per card.",
        "The default. Any topic, any audience — reads like NotebookLM's own output.",
        "cards", "notebooklm", paper=(0xFA, 0xF9, 0xF6), ink=(0x1F, 0x1F, 0x1F),
        muted=(0x5F, 0x63, 0x68), card=(0xFF, 0xFF, 0xFF),
        accents=[(0x1A, 0x73, 0xE8), (0xE8, 0x71, 0x0B), (0x12, 0x87, 0x7B),
                 (0xC5, 0x18, 0x5B), (0x7C, 0x4D, 0xFF)],
        border=(0xE4, 0xDF, 0xD6), radius=16,
    ),
    Style(
        "editorial", "Editorial", "White page, oversized numerals, hairline rules, one accent.",
        "Numbers that carry the story: results, milestones, before/after.",
        "rows", "editorial", paper=(0xFF, 0xFF, 0xFF), ink=(0x1F, 0x1F, 0x1F),
        muted=(0x6B, 0x6B, 0x6B), card=(0xFF, 0xFF, 0xFF),
        accents=[(0x1A, 0x73, 0xE8)], border=(0xE4, 0xE4, 0xE0), radius=0,
        decor=("hairline",),
    ),
    Style(
        "poster", "Poster", "Dark indigo gradient, one accent, facts in a strip.",
        "A launch, an announcement, a single idea that should feel like a cover.",
        "poster", "notebooklm-dark", paper=(0x1B, 0x1B, 0x3A), ink=(0xF4, 0xF4, 0xFA),
        muted=(0xB9, 0xB9, 0xD6), card=(0x12, 0x12, 0x20),
        accents=[(0x8B, 0x7C, 0xFF)], radius=14, tone="dark",
    ),
    Style(
        "swiss", "Swiss Grid", "Helvetica discipline: strict columns, black type, red rule.",
        "Comparisons, methodology, anything that should look unarguable.",
        "rows", "publication", paper=(0xFF, 0xFF, 0xFF), ink=(0x0B, 0x0B, 0x0B),
        muted=(0x6B, 0x6B, 0x6B), card=(0xF6, 0xF6, 0xF6),
        accents=[(0xC1, 0x12, 0x1F)], border=(0xD6, 0xD6, 0xD6), radius=0,
        decor=("hairline", "ticks"), kicker="INFOGRAPHIC / DATA",
    ),
    Style(
        "magazine", "Magazine", "Warm cream, serif headlines, brown accents, wide margins.",
        "Culture, history, interviews — long-read material that needs to feel edited.",
        "cards", "warm-editorial", paper=(0xFB, 0xF6, 0xEE), ink=(0x20, 0x19, 0x14),
        muted=(0x6E, 0x5F, 0x52), card=(0xFF, 0xFD, 0xF8),
        accents=[(0x9B, 0x5B, 0x32), (0x1F, 0x3A, 0x5F)], border=(0xDE, 0xD2, 0xC3),
        radius=2, typeface="serif", decor=("hairline",),
    ),
    Style(
        "bento", "Bento", "Mosaic of rounded tiles on cool paper, blue-led accents.",
        "A roundup: five or six parallel facts that each deserve their own box.",
        "cards", "bento", paper=(0xF5, 0xF8, 0xFF), ink=(0x10, 0x18, 0x28),
        muted=(0x47, 0x54, 0x67), card=(0xFF, 0xFF, 0xFF),
        accents=[(0x25, 0x63, 0xEB), (0x7C, 0x3A, 0xED), (0x08, 0x91, 0xB2),
                 (0xDB, 0x27, 0x77)],
        border=(0xD7, 0xE0, 0xEF), radius=20,
    ),
    Style(
        "blueprint", "Blueprint", "Deep navy grid, white hairlines, monospace labels.",
        "Engineering, architecture, systems, anything with a spec and a tolerance.",
        "cards", "technical-schematic", paper=(0x0B, 0x25, 0x45), ink=(0xEA, 0xF2, 0xFF),
        muted=(0x9F, 0xB6, 0xD4), card=(0x10, 0x2E, 0x52),
        accents=[(0x7F, 0xB2, 0xFF), (0xFF, 0xD1, 0x66)], border=(0x2E, 0x54, 0x84),
        radius=0, typeface="mono", decor=("grid", "ticks"), tone="dark",
        kicker="SPEC SHEET",
    ),
    Style(
        "terminal", "Terminal", "Near-black, phosphor blue, monospace, prompt rules.",
        "Developer tools, incident write-ups, logs and throughput numbers.",
        "rows", "trading-terminal", paper=(0x07, 0x0B, 0x12), ink=(0xE6, 0xED, 0xF6),
        muted=(0x8A, 0x97, 0xA8), card=(0x10, 0x18, 0x26),
        accents=[(0x38, 0xBD, 0xF8), (0x22, 0xC5, 0x5E)], border=(0x26, 0x32, 0x46),
        radius=4, typeface="mono", decor=("scanlines",), tone="dark",
        kicker="OUTPUT",
    ),
    Style(
        "neon", "Neon", "Black-violet field with glowing magenta and cyan accents.",
        "AI, gaming, nightlife, a launch that wants to feel loud and new.",
        "poster", "neon", paper=(0x07, 0x07, 0x11), ink=(0xF8, 0xF7, 0xFF),
        muted=(0xB9, 0xAE, 0xE0), card=(0x11, 0x11, 0x26),
        accents=[(0xC0, 0x84, 0xFC), (0x22, 0xD3, 0xEE), (0xF4, 0x72, 0xB6)],
        radius=18, decor=("glow",), tone="dark", kicker="INFOGRAPHIC",
    ),
    Style(
        "brutalist", "Brutalist", "Hard black borders, no radius, acid-yellow highlight.",
        "Manifestos, takes, pricing pages — content with an attitude.",
        "cards", "brutalism", paper=(0xF5, 0xF1, 0xE8), ink=(0x00, 0x00, 0x00),
        muted=(0x33, 0x33, 0x33), card=(0xFF, 0xFF, 0xFF),
        accents=[(0xFF, 0xEF, 0x5A), (0xFF, 0x8C, 0x00)], border=(0x00, 0x00, 0x00),
        radius=0, decor=("hard-border", "offset-shadow"), kicker="INFO / GRAPHIC",
    ),
    Style(
        "retro", "Retro Print", "Cream stock, halftone dots, warm 70s palette.",
        "History, music, sport, anything with a nostalgic streak.",
        "cards", "retro", paper=(0xFF, 0xF4, 0xCF), ink=(0x2A, 0x18, 0x10),
        muted=(0x59, 0x36, 0x25), card=(0xFF, 0xFA, 0xF0),
        accents=[(0xD2, 0x4B, 0x1F), (0x1F, 0x6F, 0x5C), (0x2A, 0x4B, 0x8D)],
        border=(0xD9, 0xAA, 0x7A), radius=12,
        decor=("halftone", "offset-shadow"), kicker="THE FACTS",
    ),
    Style(
        "risograph", "Risograph", "Two-ink overprint on cream, deliberately off-register.",
        "Zines, research roundups, a poster that should look screen-printed.",
        "cards", "riso", paper=(0xF6, 0xF1, 0xE7), ink=(0x16, 0x22, 0x3B),
        muted=(0x4A, 0x51, 0x66), card=(0xFB, 0xF7, 0xEF),
        accents=[(0x1B, 0x3A, 0x8F), (0xFF, 0x4F, 0x2E), (0xF2, 0xC2, 0x30)],
        border=(0x16, 0x22, 0x3B), radius=0, decor=("overprint",),
        kicker="FIELD NOTES",
    ),
    Style(
        "kraft", "Kraft", "Taped paper cards on kraft stock, brown ink, soft serif.",
        "Field notes, workshops, a handmade brief pinned to a board.",
        "cards", "paper", paper=(0xFA, 0xF3, 0xDF), ink=(0x21, 0x1B, 0x12),
        muted=(0x50, 0x47, 0x37), card=(0xFF, 0xFA, 0xF0),
        accents=[(0x8F, 0x5D, 0x24), (0x6B, 0x7A, 0x4F)], border=(0xDD, 0xD0, 0xB4),
        radius=6, typeface="serif", decor=("tape",),
    ),
    Style(
        "chalkboard", "Chalkboard", "Slate green board, chalk white, wobbly hand rules.",
        "Teaching, a lecture summary, a study poster for a classroom.",
        "rows", "chalkboard", paper=(0x22, 0x30, 0x2A), ink=(0xEE, 0xF2, 0xEA),
        muted=(0xA9, 0xB8, 0xAE), card=(0x22, 0x30, 0x2A),
        accents=[(0xF2, 0xE9, 0xA0), (0xA9, 0xD8, 0xC0), (0xF0, 0xB4, 0xB4)],
        border=(0x3A, 0x4C, 0x43), radius=0, decor=("wobble",), tone="dark",
        kicker="ON THE BOARD",
    ),
    Style(
        "dashboard", "Dashboard", "Cool grey-white KPI tiles with bar meters and deltas.",
        "Metrics, benchmarks, a status readout where the numbers are the point.",
        "kpi", "dashboard", paper=(0xF4, 0xF7, 0xFB), ink=(0x11, 0x18, 0x27),
        muted=(0x47, 0x55, 0x69), card=(0xFF, 0xFF, 0xFF),
        accents=[(0x0E, 0xA5, 0xE9), (0x22, 0xC5, 0x5E), (0xF5, 0x9E, 0x0B),
                 (0xEF, 0x44, 0x44)],
        border=(0xD8, 0xE2, 0xEE), radius=14, kicker="SNAPSHOT",
    ),
    Style(
        "mission", "Mission Control", "Dark console: blue, amber and green telemetry tiles.",
        "Ops, infrastructure, a fleet or a system under load.",
        "kpi", "mission-control", paper=(0x09, 0x0B, 0x12), ink=(0xF8, 0xFA, 0xFC),
        muted=(0xCB, 0xD5, 0xE1), card=(0x12, 0x17, 0x22),
        accents=[(0x60, 0xA5, 0xFA), (0xFB, 0xBF, 0x24), (0x34, 0xD3, 0x99)],
        border=(0x2A, 0x34, 0x47), radius=12, typeface="mono",
        decor=("grid", "ticks"), tone="dark", kicker="TELEMETRY",
    ),
]

BY_ID: Dict[str, Style] = {s.id: s for s in STYLES}

#: Friendly names an agent or a person might type instead of the id.
ALIASES: Dict[str, str] = {
    "default": "sections", "cards": "sections", "notebooklm": "sections",
    "clean": "sections", "light": "sections",
    "plain": "editorial", "minimal": "editorial", "big-numbers": "editorial",
    "dark": "poster", "gradient": "poster", "cover": "poster",
    "swiss-grid": "swiss", "international": "swiss", "helvetica": "swiss",
    "data": "swiss", "report": "swiss",
    "serif": "magazine", "warm": "magazine", "editorial-magazine": "magazine",
    "tiles": "bento", "grid-bento": "bento", "mosaic": "bento",
    "schematic": "blueprint", "technical": "blueprint", "engineering": "blueprint",
    "blueprint-grid": "blueprint", "cad": "blueprint",
    "mono": "terminal", "console": "terminal", "code": "terminal",
    "trading": "terminal", "dev": "terminal",
    "cyberpunk": "neon", "glow": "neon", "vaporwave": "neon", "night": "neon",
    "brutalism": "brutalist", "neo-brutalist": "brutalist", "neobrutalism": "brutalist",
    "raw": "brutalist",
    "retro-print": "retro", "70s": "retro", "vintage": "retro", "halftone": "retro",
    "riso": "risograph", "zine": "risograph", "print": "risograph",
    "paper": "kraft", "handmade": "kraft", "craft": "kraft", "field-notes": "kraft",
    "chalk": "chalkboard", "classroom": "chalkboard", "education": "chalkboard",
    "kpi": "dashboard", "metrics": "dashboard", "stats": "dashboard",
    "mission-control": "mission", "ops": "mission", "telemetry": "mission",
    "hud": "mission", "console-dark": "mission",
}

DEFAULT_STYLE = "sections"


#: Sample payload for previews and the contact sheet. Invented on purpose: a style
#: preview must never look like a claim about the user's own notebook.
SAMPLE_DATA: Dict[str, Any] = {
    "title": "Tidal power — the three facts that decide a project",
    "takeaway": "Output is set by the site, the cost by the cable, and the schedule "
                "by the consent — in that order.",
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

SAMPLE_TITLE = "Tidal power — the three facts that decide a project"



def resolve(name: str) -> Style:
    """Style for a user/agent-supplied name. Unknown names fall back to the default
    rather than failing a generation run over a typo."""
    key = (name or "").strip().lower().replace("_", "-").replace(" ", "-")
    if key in BY_ID:
        return BY_ID[key]
    if key in ALIASES:
        return BY_ID[ALIASES[key]]
    return BY_ID[DEFAULT_STYLE]


def is_known(name: str) -> bool:
    key = (name or "").strip().lower().replace("_", "-").replace(" ", "-")
    return key in BY_ID or key in ALIASES


def catalog() -> List[Dict[str, Any]]:
    """What the page and the tools list: id, label, blurb, family, swatch hexes."""
    return [s.as_dict() for s in STYLES]


def ids() -> List[str]:
    return [s.id for s in STYLES]


def prompt_hint(style: Style) -> str:
    """One line of content guidance for the model, per family — a dashboard wants
    different items than an editorial page, even from the same sources."""
    if style.family == "kpi":
        return ("Favour 4-6 comparable metrics, each a number with a unit and a short "
                "label; avoid facts that cannot be measured.")
    if style.family == "rows":
        return ("Favour 3-5 headline numbers or dates that can carry a whole row on "
                "their own; keep labels under 8 words.")
    if style.family == "poster":
        return ("Favour one dominant number or claim, then 2-3 supporting facts; keep "
                "everything short enough to read at a glance.")
    return ("Favour 4-6 distinct facts that each fit a card; mix a number, a date and "
            "a named entity so the cards do not look repetitive.")
