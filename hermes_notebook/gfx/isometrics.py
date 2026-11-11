"""Procedural isometric micro-diagrams for the blueprint template.

Lucide-style line icons read as UI chrome; an engineering poster needs
axonometric structure — shaded planes, joints, waveforms, routing arrows. This
module draws those from primitives, at any size, from a small deterministic
vocabulary. Nothing here is a photograph, and nothing is random: the same
arguments always produce the same SVG, so a snapshot can pin it.

Every helper takes an origin `(x, y)`, a `size` (the box it must fit), and an
accent colour, and returns a list of SVG element strings. They are pure
functions of their arguments: no module state, no global transforms, so a
template can place a dozen on one canvas without them interfering.

Public surface:

* `draw(kind, ...)` — one call per icon slot, with an honest fallback for an
  unknown kind (a wireframe frame, never nothing);
* the five helpers themselves, for a template that wants one specifically;
* `KINDS` — what `draw` accepts, so a schema enum and the renderer cannot drift.

Geometry convention: a 2:1 isometric ratio (30° projection), y-axis up the
sheet, and a box that always fits inside `size` so a caller can lay out cards
without measuring after the fact.
"""

from __future__ import annotations

import math
from typing import Dict, List, Sequence, Tuple

from . import core

RGB = Tuple[int, int, int]

#: The icon vocabulary the blueprint template accepts.
KINDS: Tuple[str, ...] = (
    "iso_grid_cube",
    "kinematic_node_graph",
    "oscilloscope_trace",
    "file_pipeline_nodes",
    "test_ramp_and_rig",
)

#: 2:1 isometric projection — the standard engineering-poster angle.
ISO = 0.5


def _tint(c: RGB, k: float, paper: RGB) -> RGB:
    """Lighten toward paper (k>0) or darken away from it (k<0)."""
    return core.mix(c, paper, k) if k >= 0 else core.mix(c, core.shade(c, -k), 1.0)


# ------------------------------------------------------------------ helpers


def iso_grid_cube(x: float, y: float, size: float, accent: RGB, paper: RGB,
                  faces: bool = True) -> List[str]:
    """A wireframe cube with three shaded planes, drawn axonometric.

    Front/top/right faces get three different tints of the accent, so the solid
    reads as a solid without a gradient. The grid on the top face is what makes
    it read as *engineering* rather than generic 3D.
    """
    # Fit the box: the cube's vertical span is 2*(dy*0.5) + 2*(s*0.86), so
    # s = 0.32*size keeps it inside `size` with margin (0.44 overflowed by 12px
    # on a 56px slot, which silently clipped in the card).
    s = size * 0.32
    ox, oy = x + size / 2, y + size / 2 + s * ISO * 0.5
    dx, dy = s, s * ISO

    def pt(u: float, v: float, w: float) -> Tuple[float, float]:
        """u,v,w in [-1,1]: cube space -> sheet space."""
        return (ox + (u - v) * dx * 0.5,
                oy + (u + v) * dy * 0.5 - w * s * 0.86)

    out: List[str] = []
    # top face
    top = [pt(-1, -1, 1), pt(1, -1, 1), pt(1, 1, 1), pt(-1, 1, 1)]
    # left face
    left = [pt(-1, -1, 1), pt(-1, 1, 1), pt(-1, 1, -1), pt(-1, -1, -1)]
    # right face
    right = [pt(1, -1, 1), pt(1, 1, 1), pt(1, 1, -1), pt(1, -1, -1)]

    def poly(points: Sequence[Tuple[float, float]], fill: RGB | None, sw: float = 1.0,
             opacity: float = 1.0) -> str:
        d = "M " + " L ".join(f"{px:.1f} {py:.1f}" for px, py in points)
        return core.path(d, fill=fill, stroke=core.mix(accent, paper, 0.25),
                         sw=sw, opacity=opacity, close=True)

    if faces:
        out.append(poly(left, _tint(accent, 0.72, paper), 0.9, 0.95))
        out.append(poly(right, _tint(accent, 0.55, paper), 0.9, 0.95))
        out.append(poly(top, _tint(accent, 0.30, paper), 0.9, 0.98))
    else:
        for face in (left, right, top):
            out.append(poly(face, None, 1.1))
    # hidden edges, quiet
    for a, b in ((pt(-1, 1, -1), pt(1, 1, -1)), (pt(-1, 1, -1), pt(-1, -1, -1)),
                 (pt(1, 1, -1), pt(-1, 1, -1))):
        out.append(core.line(a[0], a[1], b[0], b[1], core.mix(accent, paper, 0.6), 0.8,
                             opacity=0.5, dash="2 3"))
    # grid on the top face: engineering, not decoration
    for k in (-0.5, 0.0, 0.5):
        out.append(core.line(*pt(-1, k, 1), *pt(1, k, 1),
                             core.mix(accent, paper, 0.45), 0.6, opacity=0.55))
        out.append(core.line(*pt(k, -1, 1), *pt(k, 1, 1),
                             core.mix(accent, paper, 0.45), 0.6, opacity=0.55))
    return out


