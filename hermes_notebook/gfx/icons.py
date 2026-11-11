"""Lucide icon path data for block icons (24x24 stroke icons).

``KEYS`` is the schema enum for ``block.items[].icon`` — like
``isometrics.KINDS``, the renderer and the schema cannot drift. Data is
extracted from lucide-react: each key maps to a list of (tag, attrs)
element tuples rendered with ``stroke`` (never ``fill``), matching the
Lucide contract. Unknown keys fall back to ``circle`` so a model typo
degrades instead of crashing a render.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

Element = Tuple[str, Dict[str, str]]

KEYS: Tuple[str, ...] = (
    "activity",
    "zap",
    "atom",
    "shield",
    "flask",
    "factory",
    "globe",
    "clock",
    "users",
    "dollar-sign",
    "circle-check",
    "triangle-alert",
    "arrow-right",
    "target",
    "gauge",
    "battery",
    "sun",
    "wind",
    "droplets",
    "layers-3",
    "rocket",
    "cpu",
    "network",
    "building-2",
    "scale",
    "lock",
    "key",
    "calendar",
    "map-pin",
    "lightbulb",
    "message",
    "file-text",
    "database",
    "layers",
    "link",
    "search",
    "trending-up",
    "trending-down",
    "percent",
    "hash",
    "package",
    "shopping-cart",
    "wallet",
    "landmark",
    "newspaper",
)

_ICONS: Dict[str, List[Element]] = {
    "activity": [
        ("path", {'d': 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2'}),
    ],
    "zap": [
        ("path", {'d': 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'}),
    ],
    "atom": [
        ("circle", {'cx': '12', 'cy': '12', 'r': '1'}),
        ("path", {'d': 'M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z'}),
        ("path", {'d': 'M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z'}),
    ],
    "shield": [
        ("path", {'d': 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'}),
    ],
    "flask": [
        ("path", {'d': 'M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2'}),
        ("path", {'d': 'M6.453 15h11.094'}),
        ("path", {'d': 'M8.5 2h7'}),
    ],
    "factory": [
        ("path", {'d': 'M12 16h.01'}),
        ("path", {'d': 'M16 16h.01'}),
        ("path", {'d': 'M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z'}),
        ("path", {'d': 'M8 16h.01'}),
    ],
    "globe": [
        ("circle", {'cx': '12', 'cy': '12', 'r': '10'}),
        ("path", {'d': 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'}),
        ("path", {'d': 'M2 12h20'}),
    ],
    "clock": [
        ("circle", {'cx': '12', 'cy': '12', 'r': '10'}),
        ("path", {'d': 'M12 6v6l4 2'}),
    ],
    "users": [
        ("path", {'d': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'}),
        ("path", {'d': 'M16 3.128a4 4 0 0 1 0 7.744'}),
        ("path", {'d': 'M22 21v-2a4 4 0 0 0-3-3.87'}),
        ("circle", {'cx': '9', 'cy': '7', 'r': '4'}),
    ],
    "dollar-sign": [
        ("line", {'x1': '12', 'x2': '12', 'y1': '2', 'y2': '22'}),
        ("path", {'d': 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'}),
    ],
    "circle-check": [
        ("circle", {'cx': '12', 'cy': '12', 'r': '10'}),
        ("path", {'d': 'm9 12 2 2 4-4'}),
    ],
    "triangle-alert": [
        ("path", {'d': 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'}),
        ("path", {'d': 'M12 9v4'}),
        ("path", {'d': 'M12 17h.01'}),
    ],
    "arrow-right": [
        ("path", {'d': 'M5 12h14'}),
        ("path", {'d': 'm12 5 7 7-7 7'}),
    ],
    "target": [
        ("circle", {'cx': '12', 'cy': '12', 'r': '10'}),
        ("circle", {'cx': '12', 'cy': '12', 'r': '6'}),
        ("circle", {'cx': '12', 'cy': '12', 'r': '2'}),
    ],
    "gauge": [
        ("path", {'d': 'm12 14 4-4'}),
        ("path", {'d': 'M3.34 19a10 10 0 1 1 17.32 0'}),
    ],
    "battery": [
        ("path", {'d': 'M 22 14 L 22 10'}),
        ("rect", {'x': '2', 'y': '6', 'width': '16', 'height': '12', 'rx': '2'}),
    ],
    "sun": [
        ("circle", {'cx': '12', 'cy': '12', 'r': '4'}),
        ("path", {'d': 'M12 2v2'}),
        ("path", {'d': 'M12 20v2'}),
        ("path", {'d': 'm4.93 4.93 1.41 1.41'}),
        ("path", {'d': 'm17.66 17.66 1.41 1.41'}),
        ("path", {'d': 'M2 12h2'}),
        ("path", {'d': 'M20 12h2'}),
        ("path", {'d': 'm6.34 17.66-1.41 1.41'}),
        ("path", {'d': 'm19.07 4.93-1.41 1.41'}),
    ],
    "wind": [
        ("path", {'d': 'M12.8 19.6A2 2 0 1 0 14 16H2'}),
        ("path", {'d': 'M17.5 8a2.5 2.5 0 1 1 2 4H2'}),
        ("path", {'d': 'M9.8 4.4A2 2 0 1 1 11 8H2'}),
    ],
    "droplets": [
        ("path", {'d': 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z'}),
        ("path", {'d': 'M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97'}),
    ],
    "layers-3": [
        ("path", {'d': 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z'}),
        ("path", {'d': 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12'}),
        ("path", {'d': 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17'}),
    ],
    "rocket": [
        ("path", {'d': 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5'}),
        ("path", {'d': 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09'}),
        ("path", {'d': 'M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z'}),
        ("path", {'d': 'M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05'}),
    ],
    "cpu": [
        ("path", {'d': 'M12 20v2'}),
        ("path", {'d': 'M12 2v2'}),
        ("path", {'d': 'M17 20v2'}),
        ("path", {'d': 'M17 2v2'}),
        ("path", {'d': 'M2 12h2'}),
        ("path", {'d': 'M2 17h2'}),
        ("path", {'d': 'M2 7h2'}),
        ("path", {'d': 'M20 12h2'}),
        ("path", {'d': 'M20 17h2'}),
        ("path", {'d': 'M20 7h2'}),
        ("path", {'d': 'M7 20v2'}),
        ("path", {'d': 'M7 2v2'}),
        ("rect", {'x': '4', 'y': '4', 'width': '16', 'height': '16', 'rx': '2'}),
        ("rect", {'x': '8', 'y': '8', 'width': '8', 'height': '8', 'rx': '1'}),
    ],
    "network": [
        ("rect", {'x': '16', 'y': '16', 'width': '6', 'height': '6', 'rx': '1'}),
        ("rect", {'x': '2', 'y': '16', 'width': '6', 'height': '6', 'rx': '1'}),
        ("rect", {'x': '9', 'y': '2', 'width': '6', 'height': '6', 'rx': '1'}),
        ("path", {'d': 'M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3'}),
        ("path", {'d': 'M12 12V8'}),
    ],
    "building-2": [
        ("path", {'d': 'M10 12h4'}),
        ("path", {'d': 'M10 8h4'}),
        ("path", {'d': 'M14 21v-3a2 2 0 0 0-4 0v3'}),
        ("path", {'d': 'M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2'}),
        ("path", {'d': 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16'}),
    ],
    "scale": [
        ("path", {'d': 'M12 3v18'}),
        ("path", {'d': 'm19 8 3 8a5 5 0 0 1-6 0zV7'}),
        ("path", {'d': 'M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1'}),
        ("path", {'d': 'm5 8 3 8a5 5 0 0 1-6 0zV7'}),
        ("path", {'d': 'M7 21h10'}),
    ],
    "lock": [
        ("rect", {'width': '18', 'height': '11', 'x': '3', 'y': '11', 'rx': '2', 'ry': '2'}),
        ("path", {'d': 'M7 11V7a5 5 0 0 1 10 0v4'}),
    ],
    "key": [
        ("path", {'d': 'm15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4'}),
        ("path", {'d': 'm21 2-9.6 9.6'}),
        ("circle", {'cx': '7.5', 'cy': '15.5', 'r': '5.5'}),
    ],
    "calendar": [
        ("path", {'d': 'M8 2v4'}),
        ("path", {'d': 'M16 2v4'}),
        ("rect", {'width': '18', 'height': '18', 'x': '3', 'y': '4', 'rx': '2'}),
        ("path", {'d': 'M3 10h18'}),
    ],
    "map-pin": [
        ("path", {'d': 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'}),
        ("circle", {'cx': '12', 'cy': '10', 'r': '3'}),
    ],
    "lightbulb": [
        ("path", {'d': 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5'}),
        ("path", {'d': 'M9 18h6'}),
        ("path", {'d': 'M10 22h4'}),
    ],
    "message": [
        ("path", {'d': 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z'}),
    ],
    "file-text": [
        ("path", {'d': 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'}),
        ("path", {'d': 'M14 2v5a1 1 0 0 0 1 1h5'}),
        ("path", {'d': 'M10 9H8'}),
        ("path", {'d': 'M16 13H8'}),
        ("path", {'d': 'M16 17H8'}),
    ],
    "database": [
        ("ellipse", {'cx': '12', 'cy': '5', 'rx': '9', 'ry': '3'}),
        ("path", {'d': 'M3 5V19A9 3 0 0 0 21 19V5'}),
        ("path", {'d': 'M3 12A9 3 0 0 0 21 12'}),
    ],
    "layers": [
        ("path", {'d': 'M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z'}),
        ("path", {'d': 'm20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845'}),
    ],
    "link": [
        ("path", {'d': 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'}),
        ("path", {'d': 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'}),
    ],
    "search": [
        ("path", {'d': 'm21 21-4.34-4.34'}),
        ("circle", {'cx': '11', 'cy': '11', 'r': '8'}),
    ],
    "trending-up": [
        ("path", {'d': 'M16 7h6v6'}),
        ("path", {'d': 'm22 7-8.5 8.5-5-5L2 17'}),
    ],
    "trending-down": [
        ("path", {'d': 'M16 17h6v-6'}),
        ("path", {'d': 'm22 17-8.5-8.5-5 5L2 7'}),
    ],
    "percent": [
        ("line", {'x1': '19', 'x2': '5', 'y1': '5', 'y2': '19'}),
        ("circle", {'cx': '6.5', 'cy': '6.5', 'r': '2.5'}),
        ("circle", {'cx': '17.5', 'cy': '17.5', 'r': '2.5'}),
    ],
    "hash": [
        ("line", {'x1': '4', 'x2': '20', 'y1': '9', 'y2': '9'}),
        ("line", {'x1': '4', 'x2': '20', 'y1': '15', 'y2': '15'}),
        ("line", {'x1': '10', 'x2': '8', 'y1': '3', 'y2': '21'}),
        ("line", {'x1': '16', 'x2': '14', 'y1': '3', 'y2': '21'}),
    ],
    "package": [
        ("path", {'d': 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z'}),
        ("path", {'d': 'M12 22V12'}),
        ("polyline", {'points': '3.29 7 12 12 20.71 7'}),
        ("path", {'d': 'm7.5 4.27 9 5.15'}),
    ],
    "shopping-cart": [
        ("circle", {'cx': '8', 'cy': '21', 'r': '1'}),
        ("circle", {'cx': '19', 'cy': '21', 'r': '1'}),
        ("path", {'d': 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'}),
    ],
    "wallet": [
        ("path", {'d': 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1'}),
        ("path", {'d': 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'}),
    ],
    "landmark": [
        ("path", {'d': 'M10 18v-7'}),
        ("path", {'d': 'M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z'}),
        ("path", {'d': 'M14 18v-7'}),
        ("path", {'d': 'M18 18v-7'}),
        ("path", {'d': 'M3 22h18'}),
        ("path", {'d': 'M6 18v-7'}),
    ],
    "newspaper": [
        ("path", {'d': 'M15 18h-5'}),
        ("path", {'d': 'M18 14h-8'}),
        ("path", {'d': 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2'}),
        ("rect", {'width': '8', 'height': '4', 'x': '10', 'y': '6', 'rx': '1'}),
    ],
}


def icon(key: str) -> List[Element]:
    """Element list for ``key``; unknown keys get the ``hash`` mark."""
    return _ICONS.get(str(key or ""), _ICONS["hash"])


def draw(key: str, x: float, y: float, size: float = 24,
         stroke: str = "#000", width: float = 2.0) -> str:
    """SVG ``<g>`` for the icon at (x, y), scaled from the 24px grid."""
    from .core import util_escape
    els = icon(key)
    s = size / 24.0 if size else 1.0
    sw = width / s if s else width
    parts = [f'<g transform="translate({x},{y}) scale({s:.4f})"'
             f' fill="none" stroke="{stroke}" stroke-width="{sw:.2f}"'
             ' stroke-linecap="round" stroke-linejoin="round">']
    for tag, at in els:
        flat = " ".join(f'{k.replace("_", "-")}="{util_escape(v)}"'
                        for k, v in at.items())
        parts.append(f"<{tag} {flat}/>")
    parts.append("</g>")
    return "".join(parts)


__all__ = ["KEYS", "icon", "draw"]
