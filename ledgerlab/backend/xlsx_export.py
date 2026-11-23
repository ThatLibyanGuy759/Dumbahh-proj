"""Export a stored workbook (all sheets, with formatting and live formulas) to a styled .xlsx."""
import io
import json

from openpyxl import Workbook as XLWorkbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.properties import CalcProperties

NUMBER_FORMATS = {
    "currency": '"$"#,##0.00;-"$"#,##0.00',
    "accounting": '"$"#,##0.00;-"$"#,##0.00;""',  # zeros shown blank
    "percentage": "0.00%",
    "number": "0.00",
}
BORDER_STYLES = {"thin": "thin", "medium": "medium", "double": "double", "thick": "thick"}


def _hex(color):
    if not color:
        return None
    c = color.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return ("FF" + c.upper()) if len(c) == 6 else None


def parse_border(spec):
    """'top:thin;bottom:double' -> {'top': 'thin', 'bottom': 'double'}"""
    sides = {}
    for part in (spec or "").split(";"):
        if ":" in part:
            side, style = part.split(":", 1)
            side, style = side.strip(), style.strip()
            if side in ("top", "bottom", "left", "right") and style in BORDER_STYLES:
                sides[side] = style
    return sides


def _coerce(raw):
    if raw is None or raw == "":
        return None
    if raw.startswith("="):
        return raw
    try:
        num = float(raw)
        # Keep values like "100" (account numbers) numeric too; Excel shows them identically.
        return int(num) if num.is_integer() and "." not in raw else num
    except ValueError:
        return raw


def export_workbook(workbook):
    xl = XLWorkbook()
    xl.remove(xl.active)

    for sheet in sorted(workbook.sheets, key=lambda s: s.position):
        ws = xl.create_sheet(title=sheet.name[:31])

        widths = json.loads(sheet.col_widths or "{}")
        for col, px in widths.items():
            ws.column_dimensions[get_column_letter(int(col) + 1)].width = max(4, round(float(px) / 7, 1))

        for cell in sheet.cells:
            xc = ws.cell(row=cell.row + 1, column=cell.col + 1)
            value = _coerce(cell.raw_value)
            if value is not None:
                xc.value = value
            xc.font = Font(
                bold=bool(cell.font_bold),
                italic=bool(cell.font_italic),
                size=cell.font_size or 11,
                color=_hex(cell.font_color) or "FF000000",
            )
            fill = _hex(cell.bg_color)
            if fill:
                xc.fill = PatternFill(fill_type="solid", start_color=fill, end_color=fill)
            xc.alignment = Alignment(horizontal=cell.text_align or None, vertical="center")
            fmt = NUMBER_FORMATS.get(cell.format_type)
            if fmt:
                xc.number_format = fmt
            sides = parse_border(cell.border)
            if sides:
                xc.border = Border(**{s: Side(style=st) for s, st in sides.items()})

        for m in json.loads(sheet.merges or "[]"):
            rs, cs = int(m.get("rs", 1)), int(m.get("cs", 1))
            if rs > 1 or cs > 1:
                ws.merge_cells(start_row=m["r"] + 1, start_column=m["c"] + 1,
                               end_row=m["r"] + rs, end_column=m["c"] + cs)

    if not xl.worksheets:
        xl.create_sheet("Sheet1")
    # Make Excel recalculate every formula when the file is opened
    xl.calculation = CalcProperties(fullCalcOnLoad=True)

    buf = io.BytesIO()
    xl.save(buf)
    buf.seek(0)
    return buf
