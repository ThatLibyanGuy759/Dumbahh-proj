from flask import Blueprint, request, jsonify
from models import db, Account, JournalLine, JournalEntry, BankTransaction

bp = Blueprint("accounts", __name__, url_prefix="/api/accounts")

DEFAULT_ACCOUNTS = [
    {"code": "1000", "name": "Cash", "account_type": "asset", "normal_balance": "debit"},
    {"code": "1100", "name": "Accounts Receivable", "account_type": "asset", "normal_balance": "debit"},
    {"code": "1200", "name": "Inventory", "account_type": "asset", "normal_balance": "debit"},
    {"code": "1300", "name": "Prepaid Expenses", "account_type": "asset", "normal_balance": "debit"},
    {"code": "1500", "name": "Equipment", "account_type": "asset", "normal_balance": "debit"},
    {"code": "1510", "name": "Accumulated Depreciation", "account_type": "asset", "normal_balance": "credit"},
    {"code": "2000", "name": "Accounts Payable", "account_type": "liability", "normal_balance": "credit"},
    {"code": "2100", "name": "Unearned Revenue", "account_type": "liability", "normal_balance": "credit"},
    {"code": "2200", "name": "Notes Payable", "account_type": "liability", "normal_balance": "credit"},
    {"code": "2300", "name": "Wages Payable", "account_type": "liability", "normal_balance": "credit"},
    {"code": "2400", "name": "Interest Payable", "account_type": "liability", "normal_balance": "credit"},
    {"code": "3000", "name": "Common Stock", "account_type": "equity", "normal_balance": "credit"},
    {"code": "3100", "name": "Retained Earnings", "account_type": "equity", "normal_balance": "credit"},
    {"code": "3200", "name": "Dividends", "account_type": "equity", "normal_balance": "debit"},
    {"code": "4000", "name": "Service Revenue", "account_type": "revenue", "normal_balance": "credit"},
    {"code": "4100", "name": "Sales Revenue", "account_type": "revenue", "normal_balance": "credit"},
    {"code": "4200", "name": "Interest Revenue", "account_type": "revenue", "normal_balance": "credit"},
    {"code": "5000", "name": "Cost of Goods Sold", "account_type": "expense", "normal_balance": "debit"},
    {"code": "5100", "name": "Wages Expense", "account_type": "expense", "normal_balance": "debit"},
    {"code": "5200", "name": "Rent Expense", "account_type": "expense", "normal_balance": "debit"},
    {"code": "5300", "name": "Utilities Expense", "account_type": "expense", "normal_balance": "debit"},
    {"code": "5400", "name": "Depreciation Expense", "account_type": "expense", "normal_balance": "debit"},
    {"code": "5500", "name": "Insurance Expense", "account_type": "expense", "normal_balance": "debit"},
    {"code": "5600", "name": "Supplies Expense", "account_type": "expense", "normal_balance": "debit"},
    {"code": "5700", "name": "Interest Expense", "account_type": "expense", "normal_balance": "debit"},
]


def _infer_type_and_normal_balance(code, name=""):
    name_l = name.lower()
    code_str = str(code).strip()

    if "capital" in name_l:
        return "equity", "credit"
    if "drawing" in name_l:
        return "equity", "debit"
    if "expense" in name_l or "cost" in name_l:
        return "expense", "debit"
    if "revenue" in name_l or "sales" in name_l or "fees" in name_l or "income" in name_l:
        return "revenue", "credit"
    if "payable" in name_l or "loan" in name_l or "mortgage" in name_l or "unearned" in name_l:
        return "liability", "credit"
    if "cash" in name_l or "receivable" in name_l or "supplies" in name_l or "land" in name_l or "building" in name_l or "equipment" in name_l or "prepaid" in name_l:
        return "asset", "debit"

    # Fall back to code prefix
    if code_str.startswith("1"):
        return "asset", "debit"
    elif code_str.startswith("2"):
        return "liability", "credit"
    elif code_str.startswith("3"):
        if "drawing" in name_l:
            return "equity", "debit"
        return "equity", "credit"
    elif code_str.startswith("4"):
        return "revenue", "credit"
    elif code_str.startswith("5") or code_str.startswith("6"):
        return "expense", "debit"

    return "asset", "debit"


