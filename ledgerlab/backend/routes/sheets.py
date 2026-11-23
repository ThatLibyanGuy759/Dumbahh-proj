from flask import Blueprint, request, jsonify
from models import db, Sheet, Cell
import json

bp = Blueprint("sheets", __name__, url_prefix="/api/sheets")


@bp.route("", methods=["POST"])
def create_sheet():
    data = request.get_json()
    workbook_id = data["workbook_id"]
    max_pos = db.session.query(db.func.max(Sheet.position)).filter_by(workbook_id=workbook_id).scalar() or 0
    sheet = Sheet(
        name=data.get("name", f"Sheet {max_pos + 2}"),
        workbook_id=workbook_id,
        position=max_pos + 1,
        row_count=data.get("row_count", 100),
        col_count=data.get("col_count", 26),
    )
    db.session.add(sheet)
    db.session.commit()
    return jsonify(sheet.to_dict()), 201


@bp.route("/<int:id>", methods=["GET"])
def get_sheet(id):
    sheet = Sheet.query.get_or_404(id)
    return jsonify(sheet.to_dict(include_cells=True))


@bp.route("/<int:id>", methods=["PUT"])
def update_sheet(id):
    sheet = Sheet.query.get_or_404(id)
    data = request.get_json()
    for field in ["name", "position", "row_count", "col_count", "frozen_rows", "frozen_cols"]:
        if field in data:
            setattr(sheet, field, data[field])
    if "col_widths" in data:
        sheet.col_widths = json.dumps(data["col_widths"])
    if "row_heights" in data:
        sheet.row_heights = json.dumps(data["row_heights"])
    if "merges" in data:
        sheet.merges = json.dumps(data["merges"])
    db.session.commit()
    return jsonify(sheet.to_dict())


@bp.route("/<int:id>", methods=["DELETE"])
def delete_sheet(id):
    sheet = Sheet.query.get_or_404(id)
    db.session.delete(sheet)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200


@bp.route("/<int:id>/cells", methods=["GET"])
def get_cells(id):
    Sheet.query.get_or_404(id)
    cells = Cell.query.filter_by(sheet_id=id).all()
    return jsonify([c.to_dict() for c in cells])


@bp.route("/<int:id>/cells", methods=["PUT"])
def update_cells(id):
    """Batch update cells. Expects: { "cells": [ {row, col, raw_value, ...}, ... ] }"""
    Sheet.query.get_or_404(id)
    data = request.get_json()
    cells_data = data.get("cells", [])

    for cell_data in cells_data:
        row = cell_data["row"]
        col = cell_data["col"]

        cell = Cell.query.filter_by(sheet_id=id, row=row, col=col).first()
        if cell is None:
            cell = Cell(sheet_id=id, row=row, col=col)
            db.session.add(cell)

        for field in ["raw_value", "computed_value", "data_type", "format_type",
                      "decimal_places", "font_bold", "font_italic", "font_size",
                      "font_color", "bg_color", "text_align", "border"]:
            if field in cell_data:
                setattr(cell, field, cell_data[field])

    db.session.commit()
    cells = Cell.query.filter_by(sheet_id=id).all()
    return jsonify([c.to_dict() for c in cells])


@bp.route("/<int:id>/cells/clear", methods=["POST"])
def clear_cells(id):
    """Clear specific cells. Expects: { "cells": [ {row, col}, ... ] }"""
    Sheet.query.get_or_404(id)
    data = request.get_json()
    for pos in data.get("cells", []):
        Cell.query.filter_by(sheet_id=id, row=pos["row"], col=pos["col"]).delete()
    db.session.commit()
    return jsonify({"message": "Cleared"})
