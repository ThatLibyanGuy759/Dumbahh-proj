"""
Builds a formatted, cross-referenced accounting workbook (General Journal, General Ledger,
Trial Balance, Income Statement, Balance Sheet) for one assignment (or the global workspace).

Cross-sheet references (real formulas, so edits flow through):
  - General Journal  P.R. column = ledger account number
  - General Ledger   P.R. = "J1"; Debit/Credit = formulas pointing at the journal amount cells;
                     Balance = running formula; DR/CR = formula
  - Trial Balance    Debit/Credit = formulas on each ledger account's final balance cell
  - Income Statement amounts = formulas on Trial Balance cells
  - Balance Sheet    amounts = formulas on Trial Balance cells; Net Income from Income Statement
"""
import calendar
import json
from datetime import date

from models import db, Account, JournalEntry, Workbook, Sheet, Cell, Assignment, scope_query

GENERATED_MARKER = "generated:accounting"

SHEET_JOURNAL = "General Journal"
SHEET_LEDGER = "General Ledger"
SHEET_TB = "Trial Balance"
SHEET_IS = "Income Statement"
SHEET_BS = "Balance Sheet"

# Themes taken from the reference screenshots
BLUE = {"title": "#9BC2E6", "header": "#BDD7EE", "body": "#DDEBF7"}
PEACH = {"title": "#F4B183", "header": "#F4B183", "body": "#F8CBAD"}

MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
INDENT = "     "


def col_letter(c):
    s = ""
    c += 1
    while c:
        c, rem = divmod(c - 1, 26)
        s = chr(65 + rem) + s
    return s


def a1(r, c):
    return f"{col_letter(c)}{r + 1}"


def xref(sheet, r, c):
    return f"'{sheet}'!{a1(r, c)}"


def money(v):
    return f"{float(v):.2f}"


class SheetBuilder:
    def __init__(self, name, col_widths_px):
        self.name = name
        self.cells = {}
        self.merges = []
        self.col_widths = {str(i): w for i, w in enumerate(col_widths_px)}
        self.ncols = len(col_widths_px)
        self.max_row = 0

    def set(self, r, c, value="", **fmt):
        cell = self.cells.setdefault((r, c), {})
        if value is not None and value != "":
            cell["raw_value"] = str(value)
        cell.update(fmt)
        self.max_row = max(self.max_row, r)
        return a1(r, c)

    def style_row(self, r, bg, c0=0, c1=None):
        c1 = self.ncols - 1 if c1 is None else c1
        for c in range(c0, c1 + 1):
            cell = self.cells.setdefault((r, c), {})
            cell.setdefault("bg_color", bg)
        self.max_row = max(self.max_row, r)

    def merge(self, r, c, rs=1, cs=1):
        self.merges.append({"r": r, "c": c, "rs": rs, "cs": cs})

    def add_border(self, r, c, spec):
        cell = self.cells.setdefault((r, c), {})
        existing = cell.get("border", "")
        cell["border"] = f"{existing};{spec}" if existing else spec


def _end_of_month(d):
    return date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])


def _long_date(d):
    return f"{calendar.month_name[d.month]} {d.day}, {d.year}"


def _debit_based(account):
    return account.account_type in ("asset", "expense") or (
        account.account_type == "equity" and "drawing" in account.name.lower()
    )