@bp.route("", methods=["GET"])
def list_accounts():
    assignment_id = request.args.get("assignment_id", type=int)
    query = Account.query
    if assignment_id:
        # Get assignment specific accounts if they exist, otherwise fallback to global
        scoped = Account.query.filter_by(assignment_id=assignment_id).order_by(Account.code).all()
        if scoped:
            return jsonify([a.to_dict() for a in scoped])
        # If no scoped accounts, show global (where assignment_id is null)
        query = query.filter_by(assignment_id=None)

    accounts = query.order_by(Account.code).all()
    return jsonify([a.to_dict() for a in accounts])


@bp.route("", methods=["POST"])
def create_account():
    data = request.get_json()
    code = str(data["code"]).strip()
    name = data["name"].strip()
    acc_type, norm_bal = _infer_type_and_normal_balance(code, name)

    account_type = data.get("account_type") or acc_type
    normal_balance = data.get("normal_balance") or norm_bal
    opening_balance = float(data.get("opening_balance", 0.0))
    assignment_id = data.get("assignment_id")

    account = Account(
        code=code,
        name=name,
        account_type=account_type,
        normal_balance=normal_balance,
        opening_balance=opening_balance,
        assignment_id=assignment_id,
        parent_id=data.get("parent_id"),
        description=data.get("description", ""),
    )
    db.session.add(account)
    db.session.commit()
    return jsonify(account.to_dict()), 201


@bp.route("/bulk", methods=["POST"])
def bulk_accounts():
    """Batch create or replace chart of accounts for an assignment or globally."""
    data = request.get_json()
    assignment_id = data.get("assignment_id")
    replace = data.get("replace", False)
    accounts_list = data.get("accounts", [])

    if replace:
        if assignment_id:
            entries = JournalEntry.query.filter_by(assignment_id=assignment_id).all()
            for e in entries:
                db.session.delete(e)
            Account.query.filter_by(assignment_id=assignment_id).delete(synchronize_session=False)
        else:
            entries = JournalEntry.query.filter_by(assignment_id=None).all()
            for e in entries:
                db.session.delete(e)
            Account.query.filter_by(assignment_id=None).delete(synchronize_session=False)

    created_accounts = []
    for item in accounts_list:
        code = str(item["code"]).strip()
        name = item["name"].strip()
        acc_type, norm_bal = _infer_type_and_normal_balance(code, name)

        account_type = item.get("account_type") or acc_type
        normal_balance = item.get("normal_balance") or norm_bal
        opening_balance = float(item.get("opening_balance", 0.0))

        account = Account(
            code=code,
            name=name,
            account_type=account_type,
            normal_balance=normal_balance,
            opening_balance=opening_balance,
            assignment_id=assignment_id,
            description=item.get("description", ""),
        )
        db.session.add(account)
        created_accounts.append(account)

    db.session.commit()
    return jsonify([a.to_dict() for a in created_accounts]), 201


@bp.route("/<int:id>", methods=["GET"])
def get_account(id):
    account = Account.query.get_or_404(id)
    return jsonify(account.to_dict())


@bp.route("/<int:id>", methods=["PUT"])
def update_account(id):
    account = Account.query.get_or_404(id)
    data = request.get_json()
    for field in ["code", "name", "account_type", "normal_balance", "opening_balance", "parent_id", "description", "is_active", "assignment_id"]:
        if field in data:
            if field == "opening_balance":
                setattr(account, field, float(data[field]))
            else:
                setattr(account, field, data[field])
    db.session.commit()
    return jsonify(account.to_dict())


