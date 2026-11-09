"""Tests for the zero-dependency PPTX exporter.

Two layers, both meaningful:

* structural checks (always run) unzip the produced package, parse every XML
  part, and prove that every ``r:id`` used in markup resolves in the matching
  ``.rels`` part and every relationship target points at a real part;
* an interoperability check using python-pptx (skipped when it is not
  installed) opens the same bytes through ``io.BytesIO`` and reads back the
  slide count, titles, bullets, subtitle and speaker notes.

The structural layer is mandatory so the suite still proves validity in an
offline environment with no PowerPoint library available.
"""

from __future__ import annotations

import io
import posixpath
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from hermes_notebook.pptx_export import (  # noqa: E402
    MAX_BULLETS,
    MAX_BULLET_CHARS,
    SLIDE_HEIGHT_EMU,
    SLIDE_WIDTH_EMU,
    build_pptx,
)

P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"p": P, "a": A, "r": R}
REL_ATTR_PREFIX = "{" + R + "}"

DECK_TITLE = "Photosynthesis: From Photon to Sugar"
SUBTITLE = "A ten-minute walkthrough"

DECK = [
    {
        "title": "Photosynthesis",
        "bullets": ["Plants turn light into sugar",
                    "Uses CO2 & water < light"],
        "notes": "Open with the big picture.",
    },
    {
        "title": "Light capture",
        "bullets": ["Chlorophyll absorbs red and blue",
                    "Two photosystems run in series"],
        "notes": "Line one\nLine two",
    },
    {"title": "Quiet slide", "bullets": []},
    {"title": "Dense slide",
     "bullets": [f"Point {i}" for i in range(15)]},
]


# ------------------------------------------------------------------ fixtures

def _build(deck=None, subtitle=SUBTITLE, title=DECK_TITLE) -> bytes:
    return build_pptx(title, DECK if deck is None else deck, subtitle=subtitle)


def _package(data: bytes) -> dict[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), "duplicate zip entries"
        return {name: archive.read(name) for name in names}


def _source_part(rels_name: str) -> str | None:
    """Map ``ppt/slides/_rels/slide1.xml.rels`` to ``ppt/slides/slide1.xml``."""
    if rels_name == "_rels/.rels":
        return None
    segments = rels_name.split("/")
    assert segments[-2] == "_rels", rels_name
    return "/".join(segments[:-2] + [segments[-1][: -len(".rels")]])


def _rels_name_for(part: str) -> str:
    directory, _, filename = part.rpartition("/")
    return f"{directory}/_rels/{filename}.rels" if directory else f"_rels/{filename}.rels"


def _relationships(package: dict[str, bytes], part: str) -> dict[str, dict]:
    rels_name = _rels_name_for(part)
    if rels_name not in package:
        return {}
    root = ET.fromstring(package[rels_name])
    return {
        rel.get("Id"): dict(rel.attrib)
        for rel in root.findall(f"{{{PKG_REL}}}Relationship")
    }


