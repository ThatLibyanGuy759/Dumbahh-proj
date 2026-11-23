from flask import Blueprint, request, jsonify
from models import db, Report, Account, JournalLine, JournalEntry, scope_query
import json

bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def _get_account_balances(assignment_id=None):
    """
    Calculate current balance for accounts incorporating:
    - account.opening_balance (Beginning Balance)
    - Posted journal entry debits and credits
    """
    accounts = scope_query(Account.query, Account, assignment_id).order_by(Account.code).all()

    balances = {}
    for account in accounts:
        line_query = (
            JournalLine.query
            .join(JournalEntry)
            .filter(JournalLine.account_id == account.id, JournalEntry.status == "posted")
        )
        line_query = scope_query(line_query, JournalEntry, assignment_id)

        lines = line_query.all()
        total_debit = sum(l.debit for l in lines)
        total_credit = sum(l.credit for l in lines)
        open_bal = float(account.opening_balance or 0.0)

        # Net balance based on normal balance
        if account.normal_balance == "debit":
            balance = open_bal + total_debit - total_credit
        else:
            balance = open_bal + total_credit - total_debit

        has_activity = (total_debit > 0 or total_credit > 0 or abs(open_bal) > 0.001)

        balances[account.id] = {
            "account": account.to_dict(),
            "opening_balance": round(open_bal, 2),
            "total_debit": round(total_debit, 2),
            "total_credit": round(total_credit, 2),
            "balance": round(balance, 2),
            "has_activity": has_activity,
        }
    return balances


@bp.route("", methods=["GET"])
def list_reports():
    assignment_id = request.args.get("assignment_id", type=int)
    query = Report.query
    if assignment_id:
        query = query.filter_by(assignment_id=assignment_id)
    reports = query.order_by(Report.updated_at.desc()).all()
    return jsonify([r.to_dict() for r in reports])


@bp.route("", methods=["POST"])
def create_report():
    data = request.get_json()
    report = Report(
        name=data.get("name", "Untitled Report"),
        report_type=data["report_type"],
        assignment_id=data.get("assignment_id"),
        company_name=data.get("company_name", ""),
        reporting_period=data.get("reporting_period", ""),
        data=json.dumps(data.get("data", {})),
        template=data.get("template", "standard"),
    )
    db.session.add(report)
    db.session.commit()
    return jsonify(report.to_dict()), 201


@bp.route("/<int:id>", methods=["GET"])
def get_report(id):
    report = Report.query.get_or_404(id)
    return jsonify(report.to_dict())


@bp.route("/<int:id>", methods=["PUT"])
def update_report(id):
    report = Report.query.get_or_404(id)
    data = request.get_json()
    for field in ["name", "report_type", "company_name", "reporting_period", "template"]:
        if field in data:
            setattr(report, field, data[field])
    if "data" in data:
        report.data = json.dumps(data["data"])
    db.session.commit()
    return jsonify(report.to_dict())


@bp.route("/<int:id>", methods=["DELETE"])
def delete_report(id):
    report = Report.query.get_or_404(id)
    db.session.delete(report)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@bp.route("/generate/trial-balance", methods=["GET"])
def generate_trial_balance():
    """
    Generate trial balance from posted journal entries + opening balances.
    Query param `hide_unused=true` filters out accounts not used in period.
    """
    assignment_id = request.args.get("assignment_id", type=int)
    hide_unused = request.args.get("hide_unused", "true").lower() == "true"

    balances = _get_account_balances(assignment_id)
    trial_balance = []
    total_debits = 0.0
    total_credits = 0.0

    for acc_id, data in balances.items():
        account = data["account"]
        bal = data["balance"]

        # If user wants unused accounts hidden and there was neither opening balance nor transactions:
        if hide_unused and not data["has_activity"] and abs(bal) < 0.001:
            continue

        debit_col = 0.0
        credit_col = 0.0

        if account["normal_balance"] == "debit":
            if bal >= 0:
                debit_col = bal
            else:
                credit_col = abs(bal)
        else:  # credit normal
            if bal >= 0:
                credit_col = bal
            else:
                debit_col = abs(bal)

        total_debits += debit_col
        total_credits += credit_col

        trial_balance.append({
            "account_id": account["id"],
            "account_code": account["code"],
            "account_name": account["name"],
            "account_type": account["account_type"],
            "debit": round(debit_col, 2),
            "credit": round(credit_col, 2),
            "balance": round(bal, 2),
        })

    return jsonify({
        "accounts": trial_balance,
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "is_balanced": abs(total_debits - total_credits) < 0.01,
        "difference": round(abs(total_debits - total_credits), 2),
    })