@bp.route("/<int:id>", methods=["DELETE"])
def delete_account(id):
    account = Account.query.get_or_404(id)
    force = request.args.get("force", "false").lower() == "true"

    lines = JournalLine.query.filter_by(account_id=id).all()
    if lines and not force:
        entry_ids = list({l.journal_entry_id for l in lines})
        return jsonify({
            "error": f"Account '{account.code} - {account.name}' is currently used in {len(entry_ids)} journal entry(ies). Deleting this account will also remove those journal entries.",
            "has_entries": True,
            "entry_count": len(entry_ids),
        }), 400

    if lines:
        entry_ids = list({l.journal_entry_id for l in lines})
        # Unlink any bank transactions pointing to these lines
        line_ids = [l.id for l in lines]
        BankTransaction.query.filter(BankTransaction.matched_journal_line_id.in_(line_ids)).update(
            {"matched_journal_line_id": None}, synchronize_session=False
        )
        JournalLine.query.filter(JournalLine.journal_entry_id.in_(entry_ids)).delete(synchronize_session=False)
        JournalEntry.query.filter(JournalEntry.id.in_(entry_ids)).delete(synchronize_session=False)

    db.session.delete(account)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@bp.route("/bulk-delete", methods=["POST"])
def bulk_delete_accounts():
    """Bulk delete accounts by list of IDs or delete all accounts."""
    data = request.get_json() or {}
    account_ids = data.get("account_ids", [])
    delete_all = data.get("all", False)
    assignment_id = data.get("assignment_id")
    force = data.get("force", False)

    if delete_all:
        if assignment_id:
            accounts = Account.query.filter_by(assignment_id=assignment_id).all()
        else:
            accounts = Account.query.all()
        account_ids = [a.id for a in accounts]

    if not account_ids:
        return jsonify({"message": "No accounts to delete", "deleted_count": 0}), 200

    account_ids = [int(i) for i in account_ids if str(i).isdigit()]
    if not account_ids:
        return jsonify({"message": "No valid account IDs provided", "deleted_count": 0}), 200

    # Check if any accounts have journal lines
    lines = JournalLine.query.filter(JournalLine.account_id.in_(account_ids)).all()
    if lines and not force:
        entry_ids = list({l.journal_entry_id for l in lines})
        return jsonify({
            "error": f"The selected {len(account_ids)} account(s) are used in {len(entry_ids)} journal entry(ies). Deleting them will also delete those journal entries.",
            "has_entries": True,
            "entry_count": len(entry_ids),
            "account_count": len(account_ids),
        }), 400

    if lines:
        entry_ids = list({l.journal_entry_id for l in lines})
        line_ids = [l.id for l in lines]
        if line_ids:
            BankTransaction.query.filter(BankTransaction.matched_journal_line_id.in_(line_ids)).update(
                {"matched_journal_line_id": None}, synchronize_session=False
            )
        if entry_ids:
            JournalLine.query.filter(JournalLine.journal_entry_id.in_(entry_ids)).delete(synchronize_session=False)
            JournalEntry.query.filter(JournalEntry.id.in_(entry_ids)).delete(synchronize_session=False)

    # Clear parent_id references in case of hierarchy
    Account.query.filter(Account.parent_id.in_(account_ids)).update({"parent_id": None}, synchronize_session=False)

    # Delete accounts
    deleted_count = Account.query.filter(Account.id.in_(account_ids)).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({
        "message": f"Successfully deleted {deleted_count} account(s)",
        "deleted_count": deleted_count,
    }), 200


@bp.route("/seed", methods=["POST"])
def seed_accounts():
    """Seed default chart of accounts if empty."""
    assignment_id = request.args.get("assignment_id", type=int)
    count = Account.query.filter_by(assignment_id=assignment_id).count() if assignment_id else Account.query.count()
    if count > 0:
        return jsonify({"message": "Accounts already exist"}), 200

    for acc_data in DEFAULT_ACCOUNTS:
        account = Account(**acc_data, assignment_id=assignment_id)
        db.session.add(account)
    db.session.commit()
    return jsonify({"message": f"Seeded {len(DEFAULT_ACCOUNTS)} accounts"}), 201


