from flask import Blueprint, request, jsonify
from models import db, BankTransaction
from datetime import date

bp = Blueprint("bank_reconciliation", __name__, url_prefix="/api/bank-transactions")


@bp.route("", methods=["GET"])
def list_transactions():
    assignment_id = request.args.get("assignment_id", type=int)
    query = BankTransaction.query
    if assignment_id:
        query = query.filter_by(assignment_id=assignment_id)
    transactions = query.order_by(BankTransaction.date.desc()).all()
    return jsonify([t.to_dict() for t in transactions])


@bp.route("", methods=["POST"])
def create_transaction():
    data = request.get_json()
    txn = BankTransaction(
        date=date.fromisoformat(data["date"]) if data.get("date") else date.today(),
        description=data.get("description", ""),
        amount=float(data["amount"]),
        balance=float(data.get("balance", 0)),
        reference=data.get("reference", ""),
        assignment_id=data.get("assignment_id"),
    )
    db.session.add(txn)
    db.session.commit()
    return jsonify(txn.to_dict()), 201


@bp.route("/batch", methods=["POST"])
def batch_create():
    data = request.get_json()
    transactions = []
    for t_data in data.get("transactions", []):
        txn = BankTransaction(
            date=date.fromisoformat(t_data["date"]) if t_data.get("date") else date.today(),
            description=t_data.get("description", ""),
            amount=float(t_data["amount"]),
            balance=float(t_data.get("balance", 0)),
            reference=t_data.get("reference", ""),
            assignment_id=data.get("assignment_id"),
        )
        db.session.add(txn)
        transactions.append(txn)
    db.session.commit()
    return jsonify([t.to_dict() for t in transactions]), 201


@bp.route("/<int:id>/reconcile", methods=["POST"])
def reconcile_transaction(id):
    txn = BankTransaction.query.get_or_404(id)
    data = request.get_json()
    txn.is_reconciled = True
    txn.matched_journal_line_id = data.get("journal_line_id")
    db.session.commit()
    return jsonify(txn.to_dict())


@bp.route("/<int:id>/unreconcile", methods=["POST"])
def unreconcile_transaction(id):
    txn = BankTransaction.query.get_or_404(id)
    txn.is_reconciled = False
    txn.matched_journal_line_id = None
    db.session.commit()
    return jsonify(txn.to_dict())


@bp.route("/<int:id>", methods=["DELETE"])
def delete_transaction(id):
    txn = BankTransaction.query.get_or_404(id)
    db.session.delete(txn)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@bp.route("/summary", methods=["GET"])
def reconciliation_summary():
    assignment_id = request.args.get("assignment_id", type=int)
    query = BankTransaction.query
    if assignment_id:
        query = query.filter_by(assignment_id=assignment_id)

    all_txns = query.all()
    reconciled = [t for t in all_txns if t.is_reconciled]
    unreconciled = [t for t in all_txns if not t.is_reconciled]

    return jsonify({
        "total_transactions": len(all_txns),
        "reconciled_count": len(reconciled),
        "unreconciled_count": len(unreconciled),
        "reconciled_total": round(sum(t.amount for t in reconciled), 2),
        "unreconciled_total": round(sum(t.amount for t in unreconciled), 2),
        "bank_balance": all_txns[-1].balance if all_txns else 0,
    })
