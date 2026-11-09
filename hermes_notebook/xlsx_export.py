"""A data table as a real workbook, built from the stored artifact JSON.

The CSV is the interchange format and stays the artifact: it opens anywhere and
diffs in git. A spreadsheet is a different product — typed columns, a frozen
header, an auto-filter, number formats the reader can sum — so this builds one
from the same JSON the viewer draws, and the workbook can therefore never
disagree with the table on screen.

openpyxl is already a declared plugin dependency (it is what `extract.py` uses
to READ workbooks); writing one needs no new package.
"""

from __future__ import annotations

from typing import Any, Dict, List

MEDIA = ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def _is_number(text: str) -> bool:
    """A cell is numeric when it is ONLY a number with optional unit decoration.

    Deliberately strict: "1.2 GW" is a value with a unit and stays text, while
    "$4.48" and "38%" become numbers so a reader can sort or sum the column.
    Converting "28 to 30" into a number would be a lie, so it stays text.
    """
    s = str(text or "").strip()
    if not s:
        return False
    for junk in ("$", "£", "€", "%", ",", " ", "\u00a0"):
        s = s.replace(junk, "")
    if s in ("", "-", "—", "n/a", "N/A"):
        return False
    try:
        float(s)
        return True
    except ValueError:
        return False


def _clean(text: Any, limit: int = 4000) -> str:
    return str(text if text is not None else "").strip()[:limit]


def workbook(data: Dict[str, Any]) -> bytes:
    """Render the table to .xlsx bytes. Raises if openpyxl is unavailable."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise RuntimeError(
            "xlsx export needs the openpyxl package (declared plugin dependency)") from exc

    cols: List[str] = [_clean(c, 120) for c in (data.get("columns") or []) if _clean(c, 120)]
    if not cols:
        cols = ["column_1"]
    rows = [r if isinstance(r, list) else [r] for r in (data.get("rows") or [])]

    wb = Workbook()
    ws = wb.active
    ws.title = _clean(data.get("title"), 28) or "Data"

    head_fill = PatternFill("solid", fgColor="0F172A")
    head_font = Font(bold=True, color="FFFFFF", size=11)
    for i, name in enumerate(cols, 1):
        cell = ws.cell(row=1, column=i, value=name)
        cell.fill = head_fill
        cell.font = head_font
        cell.alignment = Alignment(horizontal="left")

    for r_i, row in enumerate(rows, 2):
        for c_i in range(len(cols)):
            raw = row[c_i] if c_i < len(row) else ""
            text = _clean(raw)
            if _is_number(text):
                # a numeric cell is stored as a number so the column can be summed
                try:
                    ws.cell(row=r_i, column=c_i + 1,
                            value=float(text.replace("$", "").replace("£", "")
                                       .replace("€", "").replace("%", "").replace(",", "")))
                except ValueError:
                    ws.cell(row=r_i, column=c_i + 1, value=text)
            else:
                ws.cell(row=r_i, column=c_i + 1, value=text)

    # widths follow the longest cell so a column is not truncated to "###"
    for c_i in range(len(cols)):
        widest = max([len(cols[c_i])] + [len(_clean(r[c_i] if c_i < len(r) else ""))
                                          for r in rows]) if rows else len(cols[c_i])
        ws.column_dimensions[get_column_letter(c_i + 1)].width = min(60, max(10, widest + 2))

    ws.freeze_panes = "A2"
    if len(rows) and len(cols):
        ws.auto_filter.ref = f"A1:{get_column_letter(len(cols))}{len(rows) + 1}"

    # the computed aggregates the prompt asked for, on their own sheet
    summary = data.get("summary") or []
    if summary:
        ws2 = wb.create_sheet("Summary")
        ws2.append(["Metric", "Value", "Basis"])
        for item in summary:
            if not isinstance(item, dict):
                continue
            ws2.append([_clean(item.get("label"), 200), _clean(item.get("value"), 200),
                        _clean(item.get("basis"), 400)])
        for i, width in enumerate((38, 20, 60), 1):
            ws2.column_dimensions[get_column_letter(i)].width = width

    import io
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