@bp.route("/<int:id>/ledger", methods=["GET"])
def get_account_ledger(id):
    """Get general ledger for a specific account with opening balance and running balance."""
    account = Account.query.get_or_404(id)
    lines = (
        JournalLine.query
        .join(JournalEntry)
        .filter(JournalLine.account_id == id, JournalEntry.status == "posted")
        .order_by(JournalEntry.date, JournalEntry.id)
        .all()
    )

    running_balance = float(account.opening_balance or 0.0)
    ledger_entries = []

    # If account has an opening balance, include it as the first line
    if abs(running_balance) > 0.001:
        ledger_entries.append({
            "date": "Beginning Balance",
            "entry_number": "—",
            "description": "Opening / Balance Forward",
            "reference": "Bal. Fwd.",
            "debit": running_balance if account.normal_balance == "debit" and running_balance > 0 else 0,
            "credit": running_balance if account.normal_balance == "credit" and running_balance > 0 else 0,
            "balance": round(running_balance, 2),
            "is_opening": True,
        })

    total_debits = 0.0
    total_credits = 0.0

    for line in lines:
        entry = line.journal_entry
        total_debits += line.debit
        total_credits += line.credit

        if account.normal_balance == "debit":
            running_balance += line.debit - line.credit
        else:
            running_balance += line.credit - line.debit

        ledger_entries.append({
            "date": entry.date.isoformat(),
            "entry_number": entry.entry_number,
            "description": entry.description or line.description,
            "reference": entry.reference,
            "debit": line.debit,
            "credit": line.credit,
            "balance": round(running_balance, 2),
            "is_opening": False,
        })

    return jsonify({
        "account": account.to_dict(),
        "opening_balance": round(float(account.opening_balance or 0.0), 2),
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "entries": ledger_entries,
        "ending_balance": round(running_balance, 2),
    })


@bp.route("/ledgers/all", methods=["GET"])
def get_all_ledgers():
    """Get general ledger for ALL accounts in one response."""
    assignment_id = request.args.get("assignment_id", type=int)
    hide_unused = request.args.get("hide_unused", "false").lower() == "true"

    query = Account.query
    if assignment_id:
        scoped = Account.query.filter_by(assignment_id=assignment_id).order_by(Account.code).all()
        if scoped:
            accounts = scoped
        else:
            accounts = query.filter_by(assignment_id=None).order_by(Account.code).all()
    else:
        accounts = query.order_by(Account.code).all()

    results = []
    for account in accounts:
        lines = (
            JournalLine.query
            .join(JournalEntry)
            .filter(JournalLine.account_id == account.id, JournalEntry.status == "posted")
            .order_by(JournalEntry.date, JournalEntry.id)
            .all()
        )

        running_balance = float(account.opening_balance or 0.0)
        has_activity = len(lines) > 0 or abs(running_balance) > 0.001

        if hide_unused and not has_activity:
            continue

        entries = []
        if abs(running_balance) > 0.001:
            entries.append({
                "date": "Beginning Balance",
                "entry_number": "—",
                "description": "Opening Balance",
                "reference": "Bal. Fwd.",
                "debit": running_balance if account.normal_balance == "debit" and running_balance > 0 else 0,
                "credit": running_balance if account.normal_balance == "credit" and running_balance > 0 else 0,
                "balance": round(running_balance, 2),
                "is_opening": True,
            })

        t_deb = 0.0
        t_crd = 0.0
        for line in lines:
            t_deb += line.debit
            t_crd += line.credit
            if account.normal_balance == "debit":
                running_balance += line.debit - line.credit
            else:
                running_balance += line.credit - line.debit

            entries.append({
                "date": line.journal_entry.date.isoformat(),
                "entry_number": line.journal_entry.entry_number,
                "description": line.journal_entry.description or line.description,
                "reference": line.journal_entry.reference,
                "debit": line.debit,
                "credit": line.credit,
                "balance": round(running_balance, 2),
                "is_opening": False,
            })

        results.append({
            "account": account.to_dict(),
            "opening_balance": round(float(account.opening_balance or 0.0), 2),
            "total_debits": round(t_deb, 2),
            "total_credits": round(t_crd, 2),
            "ending_balance": round(running_balance, 2),
            "entries": entries,
            "has_activity": has_activity,
        })

    return jsonify(results)