def build_workbook_data(assignment_id=None):
    accounts = scope_query(Account.query, Account, assignment_id).order_by(Account.code).all()
    entries = (
        scope_query(JournalEntry.query, JournalEntry, assignment_id)
        .filter(JournalEntry.status == "posted")
        .order_by(JournalEntry.date.asc(), JournalEntry.id.asc())
        .all()
    )
    company = "Company Name"
    if assignment_id:
        a = Assignment.query.get(assignment_id)
        if a:
            company = a.name

    first_date = entries[0].date if entries else date.today()
    opening_date = date(first_date.year, first_date.month, 1)
    period_end = _end_of_month(entries[-1].date if entries else opening_date)

    # ---------- Journal entries to write (opening entry first) ----------
    journal = []  # list of dict(date, lines=[(account, debit, credit)], description)
    opening_lines = []
    for acc in accounts:
        ob = float(acc.opening_balance or 0.0)
        if abs(ob) < 0.005:
            continue
        is_debit = (acc.normal_balance == "debit") == (ob > 0)
        opening_lines.append((acc, abs(ob) if is_debit else 0.0, 0.0 if is_debit else abs(ob)))
    if opening_lines:
        opening_lines.sort(key=lambda l: (l[1] == 0, l[0].code))
        journal.append({"date": opening_date, "lines": opening_lines,
                        "description": "Opening entry to record beginning balances", "opening": True})
    acc_by_id = {a.id: a for a in accounts}
    for e in entries:
        lines = [(acc_by_id.get(l.account_id) or l.account, float(l.debit or 0), float(l.credit or 0)) for l in e.lines]
        lines = [l for l in lines if l[0] is not None and (l[1] > 0 or l[2] > 0)]
        lines.sort(key=lambda l: l[1] == 0)  # debits first, then credits
        if lines:
            journal.append({"date": e.date, "lines": lines, "description": e.description or "", "opening": False})

    sheets = []

    # ================= GENERAL JOURNAL =================
    gj = SheetBuilder(SHEET_JOURNAL, [60, 36, 340, 56, 110, 110])
    T = BLUE
    gj.set(0, 0, "General Journal", font_bold=True, font_size=14, text_align="center")
    gj.merge(0, 0, 1, 6)
    gj.style_row(0, T["title"])
    for c, label in [(0, "Date"), (2, "Particulars"), (3, "P.R."), (4, "Debit"), (5, "Credit")]:
        gj.set(1, c, label, font_bold=True, text_align="center" if c != 2 else "left")
    gj.merge(1, 0, 1, 2)
    gj.style_row(1, T["header"])
    for c in range(6):
        gj.add_border(1, c, "bottom:thin")
    r = 2
    gj.set(r, 0, str(opening_date.year))
    gj.style_row(r, T["body"])
    r += 1

    postings = {a.id: [] for a in accounts}  # account_id -> [(date, side, journal_ref, opening)]
    last_month = None
    for je in journal:
        first = True
        for acc, debit, credit in je["lines"]:
            if first:
                month_key = (je["date"].year, je["date"].month)
                if month_key != last_month:
                    gj.set(r, 0, MONTHS[je["date"].month])
                    last_month = month_key
                gj.set(r, 1, str(je["date"].day), text_align="right")
                first = False
            if debit > 0:
                gj.set(r, 2, acc.name)
                ref = gj.set(r, 4, money(debit), format_type="currency", text_align="right")
                side = "debit"
            else:
                gj.set(r, 2, INDENT + acc.name)
                ref = gj.set(r, 5, money(credit), format_type="currency", text_align="right")
                side = "credit"
            gj.set(r, 3, acc.code, text_align="center")
            gj.style_row(r, T["body"])
            if acc.id in postings:
                postings[acc.id].append((je["date"], side, f"'{SHEET_JOURNAL}'!{ref}", je["opening"]))
            r += 1
        gj.set(r, 2, je["description"], font_italic=False)
        gj.style_row(r, T["body"])
        r += 1
        gj.style_row(r, T["body"])  # spacer
        r += 1
    # column separators like the reference
    for rr in range(1, r):
        for c in (2, 3, 4, 5):
            gj.add_border(rr, c, "left:thin")
    sheets.append(gj)

    # ================= GENERAL LEDGER =================
    gl = SheetBuilder(SHEET_LEDGER, [56, 36, 230, 56, 110, 110, 56, 120])
    gl.set(0, 0, "General Ledger", font_bold=True, font_size=14, text_align="center")
    gl.merge(0, 0, 1, 8)
    gl.style_row(0, T["title"])
    r = 1
    ledger_balance_ref = {}
    for acc in accounts:
        # Account title row
        gl.set(r, 0, "Account:", font_bold=True)
        gl.set(r, 1, acc.name)
        gl.merge(r, 1, 1, 5)
        gl.set(r, 6, "No.")
        gl.set(r, 7, acc.code, text_align="right")
        gl.style_row(r, T["header"])
        for c in range(8):
            gl.add_border(r, c, "top:thin")
        r += 1
        for c, label in [(0, "Date"), (2, "Particulars"), (3, "P.R."), (4, "Debit"), (5, "Credit"), (6, "DR./CR."), (7, "Balance")]:
            gl.set(r, c, label, font_bold=True, text_align="center")
        gl.merge(r, 0, 1, 2)
        gl.style_row(r, T["header"])
        for c in range(8):
            gl.add_border(r, c, "bottom:thin")
        r += 1
        gl.set(r, 0, str(opening_date.year))
        gl.style_row(r, T["body"])
        r += 1

        prev_bal = None
        last_month = None
        debit_normal = acc.normal_balance == "debit"
        for d, side, jref, is_opening in postings.get(acc.id, []):
            month_key = (d.year, d.month)
            if month_key != last_month:
                gl.set(r, 0, MONTHS[d.month])
                last_month = month_key
            gl.set(r, 1, str(d.day), text_align="right")
            if is_opening:
                gl.set(r, 2, "Opening Entry")
            gl.set(r, 3, "J1", text_align="center")
            col = 4 if side == "debit" else 5
            gl.set(r, col, f"={jref}", format_type="currency", text_align="right")
            e_ref, f_ref = a1(r, 4), a1(r, 5)
            delta = f"{e_ref}-{f_ref}" if debit_normal else f"{f_ref}-{e_ref}"
            bal_formula = f"={delta}" if prev_bal is None else f"={prev_bal}+{delta}"
            bal_ref = gl.set(r, 7, bal_formula, format_type="currency", text_align="right")
            dr, cr = ('"DR"', '"CR"') if debit_normal else ('"CR"', '"DR"')
            gl.set(r, 6, f"=IF({bal_ref}<0,{cr},{dr})", text_align="center")
            gl.style_row(r, T["body"])
            prev_bal = bal_ref
            r += 1
        if prev_bal:
            ledger_balance_ref[acc.id] = prev_bal
        gl.style_row(r, T["body"])  # spacer
        r += 1
    sheets.append(gl)

    # ================= TRIAL BALANCE =================
    P = PEACH
    tb = SheetBuilder(SHEET_TB, [250, 120, 120])
    for i, text in enumerate([company, "Trial Balance", _long_date(period_end)]):
        tb.set(i, 0, text, font_bold=True, font_size=13 if i else 14, text_align="center")
        tb.merge(i, 0, 1, 3)
        tb.style_row(i, P["title"])
    tb.set(3, 0, "Account", font_bold=True, text_align="center")
    tb.set(3, 1, "Debit", font_bold=True, text_align="center")
    tb.set(3, 2, "Credit", font_bold=True, text_align="center")
    tb.style_row(3, P["body"])
    r = 4
    tb_rows = {}  # account_id -> row
    first_row = r
    for acc in accounts:
        bal = ledger_balance_ref.get(acc.id)
        if not bal:
            continue
        lref = f"'{SHEET_LEDGER}'!{bal}"
        tb.set(r, 0, acc.name)
        if acc.normal_balance == "debit":
            tb.set(r, 1, f"=MAX({lref},0)", format_type="accounting", text_align="right")
            tb.set(r, 2, f"=MAX(-{lref},0)", format_type="accounting", text_align="right")
        else:
            tb.set(r, 1, f"=MAX(-{lref},0)", format_type="accounting", text_align="right")
            tb.set(r, 2, f"=MAX({lref},0)", format_type="accounting", text_align="right")
        tb.style_row(r, P["body"])
        tb_rows[acc.id] = r
        r += 1
    last_row = r - 1
    if tb_rows:
        tb.set(r, 1, f"=SUM({a1(first_row, 1)}:{a1(last_row, 1)})", format_type="currency", text_align="right", font_bold=True)
        tb.set(r, 2, f"=SUM({a1(first_row, 2)}:{a1(last_row, 2)})", format_type="currency", text_align="right", font_bold=True)
    else:
        tb.set(r, 1, "0", format_type="currency", text_align="right", font_bold=True)
        tb.set(r, 2, "0", format_type="currency", text_align="right", font_bold=True)
    tb.set(r, 0, "Total", font_bold=True)
    for c in (1, 2):
        tb.add_border(r, c, "top:thin;bottom:double")
    tb.style_row(r, P["body"])
    sheets.append(tb)

    def tb_amount(acc):
        row = tb_rows[acc.id]
        b, c = xref(SHEET_TB, row, 1), xref(SHEET_TB, row, 2)
        return f"={b}-{c}" if _debit_based(acc) else f"={c}-{b}"

    used = [a for a in accounts if a.id in tb_rows]

    # ================= INCOME STATEMENT =================
    inc = SheetBuilder(SHEET_IS, [250, 120, 120])
    period_text = f"For the Month Ended {_long_date(period_end)}"
    for i, text in enumerate([company, "Income Statement", period_text]):
        inc.set(i, 0, text, font_bold=True, font_size=13 if i else 14, text_align="center")
        inc.merge(i, 0, 1, 3)
        inc.style_row(i, P["title"])
    r = 3

    def section(title, items):
        nonlocal r
        inc.set(r, 0, title, font_bold=True, text_align="center")
        inc.style_row(r, P["body"])
        r += 1
        start = r
        for acc in items:
            inc.set(r, 0, acc.name)
            inc.set(r, 1, tb_amount(acc), format_type="currency", text_align="right")
            inc.style_row(r, P["body"])
            r += 1
        if items:
            end = r - 1
            inc.add_border(end, 1, "bottom:thin")
            return inc.set(end, 2, f"=SUM({a1(start, 1)}:{a1(end, 1)})", format_type="currency", text_align="right")
        inc.set(r, 0, f"Total {title}")
        ref = inc.set(r, 2, "0", format_type="currency", text_align="right")
        inc.style_row(r, P["body"])
        r += 1
        return ref

    rev_total = section("Revenue", [a for a in used if a.account_type == "revenue"])
    exp_total = section("Expenses", [a for a in used if a.account_type == "expense"])
    ni_row = r
    inc.set(r, 2, f"={rev_total}-{exp_total}", format_type="currency", text_align="right", font_bold=True)
    inc.set(r, 0, f'=IF({a1(r, 2)}<0,"Net Loss","Net Income")', font_bold=True)
    inc.add_border(r, 2, "top:thin;bottom:double")
    for c in range(3):
        inc.add_border(r, c, "top:thin")
    inc.style_row(r, P["body"])
    sheets.append(inc)
    net_income_ref = xref(SHEET_IS, ni_row, 2)

    # ================= BALANCE SHEET =================
    bs = SheetBuilder(SHEET_BS, [200, 125, 290, 125])
    for i, text in enumerate([company, "Balance Sheet", f"As at {_long_date(period_end)}"]):
        bs.set(i, 0, text, font_bold=True, font_size=16 if i == 0 else 14, text_align="center")
        bs.merge(i, 0, 1, 4)
        bs.style_row(i, T["title"])
    bs.set(3, 0, "Assets", font_bold=True, text_align="center")
    bs.merge(3, 0, 1, 2)
    bs.set(3, 2, "Liabilities", font_bold=True, text_align="center")
    bs.merge(3, 2, 1, 2)

    # Assets (left)
    ra = 4
    assets = [a for a in used if a.account_type == "asset"]
    for acc in assets:
        bs.set(ra, 0, acc.name)
        bs.set(ra, 1, tb_amount(acc), format_type="currency", text_align="right")
        ra += 1
    if assets:
        bs.add_border(ra - 1, 1, "bottom:thin")
    asset_range = f"{a1(4, 1)}:{a1(max(ra - 1, 4), 1)}"

    # Liabilities (right)
    rl = 4
    liabs = [a for a in used if a.account_type == "liability"]
    for acc in liabs:
        bs.set(rl, 2, acc.name)
        bs.set(rl, 3, tb_amount(acc), format_type="currency", text_align="right")
        rl += 1
    if liabs:
        bs.add_border(rl - 1, 3, "bottom:thin")
        total_liab_ref = bs.set(rl, 3, f"=SUM({a1(4, 3)}:{a1(rl - 1, 3)})", format_type="currency", text_align="right")
    else:
        total_liab_ref = bs.set(rl, 3, "0", format_type="currency", text_align="right")
    bs.set(rl, 2, "Total Liabilities")
    bs.add_border(rl, 3, "bottom:thin")
    rl += 2

    # Owner's equity (right)
    bs.set(rl, 2, "Owner's Equity", font_bold=True, text_align="center")
    bs.merge(rl, 2, 1, 2)
    rl += 1
    capitals = [a for a in used if a.account_type == "equity" and "drawing" not in a.name.lower()]
    drawings = [a for a in used if a.account_type == "equity" and "drawing" in a.name.lower()]
    has_income = any(a.account_type in ("revenue", "expense") for a in used)
    eq_terms = []
    eq_start = rl
    simple_equity = not has_income and not drawings
    for acc in capitals:
        bs.set(rl, 2, acc.name if simple_equity else f"{acc.name}, beginning")
        eq_terms.append("+" + bs.set(rl, 3, tb_amount(acc), format_type="currency", text_align="right"))
        rl += 1
    if has_income:
        bs.set(rl, 2, f'=IF({net_income_ref}<0,"Less: Net Loss","Add: Net Income")')
        eq_terms.append("+" + bs.set(rl, 3, f"={net_income_ref}", format_type="currency", text_align="right"))
        rl += 1
    for acc in drawings:
        bs.set(rl, 2, f"Less: {acc.name}")
        eq_terms.append("-" + bs.set(rl, 3, tb_amount(acc), format_type="currency", text_align="right"))
        rl += 1
    if len(eq_terms) > 1:
        bs.add_border(rl - 1, 3, "bottom:thin")
        owner_name = capitals[0].name if capitals else "Owner's Capital"
        bs.set(rl, 2, f"{owner_name}, ending" if capitals else "Total Owner's Equity")
        total_eq_ref = bs.set(rl, 3, "=" + "".join(eq_terms).lstrip("+"), format_type="currency", text_align="right")
        bs.add_border(rl, 3, "bottom:thin")
        rl += 1
    elif eq_terms:
        total_eq_ref = a1(eq_start, 3)
        bs.add_border(eq_start, 3, "bottom:thin")
    else:
        bs.set(rl, 2, "Owner's Capital")
        total_eq_ref = bs.set(rl, 3, "0", format_type="currency", text_align="right")
        rl += 1

    # Totals on the same final row (both sides)
    tr = max(ra, rl) + 1
    bs.set(tr, 0, "Total Assets", font_bold=True)
    bs.set(tr, 1, f"=SUM({asset_range})" if assets else "0", format_type="currency", text_align="right", font_bold=True)
    bs.set(tr, 2, "Total Liabilities and Owner's Equity", font_bold=True)
    bs.set(tr, 3, f"={total_liab_ref}+{total_eq_ref}", format_type="currency", text_align="right", font_bold=True)
    bs.add_border(tr, 1, "bottom:double")
    bs.add_border(tr, 3, "bottom:double")
    for rr in range(3, tr + 1):
        bs.style_row(rr, T["body"])
    sheets.append(bs)

    return sheets