def kinematic_node_graph(x: float, y: float, size: float, accent: RGB,
                         paper: RGB) -> List[str]:
    """Joints, link vectors and a centre-of-mass marker — a mechanism diagram."""
    out: List[str] = []
    base_y = y + size * 0.80
    joints = [
        (x + size * 0.16, base_y, 3.4),
        (x + size * 0.38, y + size * 0.44, 4.2),
        (x + size * 0.63, y + size * 0.30, 3.6),
        (x + size * 0.84, y + size * 0.52, 2.8),
    ]
    links = core.mix(accent, paper, 0.35)
    for i in range(len(joints) - 1):
        a, b = joints[i], joints[i + 1]
        out.append(core.line(a[0], a[1], b[0], b[1], links, 1.6, cap="round"))
        # hinge arc at each joint
        out.append(core.circle(b[0], b[1], b[2] + 2.4, fill=None,
                               stroke=core.mix(accent, paper, 0.65), sw=0.7))
    for jx, jy, r in joints:
        out.append(core.circle(jx, jy, r, fill=accent))
        out.append(core.circle(jx, jy, r * 0.42, fill=core.mix(paper, accent, 0.1)))
    # a force vector off the second joint, drawn with an arrowhead
    tip = (joints[1][0] + size * 0.16, joints[1][1] - size * 0.30)
    out.append(core.line(joints[1][0], joints[1][1], tip[0], tip[1], accent, 1.4))
    out.append(core.path(
        f"M {tip[0]:.1f} {tip[1]:.1f} l -7 3.2 l 1.2 -7.6 z",
        fill=accent, stroke=None, close=True))
    # ground hatching under the base
    for k in range(5):
        gx = x + size * (0.10 + k * 0.05)
        out.append(core.line(gx, base_y + 5, gx + size * 0.05, base_y + 11,
                             core.mix(accent, paper, 0.62), 0.7))
    out.append(core.line(x + size * 0.10, base_y + 5, x + size * 0.90, base_y + 5,
                         core.mix(accent, paper, 0.45), 1.0))
    # CoM marker
    com = (x + size * 0.50, y + size * 0.40)
    out.append(core.circle(com[0], com[1], 2.6, fill=None, stroke=accent, sw=1.0))
    out.append(core.line(com[0] - 5, com[1], com[0] + 5, com[1], accent, 0.8))
    out.append(core.line(com[0], com[1] - 5, com[0], com[1] + 5, accent, 0.8))
    return out


