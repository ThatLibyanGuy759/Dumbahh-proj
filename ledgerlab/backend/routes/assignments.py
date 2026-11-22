from flask import Blueprint, request, jsonify
from models import db, Assignment
from datetime import datetime

bp = Blueprint("assignments", __name__, url_prefix="/api/assignments")


@bp.route("", methods=["GET"])
def list_assignments():
    assignments = Assignment.query.order_by(Assignment.updated_at.desc()).all()
    return jsonify([a.to_dict() for a in assignments])


@bp.route("", methods=["POST"])
def create_assignment():
    data = request.get_json()
    assignment = Assignment(
        name=data.get("name", "Untitled Assignment"),
        description=data.get("description", ""),
        course=data.get("course", ""),
        status=data.get("status", "in_progress"),
        due_date=datetime.fromisoformat(data["due_date"]) if data.get("due_date") else None,
    )
    db.session.add(assignment)
    db.session.commit()
    return jsonify(assignment.to_dict()), 201


@bp.route("/<int:id>", methods=["GET"])
def get_assignment(id):
    assignment = Assignment.query.get_or_404(id)
    d = assignment.to_dict()
    d["workbooks"] = [w.to_dict() for w in assignment.workbooks]
    d["reports"] = [r.to_dict() for r in assignment.reports]
    return jsonify(d)


@bp.route("/<int:id>", methods=["PUT"])
def update_assignment(id):
    assignment = Assignment.query.get_or_404(id)
    data = request.get_json()
    if "name" in data:
        assignment.name = data["name"]
    if "description" in data:
        assignment.description = data["description"]
    if "course" in data:
        assignment.course = data["course"]
    if "status" in data:
        assignment.status = data["status"]
    if "due_date" in data:
        assignment.due_date = datetime.fromisoformat(data["due_date"]) if data["due_date"] else None
    db.session.commit()
    return jsonify(assignment.to_dict())


@bp.route("/<int:id>", methods=["DELETE"])
def delete_assignment(id):
    assignment = Assignment.query.get_or_404(id)
    db.session.delete(assignment)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200