def _find_generated(assignment_id):
    q = Workbook.query.filter(Workbook.description == GENERATED_MARKER)
    q = q.filter(Workbook.assignment_id == assignment_id) if assignment_id else q.filter(Workbook.assignment_id.is_(None))
    return q.first()


def find_generated_workbook(assignment_id=None):
    return _find_generated(assignment_id)


def generate_accounting_workbook(assignment_id=None):
    """(Re)create the generated accounting workbook for this scope and return it."""
    existing = _find_generated(assignment_id)
    if existing:
        db.session.delete(existing)
        db.session.flush()

    builders = build_workbook_data(assignment_id)
    wb = Workbook(name="Accounting Statements", description=GENERATED_MARKER, assignment_id=assignment_id)
    db.session.add(wb)
    db.session.flush()

    for pos, b in enumerate(builders):
        sheet = Sheet(
            name=b.name,
            workbook_id=wb.id,
            position=pos,
            row_count=max(60, b.max_row + 20),
            col_count=max(26, b.ncols),
            col_widths=json.dumps(b.col_widths),
            merges=json.dumps(b.merges),
        )
        db.session.add(sheet)
        db.session.flush()
        for (r, c), f in b.cells.items():
            raw = f.get("raw_value", "")
            if raw.startswith("="):
                dtype = "formula"
            else:
                try:
                    float(raw)
                    dtype = "number" if raw.strip() else "string"
                except ValueError:
                    dtype = "string"
            db.session.add(Cell(
                sheet_id=sheet.id, row=r, col=c,
                raw_value=raw,
                computed_value="" if dtype == "formula" else raw,
                data_type=dtype,
                format_type=f.get("format_type", "general"),
                decimal_places=2,
                font_bold=f.get("font_bold", False),
                font_italic=f.get("font_italic", False),
                font_size=f.get("font_size", 12),
                font_color=f.get("font_color", "#000000"),
                bg_color=f.get("bg_color", ""),
                text_align=f.get("text_align", "left"),
                border=f.get("border", ""),
            ))
    db.session.commit()
    return wb
