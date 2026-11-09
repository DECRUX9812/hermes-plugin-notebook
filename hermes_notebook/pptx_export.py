"""Zero-dependency PPTX export for the plugin's slide decks.

NotebookLM exports slide decks as PPTX; this module produces the same file shape
using only the standard library (``zipfile``, ``io``, ``xml.sax.saxutils`` and
``datetime``).  Nothing here imports a third-party PowerPoint writer, so the
plugin keeps installing with no new dependency.

The package written is the minimal valid shape PowerPoint and python-pptx both
accept: one slide master with two layouts (title slide and title + content),
one office theme, one ``ppt/slides/slideN.xml`` per slide, and notes parts only
when a slide actually carries speaker notes.

Layout of the generated deck:

* a title slide built from ``deck_title`` and ``subtitle``;
* one title + content slide per entry in ``slides`` (bullets become separate
  paragraphs; a slide with no bullets simply has no body placeholder);
* a closing ``Key takeaways`` slide unless the deck's last slide already is one.

Renderability guards: each bullet is clipped to 400 characters and a slide
keeps at most 12 bullets.  Body font size shrinks as the bullet count grows,
and the body placeholder uses normal autofit, so dense decks stay on-slide.

Public API::

    build_pptx(deck_title, slides, subtitle="") -> bytes

``slides`` is the same JSON shape the ``slides`` artifact prompt fills:
``[{"title": str, "bullets": [str], "notes": str}, ...]`` (``"note"`` is also
accepted, matching the artifact schema's key name).
"""

from __future__ import annotations

import io
import re
import zipfile
from datetime import datetime, timezone
from xml.sax.saxutils import escape, quoteattr

__all__ = ["build_pptx", "SLIDE_WIDTH_EMU", "SLIDE_HEIGHT_EMU"]

#: 16:9 widescreen, in English Metric Units (13.333in x 7.5in).
SLIDE_WIDTH_EMU = 12192000
SLIDE_HEIGHT_EMU = 6858000

MAX_BULLETS = 12
MAX_BULLET_CHARS = 400
MAX_TITLE_CHARS = 200

_NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
_NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
_NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
_NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"
_NS_CP = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
_NS_DC = "http://purl.org/dc/elements/1.1/"
_NS_DCTERMS = "http://purl.org/dc/terms/"
_NS_DCMITYPE = "http://purl.org/dc/dcmitype/"
_NS_XSI = "http://www.w3.org/2001/XMLSchema-instance"
_NS_EP = "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
_NS_VT = "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"

CT_PRESENTATION = ("application/vnd.openxmlformats-officedocument."
                   "presentationml.presentation.main+xml")
CT_SLIDE_MASTER = ("application/vnd.openxmlformats-officedocument."
                   "presentationml.slideMaster+xml")
CT_SLIDE_LAYOUT = ("application/vnd.openxmlformats-officedocument."
                   "presentationml.slideLayout+xml")
CT_SLIDE = ("application/vnd.openxmlformats-officedocument."
            "presentationml.slide+xml")
CT_NOTES_SLIDE = ("application/vnd.openxmlformats-officedocument."
                  "presentationml.notesSlide+xml")
CT_NOTES_MASTER = ("application/vnd.openxmlformats-officedocument."
                   "presentationml.notesMaster+xml")
CT_THEME = "application/vnd.openxmlformats-officedocument.theme+xml"
CT_CORE = "application/vnd.openxmlformats-package.core-properties+xml"
CT_APP = ("application/vnd.openxmlformats-officedocument."
          "extended-properties+xml")
REL_OFFICE_DOCUMENT = ("http://schemas.openxmlformats.org/officeDocument/"
                       "2006/relationships/officeDocument")
REL_SLIDE_MASTER = _NS_R + "/slideMaster"
REL_SLIDE_LAYOUT = _NS_R + "/slideLayout"
REL_SLIDE = _NS_R + "/slide"
REL_NOTES_MASTER = _NS_R + "/notesMaster"
REL_NOTES_SLIDE = _NS_R + "/notesSlide"
REL_THEME = _NS_R + "/theme"
REL_CORE = ("http://schemas.openxmlformats.org/package/2006/relationships/"
            "metadata/core-properties")