def validate_package(data: bytes) -> dict[str, bytes]:
    """Mandatory validity checks: parts, content types, rels, r:id wiring."""
    package = _package(data)
    assert "[Content_Types].xml" in package

    for name, payload in package.items():
        if name.endswith(".xml") or name.endswith(".rels"):
            ET.fromstring(payload)  # raises on any malformed part

    # -- content types: every part has either a default or an override.
    types_root = ET.fromstring(package["[Content_Types].xml"])
    overrides = {
        node.get("PartName"): node.get("ContentType")
        for node in types_root.findall(f"{{{CT}}}Override")
    }
    defaults = {
        node.get("Extension").lower(): node.get("ContentType")
        for node in types_root.findall(f"{{{CT}}}Default")
    }
    assert defaults.get("rels"), "no default content type for rels"
    for part in package:
        if part == "[Content_Types].xml":
            continue
        extension = part.rsplit(".", 1)[-1].lower()
        if extension == "rels":
            continue
        assert f"/{part}" in overrides, f"missing content-type override for {part}"
        assert overrides[f"/{part}"], f"empty content type for {part}"
    for part_name, ctype in overrides.items():
        assert part_name.startswith("/"), part_name
        assert part_name.lstrip("/") in package, f"override for missing part {part_name}"
        assert ctype and not ctype.endswith("relationships+xml")

    # -- presentations must advertise the standard main content type.
    assert overrides["/ppt/presentation.xml"].endswith(
        "presentationml.presentation.main+xml")

    # -- every relationship target resolves to a real part.
    for rels_name, payload in package.items():
        if not rels_name.endswith(".rels"):
            continue
        source = _source_part(rels_name)
        base = posixpath.dirname(source) if source else ""
        root = ET.fromstring(payload)
        for rel in root.findall(f"{{{PKG_REL}}}Relationship"):
            if rel.get("TargetMode") == "External":
                continue
            target = posixpath.normpath(posixpath.join(base, rel.get("Target")))
            assert target in package, f"{rels_name}: dangling target {target}"

    # -- every r:id used in markup must exist in that part's rels.
    for name, payload in package.items():
        if not name.endswith(".xml") or name == "[Content_Types].xml":
            continue
        root = ET.fromstring(payload)
        used = {
            value
            for element in root.iter()
            for key, value in element.attrib.items()
            if key.startswith(REL_ATTR_PREFIX)
        }
        if not used:
            continue
        rels = _relationships(package, name)
        assert rels, f"{name} uses r:id but has no rels part"
        missing = used - set(rels)
        assert not missing, f"{name}: unresolved r:id(s) {sorted(missing)}"

    # -- slide size is 16:9 widescreen in EMU.
    presentation = ET.fromstring(package["ppt/presentation.xml"])
    size = presentation.find("p:sldSz", NS)
    assert size is not None, "presentation.xml has no sldSz"
    assert int(size.get("cx")) == SLIDE_WIDTH_EMU == 12192000
    assert int(size.get("cy")) == SLIDE_HEIGHT_EMU == 6858000
    assert presentation.find("p:notesSz", NS) is not None

    slide_ids = presentation.findall("p:sldIdLst/p:sldId", NS)
    slide_parts = sorted(n for n in package if n.startswith("ppt/slides/slide"))
    assert len(slide_ids) == len(slide_parts)
    assert all(s.get(f"{{{R}}}id") for s in slide_ids)
    assert len({s.get("id") for s in slide_ids}) == len(slide_ids)

    # -- the master must point at both layouts and the theme.
    master_rels = _relationships(package, "ppt/slideMasters/slideMaster1.xml")
    targets = {rel["Target"] for rel in master_rels.values()}
    assert "../slideLayouts/slideLayout1.xml" in targets
    assert "../slideLayouts/slideLayout2.xml" in targets
    assert "../theme/theme1.xml" in targets
    master = ET.fromstring(package["ppt/slideMasters/slideMaster1.xml"])
    layout_ids = master.findall("p:sldLayoutIdLst/p:sldLayoutId", NS)
    assert len(layout_ids) == 2
    for layout_id in layout_ids:
        assert layout_id.get(f"{{{R}}}id") in master_rels

    # -- theme uses the requested accent colour and Calibri.
    theme = ET.fromstring(package["ppt/theme/theme1.xml"])
    accent1 = theme.find(".//a:clrScheme/a:accent1/a:srgbClr", NS)
    assert accent1 is not None and accent1.get("val").upper() == "2563EB"
    minor = theme.find(".//a:fontScheme/a:minorFont/a:latin", NS)
    assert minor is not None and minor.get("typeface") == "Calibri"

    return package