@bp.route("/generate/income-statement", methods=["GET"])
def generate_income_statement():
    """Generate income statement from posted journal entries (Revenues & Expenses)."""
    assignment_id = request.args.get("assignment_id", type=int)
    hide_unused = request.args.get("hide_unused", "true").lower() == "true"

    balances = _get_account_balances(assignment_id)
    revenues = []
    expenses = []
    total_revenue = 0.0
    total_expenses = 0.0

    for acc_id, data in balances.items():
        account = data["account"]
        amt = data["balance"]

        if hide_unused and not data["has_activity"] and abs(amt) < 0.001:
            continue

        if account["account_type"] == "revenue":
            revenues.append({
                "account_id": account["id"],
                "account_code": account["code"],
                "account_name": account["name"],
                "amount": round(amt, 2),
            })
            total_revenue += amt
        elif account["account_type"] == "expense":
            expenses.append({
                "account_id": account["id"],
                "account_code": account["code"],
                "account_name": account["name"],
                "amount": round(amt, 2),
            })
            total_expenses += amt

    return jsonify({
        "revenues": revenues,
        "expenses": expenses,
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
        "net_income": round(total_revenue - total_expenses, 2),
    })


@bp.route("/generate/balance-sheet", methods=["GET"])
def generate_balance_sheet():
    """
    Generate balance sheet.
    Calculates Assets, Liabilities, and Owner's Equity (Capital + Net Income - Drawings).
    Verifies A = L + E.
    """
    assignment_id = request.args.get("assignment_id", type=int)
    hide_unused = request.args.get("hide_unused", "true").lower() == "true"

    balances = _get_account_balances(assignment_id)
    assets = []
    liabilities = []
    capital_items = []
    drawings_items = []
    other_equity = []

    total_assets = 0.0
    total_liabilities = 0.0
    total_capital = 0.0
    total_drawings = 0.0

    # Calculate net income
    net_income = 0.0
    for data in balances.values():
        acc = data["account"]
        if acc["account_type"] == "revenue":
            net_income += data["balance"]
        elif acc["account_type"] == "expense":
            net_income -= data["balance"]

    for acc_id, data in balances.items():
        account = data["account"]
        amt = data["balance"]

        if hide_unused and not data["has_activity"] and abs(amt) < 0.001:
            continue

        item = {
            "account_id": account["id"],
            "account_code": account["code"],
            "account_name": account["name"],
            "amount": round(amt, 2),
        }

        acc_name_lower = account["name"].lower()

        if account["account_type"] == "asset":
            assets.append(item)
            total_assets += amt
        elif account["account_type"] == "liability":
            liabilities.append(item)
            total_liabilities += amt
        elif account["account_type"] == "equity":
            if "drawing" in acc_name_lower:
                drawings_items.append(item)
                total_drawings += amt
            elif "capital" in acc_name_lower:
                capital_items.append(item)
                total_capital += amt
            else:
                other_equity.append(item)
                total_capital += amt

    # Ending owner's equity: Capital + Net Income - Drawings
    ending_capital = total_capital + net_income - total_drawings
    total_liabilities_and_equity = total_liabilities + ending_capital

    return jsonify({
        "assets": assets,
        "liabilities": liabilities,
        "capital_items": capital_items,
        "drawings_items": drawings_items,
        "other_equity": other_equity,
        "beginning_capital": round(total_capital, 2),
        "net_income": round(net_income, 2),
        "drawings": round(total_drawings, 2),
        "ending_capital": round(ending_capital, 2),
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "total_equity": round(ending_capital, 2),
        "total_liabilities_and_equity": round(total_liabilities_and_equity, 2),
        "is_balanced": abs(total_assets - total_liabilities_and_equity) < 0.01,
        "difference": round(abs(total_assets - total_liabilities_and_equity), 2),
    })