REL_APP = _NS_R + "/extended-properties"

_XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
_NS_DECL = f'xmlns:a="{_NS_A}" xmlns:r="{_NS_R}" xmlns:p="{_NS_P}"'

# Characters XML 1.0 forbids (everything below 0x20 except tab/LF/CR), plus
# unpaired surrogate halves and the two non-characters at the end of the BMP.
_INVALID_XML = re.compile(
    "[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\ud800-\\udfff\\ufffe\\uffff]"
)
_TAKEAWAY_RE = re.compile(r"take[\s-]*aways?", re.I)

_GROUP_TREE = (
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
    "</p:nvGrpSpPr>"
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
)

_CLR_MAP = (
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" '
    'accent1="accent1" accent2="accent2" accent3="accent3" '
    'accent4="accent4" accent5="accent5" accent6="accent6" '
    'hlink="hlink" folHlink="folHlink"/>'
)

_EMPTY_PARA = '<a:p><a:endParaRPr lang="en-US"/></a:p>'


# --------------------------------------------------------------- text helpers

def _clean(text: object) -> str:
    """Coerce any value to text that is legal inside an XML 1.0 document."""
    if text is None:
        return ""
    if isinstance(text, (list, tuple)):
        text = "\n".join(str(part) for part in text)
    text = str(text).replace("\r\n", "\n").replace("\r", "\n")
    return _INVALID_XML.sub("", text)


def _esc(text: object) -> str:
    """Escape text for an element body."""
    return escape(_clean(text))


def _attr(text: object) -> str:
    """Escape text for a double-quoted attribute value (with the quotes)."""
    return quoteattr(_clean(text))


def _clip(text: str, limit: int) -> str:
    """Clip to ``limit`` characters, marking the cut with an ellipsis."""
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "\u2026"


def _one_line(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _bullet_text(item: object) -> str:
    if isinstance(item, dict):
        item = (item.get("text") or item.get("label")
                or item.get("bullet") or "")
    return _one_line(_clean(item))


def _notes_text(value: object) -> str:
    return _clip(_clean(value).strip(), 4000)


def _is_takeaways(title: str) -> bool:
    return bool(_TAKEAWAY_RE.search(_clean(title)))


# --------------------------------------------------------- normalizing input

def _normalize_slide(raw: object, index: int) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    title = _one_line(_clean(raw.get("title"))) or f"Slide {index + 1}"
    bullets = [_bullet_text(item) for item in (raw.get("bullets") or [])
               if isinstance(item, (str, int, float, dict))] \
        if isinstance(raw.get("bullets"), (list, tuple)) else []
    bullets = [_clip(text, MAX_BULLET_CHARS) for text in bullets if text]
    bullets = bullets[:MAX_BULLETS]
    notes = _notes_text(raw.get("notes") or raw.get("note") or "")
    return {"title": _clip(title, MAX_TITLE_CHARS), "bullets": bullets,
            "notes": notes}


def _closing_bullets(slides: list[dict]) -> list[str]:
    """Lift the lead bullet from each substantive slide as the recap."""
    bullets: list[str] = []
    seen: set[str] = set()
    for slide in slides:
        if _is_takeaways(slide["title"]) or not slide["bullets"]:
            continue
        lead = slide["bullets"][0]
        key = lead.casefold()
        if key not in seen:
            seen.add(key)
            bullets.append(lead)
        if len(bullets) >= 6:
            break
    return bullets


# ------------------------------------------------------------ presentationml

def _paragraph(text: str, size: int, *, bold: bool = False,
               align: str | None = None, bullet: bool = False,
               color: str | None = None) -> str:
    ppr = ""
    if bullet:
        ppr = (
            '<a:pPr marL="457200" indent="-342900"'
            + (f' algn="{align}"' if align else "")
            + '><a:buClr><a:schemeClr val="accent1"/></a:buClr>'
            '<a:buFont typeface="Arial"/><a:buChar char="\u2022"/>'
            '<a:spcBef><a:spcPts val="600"/></a:spcBef></a:pPr>'
        )
    elif align:
        ppr = f'<a:pPr algn="{align}"/>'
    props = f'lang="en-US" sz="{size}"' + (' b="1"' if bold else "")
    fill = f'<a:solidFill><a:schemeClr val="{color}"/></a:solidFill>' \
        if color else ""
    return (
        f"<a:p>{ppr}<a:r><a:rPr {props} dirty=\"0\">{fill}</a:rPr>"
        f'<a:t>{_esc(text)}</a:t></a:r></a:p>'
    )


def _shape(shape_id: int, name: str, ph: str, geom: tuple[int, int, int, int],
           paragraphs: str, body_pr: str = "<a:bodyPr/>") -> str:
    x, y, cx, cy = geom
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name={_attr(name)}/>'
        f'<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
        f"<p:nvPr>{ph}</p:nvPr></p:nvSpPr>"
        f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm></p:spPr>'
        f"<p:txBody>{body_pr}<a:lstStyle/>"
        f"{paragraphs}</p:txBody></p:sp>"
    )