def _slide_blocks(package: dict[str, bytes], index: int) -> list[tuple[str | None, list[str]]]:
    """(placeholder type, paragraph texts) for each shape on slide N."""
    root = ET.fromstring(package[f"ppt/slides/slide{index}.xml"])
    blocks = []
    for shape in root.findall("p:cSld/p:spTree/p:sp", NS):
        ph = shape.find("p:nvSpPr/p:nvPr/p:ph", NS)
        ph_type = ph.get("type") if ph is not None else None
        paragraphs = [
            "".join(node.text or "" for node in para.iter(f"{{{A}}}t"))
            for para in shape.findall("p:txBody/a:p", NS)
        ]
        blocks.append((ph_type, [text for text in paragraphs if text]))
    return blocks


def _test_slides(blocks: list[tuple[str | None, list[str]]]) -> list[str]:
    return [texts[0] for ph_type, texts in blocks if ph_type in ("title", "ctrTitle")]


def _pptx_module():
    return pytest.importorskip("pptx", reason="python-pptx not installed")


def _titles_and_text(prs) -> list[tuple[str, list[str]]]:
    rows = []
    for slide in prs.slides:
        body = [
            paragraph.text
            for shape in slide.placeholders
            if shape.placeholder_format.idx != 0 and shape.has_text_frame
            for paragraph in shape.text_frame.paragraphs
            if paragraph.text
        ]
        rows.append((slide.shapes.title.text if slide.shapes.title else "", body))
    return rows


# --------------------------------------------------------------------- tests

def test_package_is_structurally_valid():
    data = _build()
    package = validate_package(data)
    blocks = [_slide_blocks(package, i) for i in range(1, 7)]
    assert [_test_slides(b) for b in blocks] == [
        [DECK_TITLE],
        ["Photosynthesis"],
        ["Light capture"],
        ["Quiet slide"],
        ["Dense slide"],
        ["Key takeaways"],
    ]
    # bullets landed and the empty slide stayed empty
    assert blocks[1][1][1] == ["Plants turn light into sugar",
                              "Uses CO2 & water < light"]
    assert [block for block in blocks[3] if block[0] == "body"] == []


def test_python_pptx_opens_and_reads_titles_bullets_notes():
    _pptx_module()
    from pptx import Presentation

    data = _build()
    prs = Presentation(io.BytesIO(data))

    assert len(prs.slides) == 6
    assert (prs.slide_width, prs.slide_height) == (SLIDE_WIDTH_EMU, SLIDE_HEIGHT_EMU)

    rows = _titles_and_text(prs)
    assert [title for title, _ in rows] == [
        DECK_TITLE, "Photosynthesis", "Light capture",
        "Quiet slide", "Dense slide", "Key takeaways",
    ]
    assert rows[0][1] == [SUBTITLE]
    assert rows[1][1] == ["Plants turn light into sugar",
                          "Uses CO2 & water < light"]

    # speaker notes only exist where the deck asked for them
    assert not prs.slides[0].has_notes_slide
    assert prs.slides[1].notes_slide.notes_text_frame.text.startswith(
        "Open with the big picture")
    assert prs.slides[2].notes_slide.notes_text_frame.text == "Line one\nLine two"
    assert not prs.slides[3].has_notes_slide
    assert not prs.slides[5].has_notes_slide


def test_no_notes_parts_when_no_slide_has_notes():
    data = _build(deck=[{"title": "Only slide", "bullets": ["one"]}])
    package = validate_package(data)
    assert not any(name.startswith("ppt/notesSlides/") for name in package)
    assert not any(name.startswith("ppt/notesMasters/") for name in package)
    presentation = ET.fromstring(package["ppt/presentation.xml"])
    assert presentation.find("p:notesMasterIdLst", NS) is None

    _pptx_module()
    from pptx import Presentation
    prs = Presentation(io.BytesIO(data))
    assert len(prs.slides) == 3
    assert all(not slide.has_notes_slide for slide in prs.slides)


