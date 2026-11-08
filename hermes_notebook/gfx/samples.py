"""Sample payloads — the library's own examples.

Used by the docs sheets, the snapshot tests and the picker's fallback preview. All
invented: a sample must never be mistaken for a real notebook's output. Keeping one
copy here is what makes the sheets, the snapshots and the previews comparable.
"""

from __future__ import annotations

from typing import Any, Dict

#: The worked example every sheet and snapshot uses.
SAMPLE_GRAPHIC: Dict[str, Any] = {
    "title": "Tidal power — the three facts that decide a project",
    "takeaway": "Output is set by the site, the cost by the cable, and the schedule "
                "by the consent — in that order.",
    "subtitle": "A worked example of the pack",
    "source": "sample data — not a real notebook",
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
    "events": [
        {"when": "2019", "what": "Site survey completed"},
        {"when": "2021", "what": "Consent submitted"},
        {"when": "2023", "what": "Cable route agreed"},
        {"when": "2025", "what": "First power"},
    ],
    "steps": [
        {"title": "Survey", "text": "Two years of current data."},
        {"title": "Design", "text": "Array and cable route."},
        {"title": "Consent", "text": "The long pole."},
        {"title": "Build", "text": "Install and commission."},
    ],
    "left": {"title": "Tidal", "score": "38% CF",
             "items": [{"text": "Predictable output"}, {"text": "High capex"}]},
    "right": {"title": "Offshore wind", "score": "45% CF",
              "items": [{"text": "Variable output"}, {"text": "Cheaper per MW"}]},
}

#: A three-line payload for edge-case examples.
SAMPLE_SMALL: Dict[str, Any] = {
    "title": "One number, one sentence",
    "takeaway": "The shortest useful graphic.",
    "stats": [{"value": "62%", "label": "of readers never scroll"}],
    "quotes": [{"text": "A single figure beats a paragraph.", "source": "sample"}],
}