def oscilloscope_trace(x: float, y: float, size: float, accent: RGB,
                       paper: RGB, dark: bool = True) -> List[str]:
    """A monitor frame with graticule and two bezier channels."""
    out: List[str] = []
    w, h = size * 0.92, size * 0.66
    ox, oy = x + (size - w) / 2, y + (size - h) / 2
    screen = (12, 18, 26) if dark else core.shade(paper, 0.14)
    out.append(core.rect(ox, oy, w, h, fill=screen, r=max(3, size * 0.05),
                         stroke=core.mix(accent, paper, 0.55), sw=0.9))
    grid = core.mix(screen, accent, 0.20)
    for k in range(1, 4):
        gx = ox + w * k / 4
        out.append(core.line(gx, oy + 3, gx, oy + h - 3, grid, 0.5, opacity=0.6))
    for k in range(1, 3):
        gy = oy + h * k / 3
        out.append(core.line(ox + 3, gy, ox + w - 3, gy, grid, 0.5, opacity=0.6))
    # two channels: one carrier, one enveloped burst
    mid = oy + h / 2
    d1 = (f"M {ox + 5:.1f} {mid:.1f} "
          + " ".join(f"Q {ox + w * (i + 0.5) / 6:.1f} {mid - (h * 0.26 if i % 2 == 0 else h * 0.02):.1f} "
                     f"{ox + w * (i + 1) / 6:.1f} {mid:.1f}" for i in range(6)))
    out.append(core.path(d1, fill=None, stroke=accent, sw=1.5))
    d2 = (f"M {ox + 5:.1f} {mid + h * 0.22:.1f} "
          + " ".join(f"L {ox + w * (i + 1) / 7:.1f} "
                     f"{mid + h * (0.22 - 0.30 * math.sin(i / 1.6) * (0.35 + i / 12)):.1f}"
                     for i in range(7)))
    out.append(core.path(d2, fill=None, stroke=core.mix(accent, paper, 0.42), sw=1.1))
    # readout tick
    out.append(core.circle(ox + w - 8, oy + 7, 1.8, fill=accent))
    return out


def file_pipeline_nodes(x: float, y: float, size: float, accent: RGB,
                        paper: RGB) -> List[str]:
    """Interchange badges joined by routed arrows — an export pipeline."""
    out: List[str] = []
    badges = ["GLB", "FBX", "USD", "STEP"][:3]
    # 3 badges at step 0.335 + width 0.30 summed to 1.01 of the box: the last
    # badge and its label painted 3px outside a 56px slot and got clipped by the
    # card holding it. step 0.30 / width 0.27 leaves 9% of slack on the right.
    bw, bh = size * 0.27, size * 0.26
    for i, label in enumerate(badges):
        bx = x + size * (0.05 + i * 0.30)
        by = y + size * (0.30 if i % 2 == 0 else 0.46)
        out.append(core.path(
            f"M {bx + 4:.1f} {by:.1f} L {bx + bw - 4:.1f} {by:.1f} "
            f"L {bx + bw:.1f} {by + bh * 0.22:.1f} L {bx + bw:.1f} {by + bh:.1f} "
            f"L {bx:.1f} {by + bh:.1f} L {bx:.1f} {by + 4:.1f} Z",
            fill=core.mix(paper, accent, 0.10), stroke=core.mix(accent, paper, 0.4), sw=0.8))
        # A badge label is only legible above the 9px floor; `int()` rounding also
        # dropped a 51px slot's label to 8px, under the contract.
        out.append(core.text(bx + 5, by + bh * 0.66, label, max(9.0, size * 0.11),
                             core.readable(accent, core.mix(paper, accent, 0.10), 3.0),
                             "mono", bold=True))
        if i:
            ax = bx - size * 0.02
            ay = by + bh * 0.5
            out.append(core.path(
                f"M {ax - size * 0.09:.1f} {ay:.1f} Q {ax - size * 0.045:.1f} {ay - 7:.1f} {ax:.1f} {ay:.1f}",
                fill=None, stroke=accent, sw=1.1))
            out.append(core.path(f"M {ax:.1f} {ay:.1f} l -3.4 0.4 l 1.6 3.0 z", fill=accent,
                                 stroke=None, close=True))
    return out