def test_existing_key_takeaways_slide_is_not_duplicated():
    deck = [
        {"title": "Opening idea", "bullets": ["first point"]},
        {"title": "Key takeaways", "bullets": ["a", "b"]},
    ]
    data = _build(deck=deck)
    package = validate_package(data)
    presentation = ET.fromstring(package["ppt/presentation.xml"])
    assert len(presentation.findall("p:sldIdLst/p:sldId", NS)) == 3
    blocks = [_slide_blocks(package, i) for i in range(1, 4)]
    assert [_test_slides(b) for b in blocks] == [
        [DECK_TITLE], ["Opening idea"], ["Key takeaways"],
    ]


def test_bullets_are_clipped_and_capped():
    long_bullet = "x" * (MAX_BULLET_CHARS + 50)
    deck = [{"title": "Too much", "bullets": [long_bullet] + [f"b{i}" for i in range(20)]}]
    data = _build(deck=deck)
    package = validate_package(data)
    blocks = _slide_blocks(package, 2)
    bullets = blocks[1][1]  # body placeholder is the second shape
    assert len(bullets) == MAX_BULLETS == 12
    assert len(bullets[0]) == MAX_BULLET_CHARS
    assert bullets[0].endswith("\u2026")
    assert bullets[1:] == [f"b{i}" for i in range(MAX_BULLETS - 1)]


def test_empty_deck_and_empty_slides_are_safe():
    data = _build(deck=[])
    package = validate_package(data)
    presentation = ET.fromstring(package["ppt/presentation.xml"])
    assert len(presentation.findall("p:sldIdLst/p:sldId", NS)) == 2
    assert _test_slides(_slide_blocks(package, 1)) == [DECK_TITLE]
    assert _test_slides(_slide_blocks(package, 2)) == ["Key takeaways"]

    _pptx_module()
    from pptx import Presentation
    prs = Presentation(io.BytesIO(data))
    assert len(prs.slides) == 2


def test_notes_parts_are_paired_with_their_slides():
    data = build_pptx(DECK_TITLE, [
        {"title": "One", "bullets": ["b"], "note": "alias key works"},
        {"title": "Two", "bullets": [], "notes": "second note"},
        {"title": "Three", "bullets": ["c"]},
    ], subtitle="")
    package = validate_package(data)
    notes_parts = sorted(n for n in package if n.startswith("ppt/notesSlides/notesSlide"))
    assert len(notes_parts) == 2
    notes_rel = _relationships(package, "ppt/slides/slide2.xml")["rId2"]
    assert notes_rel["Target"] == "../notesSlides/notesSlide1.xml"
    notes_rels = _relationships(package, "ppt/notesSlides/notesSlide1.xml")
    assert notes_rels["rId1"]["Target"] == "../slides/slide2.xml"
    assert notes_rels["rId2"]["Target"] == "../notesMasters/notesMaster1.xml"

    _pptx_module()
    from pptx import Presentation
    prs = Presentation(io.BytesIO(data))
    assert prs.slides[1].notes_slide.notes_text_frame.text == "alias key works"
    assert prs.slides[2].notes_slide.notes_text_frame.text == "second note"


def test_special_characters_and_multiline_notes_round_trip():
    tricky = 'R&D costs < 5% "quoted" & \u00e9\u00e8 \u2014 fine'
    deck = [{"title": 'A & B < "C"', "bullets": [tricky], "notes": "para 1\n\npara 3"}]
    data = _build(deck=deck)
    package = validate_package(data)
    blocks = _slide_blocks(package, 2)
    assert blocks[0][1] == ['A & B < "C"']
    assert blocks[1][1] == [tricky]

    _pptx_module()
    from pptx import Presentation
    prs = Presentation(io.BytesIO(data))
    assert prs.slides[1].shapes.title.text == 'A & B < "C"'
    assert [p.text for p in prs.slides[1].placeholders[1].text_frame.paragraphs] == [tricky]
    assert prs.slides[1].notes_slide.notes_text_frame.text == "para 1\n\npara 3"
