from flask import Blueprint, request, jsonify
from models import db, JournalEntry, JournalLine, Account, scope_query
from datetime import date, datetime
import re

bp = Blueprint("journal_entries", __name__, url_prefix="/api/journal-entries")


def _next_entry_number(assignment_id=None):
    query = scope_query(JournalEntry.query, JournalEntry, assignment_id)
    last = query.order_by(JournalEntry.id.desc()).first()
    if last:
        try:
            num = int(re.sub(r"[^\d]", "", last.entry_number))
            return f"JE-{num + 1:04d}"
        except ValueError:
            pass
    return "JE-0001"


def _invalid_account_ids(account_ids, assignment_id):
    """Return any account ids that don't belong to this assignment's chart of accounts."""
    ids = {int(a) for a in account_ids if a}
    if not ids:
        return []
    valid = {a.id for a in scope_query(Account.query, Account, assignment_id).filter(Account.id.in_(ids)).all()}
    return sorted(ids - valid)


MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def _parse_single_transaction_line(line, accounts, default_year=2025):
    """
    Parse a single line of accounting transaction text.
    Returns dict with date, amount, description, debit_account, credit_account.
    """
    clean_line = line.strip()
    if not clean_line or len(clean_line) < 5:
        return None

    # 1. Extract Date
    parsed_date = None
    date_match = re.search(
        r"(?i)\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?",
        clean_line
    )
    if date_match:
        m_str = date_match.group(1).lower()
        month = MONTH_MAP.get(m_str, 6)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else default_year
        try:
            parsed_date = date(year, month, day).isoformat()
        except ValueError:
            parsed_date = date(default_year, 6, 1).isoformat()
    else:
        iso_match = re.search(r"(\d{4})-(\d{2})-(\d{2})", clean_line)
        if iso_match:
            parsed_date = iso_match.group(0)
        else:
            slash_match = re.search(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?", clean_line)
            if slash_match:
                m = int(slash_match.group(1))
                d = int(slash_match.group(2))
                y = int(slash_match.group(3)) if slash_match.group(3) else default_year
                if y < 100: y += 2000
                parsed_date = date(y, m, d).isoformat()

    if not parsed_date:
        parsed_date = date(default_year, 6, 1).isoformat()

    # 2. Extract Amount ($X,XXX.XX or $XXXX.XX or $XX)
    amount = 0.0
    amt_matches = re.findall(r"\$\s*([0-9,]+(?:\.[0-9]{1,2})?)", clean_line)
    if amt_matches:
        raw_amt = amt_matches[0].replace(",", "")
        try:
            amount = float(raw_amt)
        except ValueError:
            amount = 0.0
    else:
        num_matches = re.findall(r"\b([0-9,]+(?:\.[0-9]{2}))\b", clean_line)
        if num_matches:
            try:
                amount = float(num_matches[0].replace(",", ""))
            except ValueError:
                amount = 0.0

    # 3. Match Accounts
    lower = clean_line.lower()

    # Account lookup helpers
    def find_account_by_keywords(*kws):
        for acc in accounts:
            name_l = acc.name.lower()
            code_s = str(acc.code).lower()
            if any(k in name_l or k == code_s for k in kws):
                return acc
        return None

    cash_acc = find_account_by_keywords("cash", "bank")
    ar_acc = find_account_by_keywords("accounts receivable", "receivable")
    ap_acc = find_account_by_keywords("accounts payable", "payable")
    supplies_acc = find_account_by_keywords("supplies")
    equipment_acc = find_account_by_keywords("equipment")
    sales_acc = find_account_by_keywords("sales", "fees earned", "revenue")
    salaries_acc = find_account_by_keywords("salaries", "wages")
    adv_acc = find_account_by_keywords("advertising")
    hydro_acc = find_account_by_keywords("hydro", "utilities", "electric")
    water_acc = find_account_by_keywords("water")
    capital_acc = find_account_by_keywords("capital")
    drawings_acc = find_account_by_keywords("drawing")

    debit_acc = None
    credit_acc = None

    # Logic patterns:
    # A) Sale on credit / Invoiced customer
    if ("invoice" in lower or "on account" in lower or "within 30 days" in lower) and ("sale" in lower or "stock" in lower or "service" in lower) and "bought" not in lower and "equipment" not in lower and "supplies" not in lower:
        debit_acc = ar_acc
        credit_acc = sales_acc

    # B) Bought supplies on credit
    elif "supplies" in lower and ("credit" in lower or "30 days" in lower or "payable" in lower or "on account" in lower):
        debit_acc = supplies_acc
        credit_acc = ap_acc

    # C) Supplies for cash
    elif "supplies" in lower and ("cash" in lower or "paid" in lower):
        debit_acc = supplies_acc
        credit_acc = cash_acc

    # D) Traded in equipment / Returned equipment for credit or refund in 30 days
    elif "equipment" in lower and ("credit" in lower or "refunded within 30 days" in lower or "traded in" in lower or "returned" in lower) and "cash" not in lower:
        debit_acc = ar_acc  # Customer or vendor credit receivable
        credit_acc = equipment_acc

    # E) Refunded equipment for cash / Sold equipment for cash
    elif "equipment" in lower and "cash" in lower:
        debit_acc = cash_acc
        credit_acc = equipment_acc

    # F) Purchased equipment on credit / cash
    elif "equipment" in lower and ("bought" in lower or "purchased" in lower):
        debit_acc = equipment_acc
        credit_acc = ap_acc if ("credit" in lower or "payable" in lower) else cash_acc

    # G) Water expense paid
    elif "water" in lower and ("paid" in lower or "expense" in lower):
        debit_acc = water_acc
        credit_acc = cash_acc

    # H) Advertising expense paid / advertising service paid
    elif "advertising" in lower and ("paid" in lower or "expense" in lower or "service" in lower):
        debit_acc = adv_acc
        credit_acc = cash_acc

    # I) Salaries expense paid
    elif ("salaries" in lower or "salary" in lower or "wages" in lower) and ("paid" in lower or "expense" in lower):
        debit_acc = salaries_acc
        credit_acc = cash_acc

    # J) Hydro / Utilities expense paid
    elif ("hydro" in lower or "utilities" in lower) and ("paid" in lower or "expense" in lower):
        debit_acc = hydro_acc
        credit_acc = cash_acc

    # K) Delivery expense paid
    elif "delivery" in lower and ("paid" in lower or "expense" in lower):
        debit_acc = find_account_by_keywords("delivery")
        credit_acc = cash_acc

    # L) Payment on account to supplier (Accounts Payable)
    elif "paid" in lower and ("payable" in lower or "creditor" in lower or "supplier" in lower):
        debit_acc = ap_acc
        credit_acc = cash_acc

    # M) Received payment from customer (Accounts Receivable)
    elif ("received" in lower or "collected" in lower) and ("receivable" in lower or "customer" in lower):
        debit_acc = cash_acc
        credit_acc = ar_acc

    # N) Cash sale
    elif "sale" in lower and "cash" in lower:
        debit_acc = cash_acc
        credit_acc = sales_acc

    # Generic fallback: search for account names in text
    if not debit_acc or not credit_acc:
        found_accounts = []
        for a in accounts:
            if a.name.lower() in lower:
                found_accounts.append(a)

        if len(found_accounts) >= 2:
            # First mentioned might be debit, second credit
            if not debit_acc: debit_acc = found_accounts[0]
            if not credit_acc: credit_acc = found_accounts[1]
        elif len(found_accounts) == 1:
            acc = found_accounts[0]
            if acc.account_type == "expense":
                debit_acc = acc
                credit_acc = cash_acc
            elif acc.account_type == "revenue":
                debit_acc = cash_acc
                credit_acc = acc
            elif acc.account_type == "asset":
                if "paid" in lower or "bought" in lower:
                    debit_acc = acc
                    credit_acc = cash_acc
                else:
                    debit_acc = cash_acc
                    credit_acc = acc

    # Clean description
    desc = clean_line
    # Remove leading date like "June 4:"
    desc = re.sub(r"^(?:[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,4}[-/]\d{1,2}[-/]\d{1,4})\s*:\s*", "", desc)

    return {
        "raw_text": clean_line,
        "date": parsed_date,
        "description": desc,
        "amount": round(amount, 2),
        "debit_account_id": debit_acc.id if debit_acc else None,
        "debit_account_code": debit_acc.code if debit_acc else "",
        "debit_account_name": debit_acc.name if debit_acc else "Select Account",
        "credit_account_id": credit_acc.id if credit_acc else None,
        "credit_account_code": credit_acc.code if credit_acc else "",
        "credit_account_name": credit_acc.name if credit_acc else "Select Account",
        "is_balanced": amount > 0 and debit_acc is not None and credit_acc is not None,
    }


@bp.route("/auto-parse", methods=["POST"])
def auto_parse_transactions():
    """Parse raw transaction descriptions into structured double-entry journal entries."""
    data = request.get_json()
    raw_text = data.get("text", "")
    assignment_id = data.get("assignment_id")
    default_year = int(data.get("default_year", 2025))

    accounts = scope_query(Account.query, Account, assignment_id).order_by(Account.code).all()

    lines = raw_text.splitlines()
    parsed_entries = []
    for line in lines:
        entry = _parse_single_transaction_line(line, accounts, default_year)
        if entry:
            parsed_entries.append(entry)

    return jsonify({
        "parsed_count": len(parsed_entries),
        "entries": parsed_entries,
    })


@bp.route("/bulk-create", methods=["POST"])
def bulk_create():
    """Create and immediately post multiple journal entries from parsed transactions."""
    data = request.get_json()
    entries_data = data.get("entries", [])
    assignment_id = data.get("assignment_id")
    auto_post = data.get("post", True)

    bad = _invalid_account_ids(
        [e.get("debit_account_id") for e in entries_data] + [e.get("credit_account_id") for e in entries_data],
        assignment_id,
    )
    if bad:
        return jsonify({"error": "Some entries use accounts that are not in this project's chart of accounts."}), 400

    created = []
    for idx, e_data in enumerate(entries_data):
        amt = float(e_data.get("amount", 0.0))
        deb_id = e_data.get("debit_account_id")
        crd_id = e_data.get("credit_account_id")

        if amt <= 0 or not deb_id or not crd_id:
            continue

        entry_num = _next_entry_number(assignment_id)
        d_val = date.fromisoformat(e_data["date"]) if e_data.get("date") else date.today()

        entry = JournalEntry(
            entry_number=entry_num,
            date=d_val,
            description=e_data.get("description", ""),
            reference=e_data.get("reference", ""),
            status="posted" if auto_post else "draft",
            assignment_id=assignment_id,
        )
        db.session.add(entry)
        db.session.flush()

        # Debit line
        l1 = JournalLine(
            journal_entry_id=entry.id,
            line_number=1,
            account_id=deb_id,
            debit=amt,
            credit=0.0,
            description=e_data.get("description", ""),
        )
        # Credit line
        l2 = JournalLine(
            journal_entry_id=entry.id,
            line_number=2,
            account_id=crd_id,
            debit=0.0,
            credit=amt,
            description=e_data.get("description", ""),
        )
        db.session.add_all([l1, l2])
        created.append(entry)

    db.session.commit()
    return jsonify([e.to_dict() for e in created]), 201


@bp.route("/general-journal", methods=["GET"])
def get_general_journal():
    """Get the complete General Journal listing in textbook accounting order."""
    assignment_id = request.args.get("assignment_id", type=int)
    query = scope_query(JournalEntry.query, JournalEntry, assignment_id)

    entries = query.order_by(JournalEntry.date.asc(), JournalEntry.id.asc()).all()
    results = []
    total_debits = 0.0
    total_credits = 0.0

    for e in entries:
        e_dict = e.to_dict(include_lines=True)
        total_debits += e.total_debits
        total_credits += e.total_credits
        results.append(e_dict)

    return jsonify({
        "entries": results,
        "total_entries": len(results),
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
    })


@bp.route("/clear", methods=["POST"])
def clear_entries():
    """Clear journal entries for an assignment."""
    data = request.get_json() or {}
    assignment_id = data.get("assignment_id")
    entries = scope_query(JournalEntry.query, JournalEntry, assignment_id).all()
    count = len(entries)
    for e in entries:
        db.session.delete(e)  # ORM delete so journal lines cascade too
    db.session.commit()
    return jsonify({"message": f"Cleared {count} journal entries"})


@bp.route("", methods=["GET"])
def list_entries():
    assignment_id = request.args.get("assignment_id", type=int)
    query = scope_query(JournalEntry.query, JournalEntry, assignment_id)
    entries = query.order_by(JournalEntry.date.desc(), JournalEntry.id.desc()).all()
    return jsonify([e.to_dict() for e in entries])


@bp.route("", methods=["POST"])
def create_entry():
    data = request.get_json()
    assignment_id = data.get("assignment_id")
    if _invalid_account_ids([l.get("account_id") for l in data.get("lines", [])], assignment_id):
        return jsonify({"error": "This entry uses accounts that are not in this project's chart of accounts."}), 400
    entry = JournalEntry(
        entry_number=data.get("entry_number") or _next_entry_number(assignment_id),
        date=date.fromisoformat(data["date"]) if data.get("date") else date.today(),
        description=data.get("description", ""),
        reference=data.get("reference", ""),
        status=data.get("status", "draft"),
        assignment_id=assignment_id,
    )
    db.session.add(entry)
    db.session.flush()

    for i, line_data in enumerate(data.get("lines", [])):
        line = JournalLine(
            journal_entry_id=entry.id,
            line_number=i + 1,
            account_id=line_data["account_id"],
            debit=float(line_data.get("debit", 0)),
            credit=float(line_data.get("credit", 0)),
            description=line_data.get("description", ""),
        )
        db.session.add(line)

    db.session.commit()
    return jsonify(entry.to_dict()), 201


@bp.route("/<int:id>", methods=["GET"])
def get_entry(id):
    entry = JournalEntry.query.get_or_404(id)
    return jsonify(entry.to_dict())


@bp.route("/<int:id>", methods=["PUT"])
def update_entry(id):
    entry = JournalEntry.query.get_or_404(id)
    data = request.get_json()

    if "date" in data:
        entry.date = date.fromisoformat(data["date"])
    if "description" in data:
        entry.description = data["description"]
    if "reference" in data:
        entry.reference = data["reference"]
    if "status" in data:
        entry.status = data["status"]

    if "lines" in data:
        if _invalid_account_ids([l.get("account_id") for l in data["lines"]], entry.assignment_id):
            return jsonify({"error": "This entry uses accounts that are not in this project's chart of accounts."}), 400
        JournalLine.query.filter_by(journal_entry_id=entry.id).delete()
        for i, line_data in enumerate(data["lines"]):
            line = JournalLine(
                journal_entry_id=entry.id,
                line_number=i + 1,
                account_id=line_data["account_id"],
                debit=float(line_data.get("debit", 0)),
                credit=float(line_data.get("credit", 0)),
                description=line_data.get("description", ""),
            )
            db.session.add(line)

    db.session.commit()
    return jsonify(entry.to_dict())


@bp.route("/<int:id>", methods=["DELETE"])
def delete_entry(id):
    entry = JournalEntry.query.get_or_404(id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@bp.route("/<int:id>/post", methods=["POST"])
def post_entry(id):
    entry = JournalEntry.query.get_or_404(id)
    if not entry.is_balanced:
        return jsonify({"error": "Entry is not balanced. Debits must equal credits."}), 400
    entry.status = "posted"
    db.session.commit()
    return jsonify(entry.to_dict())
