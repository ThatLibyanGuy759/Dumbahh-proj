from flask import Blueprint, request, jsonify
from models import db, Workbook, Sheet

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