def test_ramp_and_rig(x: float, y: float, size: float, accent: RGB,
                      paper: RGB) -> List[str]:
    """An axonometric test bench: a ramp, a rig frame and a load mass."""
    out: List[str] = []
    # ramp as a parallelogram slab
    p0 = (x + size * 0.08, y + size * 0.82)
    p1 = (x + size * 0.55, y + size * 0.82)
    p2 = (x + size * 0.72, y + size * 0.60)
    p3 = (x + size * 0.25, y + size * 0.60)
    out.append(core.path(
        f"M {p0[0]:.1f} {p0[1]:.1f} L {p1[0]:.1f} {p1[1]:.1f} "
        f"L {p2[0]:.1f} {p2[1]:.1f} L {p3[0]:.1f} {p3[1]:.1f} Z",
        fill=core.mix(paper, accent, 0.16), stroke=core.mix(accent, paper, 0.35), sw=0.9))
    # its thickness, so the slab reads as a solid
    out.append(core.path(
        f"M {p0[0]:.1f} {p0[1]:.1f} L {p1[0]:.1f} {p1[1]:.1f} L {p1[0]:.1f} {p1[1] + 7:.1f} "
        f"L {p0[0]:.1f} {p0[1] + 7:.1f} Z",
        fill=core.mix(accent, paper, 0.55), stroke=None, close=True))
    # rig frame: two posts and a cross-beam
    fx = x + size * 0.78
    out.append(core.line(fx, y + size * 0.20, fx, y + size * 0.86, core.mix(accent, paper, 0.30), 1.6))
    out.append(core.line(fx, y + size * 0.20, x + size * 0.62, y + size * 0.20,
                         core.mix(accent, paper, 0.30), 1.6))
    out.append(core.circle(fx, y + size * 0.20, 2.4, fill=accent))
    # the load mass hanging off the beam, with its vector
    mass_y = y + size * 0.34
    out.append(core.rect(x + size * 0.595, mass_y, size * 0.10, size * 0.10,
                         fill=core.mix(paper, accent, 0.12),
                         stroke=core.mix(accent, paper, 0.35), sw=0.8, r=1.5))
    out.append(core.line(fx, y + size * 0.20, fx, mass_y, core.mix(accent, paper, 0.55), 0.7,
                         dash="2 2"))
    out.append(core.path(f"M {fx:.1f} {mass_y + size * 0.12:.1f} l 0 {size * 0.08:.1f} "
                         f"l -3 -4 l 6 0 z", fill=accent, stroke=None, close=True))
    return out


_HELPERS = {
    "iso_grid_cube": iso_grid_cube,
    "kinematic_node_graph": kinematic_node_graph,
    "oscilloscope_trace": oscilloscope_trace,
    "file_pipeline_nodes": file_pipeline_nodes,
    "test_ramp_and_rig": test_ramp_and_rig,
}


def draw(kind: str, x: float, y: float, size: float, accent: RGB, paper: RGB = (248, 250, 252),
         **kw: object) -> List[str]:
    """Draw `kind` at `(x, y)` inside a `size` box.

    An unknown kind is not an error: a schema can outrun the renderer, and a
    poster with one plainer icon is better than a 500. It falls back to the
    wireframe cube, which at least reads as an object.
    """
    helper = _HELPERS.get(str(kind or "").strip(), _HELPERS["iso_grid_cube"])
    # A 4% inset: measured by pixels, three helpers touched their box's right or
    # bottom edge exactly at 56px, which reads as a clipped icon inside a card.
    inner = max(18.0, float(size) * 0.92)
    inset = (float(size) - inner) / 2
    return helper(x + inset, y + inset, inner, accent, paper, **kw)


def catalogue() -> Dict[str, str]:
    """What `draw` accepts, with a one-line description — for a picker or a schema."""
    return {
        "iso_grid_cube": "wireframe cube with shaded planes and a top-face grid",
        "kinematic_node_graph": "joint chain with hinge arcs, a force vector and a CoM marker",
        "oscilloscope_trace": "dark monitor frame with graticule and two waveform channels",
        "file_pipeline_nodes": "interchange badges joined by routed arrows",
        "test_ramp_and_rig": "axonometric ramp, rig frame and hanging load mass",
    }