def _body_size(bullet_count: int) -> int:
    if bullet_count <= 6:
        return 2000
    if bullet_count <= 9:
        return 1800
    return 1600


def _slide_xml(shapes: str) -> str:
    return _XML_DECL + (
        f"<p:sld {_NS_DECL}><p:cSld><p:spTree>{_GROUP_TREE}{shapes}"
        "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>"
        "</p:sld>"
    )


def _title_slide_xml(title: str, subtitle: str) -> str:
    title_geom = (838200, 2286000, 10515600, 1828800)
    subtitle_geom = (838200, 4200000, 10515600, 914400)
    shapes = _shape(
        2, "Title 1", '<p:ph type="ctrTitle"/>', title_geom,
        _paragraph(title, 4400, bold=True, align="ctr"),
        '<a:bodyPr anchor="ctr"/>',
    )
    shapes += _shape(
        3, "Subtitle 2", '<p:ph type="subTitle" idx="1"/>', subtitle_geom,
        _paragraph(subtitle, 2000, align="ctr", color="tx2"),
        '<a:bodyPr anchor="ctr"/>',
    )
    return _slide_xml(shapes)


def _content_slide_xml(title: str, bullets: list[str]) -> str:
    title_geom = (838200, 365125, 10515600, 1181100)
    shapes = _shape(
        2, "Title 1", '<p:ph type="title"/>', title_geom,
        _paragraph(title, 3200, bold=True),
        '<a:bodyPr anchor="b"/>',
    )
    if bullets:
        size = _body_size(len(bullets))
        body = "".join(_paragraph(text, size, bullet=True)
                       for text in bullets)
        shapes += _shape(
            3, "Content Placeholder 2", '<p:ph type="body" idx="1"/>',
            (838200, 1600200, 10515600, 4572000), body,
            '<a:bodyPr><a:normAutofit/></a:bodyPr>',
        )
    return _slide_xml(shapes)


def _notes_slide_xml(notes: str) -> str:
    lines = notes.split("\n")
    while lines and not lines[-1].strip():
        lines.pop()
    body = "".join(
        _paragraph(line.strip(), 1200) if line.strip() else _EMPTY_PARA
        for line in lines
    ) or _EMPTY_PARA
    shapes = (
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/>'
        '<p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/>'
        '</p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr>'
        '<p:spPr><a:xfrm><a:off x="685800" y="685800"/>'
        '<a:ext cx="4937760" cy="3086100"/></a:xfrm></p:spPr></p:sp>'
    )
    shapes += _shape(
        3, "Notes Placeholder 2", '<p:ph type="body" idx="1"/>',
        (685800, 4400550, 4937760, 3600450), body,
        '<a:bodyPr><a:normAutofit/></a:bodyPr>',
    )
    return _XML_DECL + (
        f"<p:notes {_NS_DECL}><p:cSld><p:spTree>{_GROUP_TREE}{shapes}"
        "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>"
        "</p:notes>"
    )


def _layout_xml(name: str, kind: str, shapes: str) -> str:
    return _XML_DECL + (
        f'<p:sldLayout {_NS_DECL} type="{kind}" preserve="1">'
        f"<p:cSld name={_attr(name)}><p:spTree>{_GROUP_TREE}{shapes}"
        "</p:spTree></p:cSld>"
        "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>"
    )


