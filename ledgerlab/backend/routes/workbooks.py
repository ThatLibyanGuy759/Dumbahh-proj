import re
from flask import Blueprint, request, jsonify, send_file
from models import db, Workbook, Sheet
from accounting_workbook import generate_accounting_workbook, find_generated_workbook
from xlsx_export import export_workbook

bp = Blueprint("workbooks", __name__, url_prefix="/api/workbooks")


@bp.route("", methods=["GET"])
def list_workbooks():
    assignment_id = request.args.get("assignment_id", type=int)
    query = Workbook.query
    if assignment_id:
        query = query.filter_by(assignment_id=assignment_id)
    workbooks = query.order_by(Workbook.updated_at.desc()).all()
    return jsonify([w.to_dict() for w in workbooks])


@bp.route("", methods=["POST"])
def create_workbook():
    data = request.get_json()
    workbook = Workbook(
        name=data.get("name", "Untitled Workbook"),
        description=data.get("description", ""),
        assignment_id=data.get("assignment_id"),
    )
    db.session.add(workbook)
    db.session.flush()

    # Create default sheet
    sheet = Sheet(name="Sheet 1", workbook_id=workbook.id, position=0)
    db.session.add(sheet)
    db.session.commit()
    return jsonify(workbook.to_dict(include_sheets=True)), 201


@bp.route("/<int:id>", methods=["GET"])
def get_workbook(id):
    workbook = Workbook.query.get_or_404(id)
    return jsonify(workbook.to_dict(include_sheets=True))


@bp.route("/<int:id>", methods=["PUT"])
def update_workbook(id):
    workbook = Workbook.query.get_or_404(id)
    data = request.get_json()
    if "name" in data:
        workbook.name = data["name"]
    if "description" in data:
        workbook.description = data["description"]
    if "assignment_id" in data:
        workbook.assignment_id = data["assignment_id"]
    db.session.commit()
    return jsonify(workbook.to_dict())


@bp.route("/<int:id>", methods=["DELETE"])
def delete_workbook(id):
    workbook = Workbook.query.get_or_404(id)
    db.session.delete(workbook)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200


@bp.route("/generate-accounting", methods=["POST"])
def generate_accounting():
    """Generate (or regenerate) the formatted accounting workbook for an assignment.
    If one already exists and `overwrite` is not true, returns 409 with the existing workbook."""
    data = request.get_json() or {}
    assignment_id = data.get("assignment_id") or None
    overwrite = bool(data.get("overwrite", False))

    existing = find_generated_workbook(assignment_id)
    if existing and not overwrite:
        return jsonify({"error": "exists", "workbook": existing.to_dict(include_sheets=True)}), 409

    wb = generate_accounting_workbook(assignment_id)
    return jsonify(wb.to_dict(include_sheets=True)), 201


@bp.route("/<int:id>/export", methods=["GET"])
def export_xlsx(id):
    workbook = Workbook.query.get_or_404(id)
    buf = export_workbook(workbook)
    base = workbook.name
    if workbook.assignment and workbook.description == "generated:accounting":
        base = f"{workbook.assignment.name} - {workbook.name}"
    filename = re.sub(r'[\\/:*?"<>|]+', "_", base).strip() or "workbook"
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"{filename}.xlsx",
    )