def _master_xml() -> str:
    title_geom = (838200, 365125, 10515600, 1181100)
    body_geom = (838200, 1600200, 10515600, 4572000)
    shapes = _shape(
        2, "Title Placeholder 1", '<p:ph type="title"/>', title_geom,
        _paragraph("Click to edit title", 3200, bold=True),
    )
    shapes += _shape(
        3, "Text Placeholder 2", '<p:ph type="body" idx="1"/>', body_geom,
        _paragraph("Click to edit body text", 2000, bullet=True),
        '<a:bodyPr><a:normAutofit/></a:bodyPr>',
    )
    master = _XML_DECL + (
        f"<p:sldMaster {_NS_DECL}><p:cSld><p:bg><p:bgRef idx=\"1001\">"
        '<a:schemeClr val="bg1"/></p:bgRef></p:bg>'
        f"<p:spTree>{_GROUP_TREE}{shapes}</p:spTree></p:cSld>"
        + _CLR_MAP +
        '<p:sldLayoutIdLst>'
        '<p:sldLayoutId id="2147483649" r:id="rId1"/>'
        '<p:sldLayoutId id="2147483650" r:id="rId2"/>'
        "</p:sldLayoutIdLst>"
        "<p:txStyles>"
        '<p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="3200" b="1"/>'
        "</a:lvl1pPr></p:titleStyle>"
        "<p:bodyStyle>"
        '<a:lvl1pPr marL="0" indent="0"><a:defRPr sz="2000"/></a:lvl1pPr>'
        '<a:lvl2pPr marL="457200" indent="-342900"><a:defRPr sz="1800"/>'
        "</a:lvl2pPr>"
        "</p:bodyStyle>"
        '<p:otherStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr>'
        "</p:otherStyle>"
        "</p:txStyles></p:sldMaster>"
    )
    return master


def _notes_master_xml() -> str:
    shapes = _shape(
        2, "Notes Placeholder 1", '<p:ph type="body" idx="1"/>',
        (685800, 4400550, 4937760, 3600450), _EMPTY_PARA,
        '<a:bodyPr><a:normAutofit/></a:bodyPr>',
    )
    return _XML_DECL + (
        f"<p:notesMaster {_NS_DECL}><p:cSld><p:bg><p:bgRef idx=\"1001\">"
        '<a:schemeClr val="bg1"/></p:bgRef></p:bg>'
        f"<p:spTree>{_GROUP_TREE}{shapes}</p:spTree></p:cSld>"
        + _CLR_MAP +
        "<p:notesStyle>"
        '<a:lvl1pPr marL="0" indent="0"><a:defRPr sz="1200"/></a:lvl1pPr>'
        "</p:notesStyle></p:notesMaster>"
    )


def _theme_xml(accent1: str = "2563EB") -> str:
    accents = (accent1, "0EA5E9", "10B981", "F59E0B", "EF4444", "8B5CF6")
    clr = "".join(
        f'<a:accent{i + 1}><a:srgbClr val="{value}"/></a:accent{i + 1}>'
        for i, value in enumerate(accents)
    )
    solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
    grad = (
        '<a:gradFill rotWithShape="1"><a:gsLst>'
        '<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/>'
        '<a:satMod val="300000"/></a:schemeClr></a:gs>'
        '<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="40000"/>'
        '<a:satMod val="350000"/></a:schemeClr></a:gs>'
        '</a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill>'
    )
    line = (
        '<a:ln w="{w}" cap="flat" cmpd="sng" algn="ctr">'
        + solid +
        '<a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>'
    )
    effect = '<a:effectStyle><a:effectLst/></a:effectStyle>'
    theme = _XML_DECL + (
        f'<a:theme {_NS_DECL} name="Office Theme"><a:themeElements>'
        '<a:clrScheme name="Office">'
        '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>'
        '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
        '<a:dk2><a:srgbClr val="1F2937"/></a:dk2>'
        '<a:lt2><a:srgbClr val="F3F4F6"/></a:lt2>'
        + clr +
        '<a:hlink><a:srgbClr val="0563C1"/></a:hlink>'
        '<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>'
        "</a:clrScheme>"
        '<a:fontScheme name="Office">'
        '<a:majorFont><a:latin typeface="Calibri Light"/>'
        '<a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
        '<a:minorFont><a:latin typeface="Calibri"/>'
        '<a:ea typeface=""/><a:cs typeface=""/></a:minorFont>'
        "</a:fontScheme>"
        '<a:fmtScheme name="Office">'
        f'<a:fillStyleLst>{solid}{grad}{grad}</a:fillStyleLst>'
        "<a:lnStyleLst>" + line.format(w=6350) + line.format(w=12700)
        + line.format(w=19050) + "</a:lnStyleLst>"
        f"<a:effectStyleLst>{effect}{effect}{effect}</a:effectStyleLst>"
        f"<a:bgFillStyleLst>{solid}{solid}{grad}</a:bgFillStyleLst>"
        "</a:fmtScheme></a:themeElements>"
        "<a:objectDefaults/><a:extraClrSchemeLst/></a:theme>"
    )
    return theme


# ---------------------------------------------------------------- package bits

def _rels_xml(entries: list[tuple[str, str, str]]) -> str:
    """entries: (rId, relationship type, target)."""
    body = "".join(
        f'<Relationship Id="{rid}" Type="{rtype}" Target={_attr(target)}/>'
        for rid, rtype, target in entries
    )
    return _XML_DECL + (
        f'<Relationships xmlns="{_NS_PKG_REL}">{body}</Relationships>'
    )


def _presentation_xml(slide_rids: list[str], has_notes: bool) -> str:
    notes_master = (
        '<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/>'
        "</p:notesMasterIdLst>" if has_notes else ""
    )
    slide_ids = "".join(
        f'<p:sldId id="{256 + index}" r:id="{rid}"/>'
        for index, rid in enumerate(slide_rids)
    )
    return _XML_DECL + (
        f"<p:presentation {_NS_DECL} saveSubsetFonts=\"1\">"
        '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/>'
        "</p:sldMasterIdLst>" + notes_master +
        f"<p:sldIdLst>{slide_ids}</p:sldIdLst>"
        f'<p:sldSz cx="{SLIDE_WIDTH_EMU}" cy="{SLIDE_HEIGHT_EMU}"/>'
        '<p:notesSz cx="6858000" cy="9144000"/></p:presentation>'
    )


def _core_xml(deck_title: str, stamp: str) -> str:
    return _XML_DECL + (
        f'<cp:coreProperties xmlns:cp="{_NS_CP}" xmlns:dc="{_NS_DC}" '
        f'xmlns:dcterms="{_NS_DCTERMS}" xmlns:dcmitype="{_NS_DCMITYPE}" '
        f'xmlns:xsi="{_NS_XSI}">'
        f"<dc:title>{_esc(deck_title)}</dc:title>"
        "<dc:creator>Hermes Notebook</dc:creator>"
        "<cp:lastModifiedBy>Hermes Notebook</cp:lastModifiedBy>"
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{stamp}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{stamp}</dcterms:modified>'
        "</cp:coreProperties>"
    )


def _app_xml(slide_count: int, notes_count: int) -> str:
    return _XML_DECL + (
        f'<Properties xmlns="{_NS_EP}" xmlns:vt="{_NS_VT}">'
        "<Application>Hermes Notebook</Application>"
        "<PresentationFormat>Widescreen</PresentationFormat>"
        f"<Slides>{slide_count}</Slides><Notes>{notes_count}</Notes>"
        "<Company></Company></Properties>"
    )


def _content_types_xml(overrides: dict[str, str]) -> str:
    parts = "".join(
        f'<Override PartName={_attr("/" + name.lstrip("/"))} '
        f'ContentType="{ctype}"/>'
        for name, ctype in sorted(overrides.items())
    )
    return _XML_DECL + (
        f'<Types xmlns="{_NS_CT}">'
        '<Default Extension="rels" ContentType="application/'
        'vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        + parts + "</Types>"
    )


def _zip_bytes(parts: dict[str, tuple[bytes, str]]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        ordered = ["[Content_Types].xml"] + [
            name for name in parts if name != "[Content_Types].xml"
        ]
        for name in ordered:
            data = parts[name][0]
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, data)
    return buffer.getvalue()


# --------------------------------------------------------------------- public

def build_pptx(deck_title: str, slides: list[dict], subtitle: str = "") -> bytes:
    """Render a slide deck (the artifact JSON shape) as a PPTX file.

    Parameters
    ----------
    deck_title:
        Deck title; also the title slide headline and the document title.
    slides:
        ``[{"title": str, "bullets": [str, ...], "notes": str}, ...]``.
        Missing/blank titles fall back to ``Slide N``; empty bullet lists are
        allowed.  ``"note"`` is accepted as an alias for ``"notes"``.
    subtitle:
        Title-slide subtitle / one-line framing.  May be empty.

    Returns
    ----
    bytes
        The complete ``.pptx`` package, ready to write to disk or stream.

    The function always emits at least the title slide, never raises on
    malformed slide entries, and only includes notes parts when at least one
    slide has notes text.
    """
    title = _clip(_one_line(_clean(deck_title)) or "Untitled deck",
                  MAX_TITLE_CHARS)
    subtitle_text = _clip(_clean(subtitle).strip(), MAX_TITLE_CHARS)

    raw_slides = slides if isinstance(slides, (list, tuple)) else []
    normalized = [_normalize_slide(item, index)
                  for index, item in enumerate(raw_slides)]
    # An empty deck still yields a cover and a bullet-less recap, so every
    # generated package has at least two slides and opens cleanly.
    last_is_takeaways = bool(normalized) and _is_takeaways(
        normalized[-1]["title"])
    if not last_is_takeaways:
        normalized.append({
            "title": "Key takeaways",
            "bullets": _closing_bullets(normalized),
            "notes": "",
        })

    notes_count = sum(1 for slide in normalized if slide["notes"])
    has_notes = notes_count > 0

    parts: dict[str, tuple[bytes, str]] = {}

    def add(name: str, xml: str, ctype: str) -> None:
        parts[name] = (xml.encode("utf-8"), ctype)

    # rel ids for the presentation part: master, optional notes master, slides.
    output_slides = [None] + normalized  # None is the cover slide
    next_rid = 2 if has_notes else 1
    slide_rids = []
    for _ in output_slides:
        next_rid += 1
        slide_rids.append(f"rId{next_rid}")

    presentation_rels = [("rId1", REL_SLIDE_MASTER,
                          "slideMasters/slideMaster1.xml")]
    if has_notes:
        presentation_rels.append(("rId2", REL_NOTES_MASTER,
                                  "notesMasters/notesMaster1.xml"))
    for index, rid in enumerate(slide_rids, start=1):
        presentation_rels.append((rid, REL_SLIDE,
                                  f"slides/slide{index}.xml"))
    presentation_rels.append((f"rId{next_rid + 1}", REL_THEME,
                              "theme/theme1.xml"))

    add("ppt/presentation.xml",
        _presentation_xml(slide_rids, has_notes),
        CT_PRESENTATION)
    add("ppt/_rels/presentation.xml.rels", _rels_xml(presentation_rels),
        "application/vnd.openxmlformats-package.relationships+xml")
    add("ppt/slideMasters/slideMaster1.xml", _master_xml(), CT_SLIDE_MASTER)
    add("ppt/slideMasters/_rels/slideMaster1.xml.rels",
        _rels_xml([
            ("rId1", REL_SLIDE_LAYOUT, "../slideLayouts/slideLayout1.xml"),
            ("rId2", REL_SLIDE_LAYOUT, "../slideLayouts/slideLayout2.xml"),
            ("rId3", REL_THEME, "../theme/theme1.xml"),
        ]), "application/vnd.openxmlformats-package.relationships+xml")

    layout1_shapes = _shape(
        2, "Title 1", '<p:ph type="ctrTitle"/>',
        (838200, 2286000, 10515600, 1828800),
        _paragraph("Click to edit title", 4400, bold=True, align="ctr"),
        '<a:bodyPr anchor="ctr"/>',
    ) + _shape(
        3, "Subtitle 2", '<p:ph type="subTitle" idx="1"/>',
        (838200, 4200000, 10515600, 914400),
        _paragraph("Click to edit subtitle", 2000, align="ctr", color="tx2"),
        '<a:bodyPr anchor="ctr"/>',
    )
    layout2_shapes = _shape(
        2, "Title 1", '<p:ph type="title"/>',
        (838200, 365125, 10515600, 1181100),
        _paragraph("Click to edit title", 3200, bold=True),
        '<a:bodyPr anchor="b"/>',
    ) + _shape(
        3, "Content Placeholder 2", '<p:ph type="body" idx="1"/>',
        (838200, 1600200, 10515600, 4572000),
        _paragraph("Click to edit body text", 2000, bullet=True),
        '<a:bodyPr><a:normAutofit/></a:bodyPr>',
    )
    add("ppt/slideLayouts/slideLayout1.xml",
        _layout_xml("Title Slide", "title", layout1_shapes), CT_SLIDE_LAYOUT)
    add("ppt/slideLayouts/_rels/slideLayout1.xml.rels",
        _rels_xml([("rId1", REL_SLIDE_MASTER, "../slideMasters/slideMaster1.xml")]),
        "application/vnd.openxmlformats-package.relationships+xml")
    add("ppt/slideLayouts/slideLayout2.xml",
        _layout_xml("Title and Content", "obj", layout2_shapes), CT_SLIDE_LAYOUT)
    add("ppt/slideLayouts/_rels/slideLayout2.xml.rels",
        _rels_xml([("rId1", REL_SLIDE_MASTER, "../slideMasters/slideMaster1.xml")]),
        "application/vnd.openxmlformats-package.relationships+xml")

    add("ppt/theme/theme1.xml", _theme_xml(), CT_THEME)

    if has_notes:
        add("ppt/notesMasters/notesMaster1.xml", _notes_master_xml(),
            CT_NOTES_MASTER)
        add("ppt/notesMasters/_rels/notesMaster1.xml.rels",
            _rels_xml([("rId1", REL_THEME, "../theme/theme1.xml")]),
            "application/vnd.openxmlformats-package.relationships+xml")

    notes_index = 0
    for index, slide in enumerate(output_slides, start=1):
        layout = 1 if slide is None else 2
        rels = [("rId1", REL_SLIDE_LAYOUT,
                 f"../slideLayouts/slideLayout{layout}.xml")]
        notes = "" if slide is None else slide["notes"]
        if notes:
            notes_index += 1
            notes_rid = "rId2"
            add(f"ppt/slides/_rels/slide{index}.xml.rels",
                _rels_xml(rels + [(notes_rid, REL_NOTES_SLIDE,
                                   f"../notesSlides/notesSlide{notes_index}.xml")]),
                "application/vnd.openxmlformats-package.relationships+xml")
            add(f"ppt/notesSlides/notesSlide{notes_index}.xml",
                _notes_slide_xml(notes), CT_NOTES_SLIDE)
            add(f"ppt/notesSlides/_rels/notesSlide{notes_index}.xml.rels",
                _rels_xml([
                    ("rId1", REL_SLIDE, f"../slides/slide{index}.xml"),
                    ("rId2", REL_NOTES_MASTER, "../notesMasters/notesMaster1.xml"),
                ]), "application/vnd.openxmlformats-package.relationships+xml")
        else:
            add(f"ppt/slides/_rels/slide{index}.xml.rels", _rels_xml(rels),
                "application/vnd.openxmlformats-package.relationships+xml")
        if slide is None:
            xml = _title_slide_xml(title, subtitle_text)
        else:
            xml = _content_slide_xml(slide["title"], slide["bullets"])
        add(f"ppt/slides/slide{index}.xml", xml, CT_SLIDE)

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    add("docProps/core.xml", _core_xml(title, stamp), CT_CORE)
    add("docProps/app.xml", _app_xml(len(output_slides), notes_count), CT_APP)

    overrides = {
        name: ctype for name, (_data, ctype) in parts.items()
        if not ctype.endswith("relationships+xml")
    }
    # The content-types part is never itself an override and always goes first.
    parts["[Content_Types].xml"] = (
        _content_types_xml(overrides).encode("utf-8"), "application/xml")
    add("_rels/.rels", _rels_xml([
        ("rId1", REL_OFFICE_DOCUMENT, "ppt/presentation.xml"),
        ("rId2", REL_CORE, "docProps/core.xml"),
        ("rId3", REL_APP, "docProps/app.xml"),
    ]), "application/vnd.openxmlformats-package.relationships+xml")

    return _zip_bytes(parts)
