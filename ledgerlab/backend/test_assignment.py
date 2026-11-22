from app import create_app
from models import db, Account, Assignment
from routes.journal_entries import _parse_single_transaction_line
from routes.reports import _get_account_balances, generate_trial_balance, generate_income_statement, generate_balance_sheet
from routes.journal_entries import bulk_create
from flask import Flask

app = create_app()

with app.app_context():
    db.drop_all()
    db.create_all()

    assign = Assignment(
        name="Mr. Scarpelli's Electronic Repair Services",
        course="Accounting - June 2025"
    )
    db.session.add(assign)
    db.session.commit()

    accounts_data = [
        {'code': '100', 'name': 'Cash', 'account_type': 'asset', 'normal_balance': 'debit', 'opening_balance': 1300.0},
        {'code': '101', 'name': 'Accounts Receivable', 'account_type': 'asset', 'normal_balance': 'debit', 'opening_balance': 1400.0},
        {'code': '102', 'name': 'Supplies', 'account_type': 'asset', 'normal_balance': 'debit', 'opening_balance': 300.0},
        {'code': '103', 'name': 'Land', 'account_type': 'asset', 'normal_balance': 'debit', 'opening_balance': 93000.0},
        {'code': '104', 'name': 'Building', 'account_type': 'asset', 'normal_balance': 'debit', 'opening_balance': 104000.0},
        {'code': '105', 'name': 'Equipment', 'account_type': 'asset', 'normal_balance': 'debit', 'opening_balance': 11400.0},
        {'code': '200', 'name': 'Accounts Payable', 'account_type': 'liability', 'normal_balance': 'credit', 'opening_balance': 2100.0},
        {'code': '201', 'name': 'Bank Loan', 'account_type': 'liability', 'normal_balance': 'credit', 'opening_balance': 10100.0},
        {'code': '202', 'name': 'Mortgage', 'account_type': 'liability', 'normal_balance': 'credit', 'opening_balance': 165000.0},
        {'code': '300', 'name': 'Mr. Scarpelli, Capital', 'account_type': 'equity', 'normal_balance': 'credit', 'opening_balance': 34200.0},
        {'code': '301', 'name': 'Mr. Scarpelli, Drawings', 'account_type': 'equity', 'normal_balance': 'debit', 'opening_balance': 0.0},
        {'code': '400', 'name': 'Sales', 'account_type': 'revenue', 'normal_balance': 'credit', 'opening_balance': 0.0},
        {'code': '401', 'name': 'Fees Earned', 'account_type': 'revenue', 'normal_balance': 'credit', 'opening_balance': 0.0},
        {'code': '500', 'name': 'Salaries Expense', 'account_type': 'expense', 'normal_balance': 'debit', 'opening_balance': 0.0},
        {'code': '501', 'name': 'Advertising Expense', 'account_type': 'expense', 'normal_balance': 'debit', 'opening_balance': 0.0},
        {'code': '502', 'name': 'Delivery Expense', 'account_type': 'expense', 'normal_balance': 'debit', 'opening_balance': 0.0},
        {'code': '503', 'name': 'Hydro Expense', 'account_type': 'expense', 'normal_balance': 'debit', 'opening_balance': 0.0},
        {'code': '504', 'name': 'Water Expense', 'account_type': 'expense', 'normal_balance': 'debit', 'opening_balance': 0.0},
        {'code': '505', 'name': 'Miscellaneous Expense', 'account_type': 'expense', 'normal_balance': 'debit', 'opening_balance': 0.0},
    ]

    for a in accounts_data:
        db.session.add(Account(**a, assignment_id=assign.id))
    db.session.commit()

    accounts = Account.query.filter_by(assignment_id=assign.id).order_by(Account.code).all()
    print(f"Created {len(accounts)} accounts.")

    # Transactions from prompt
    raw_txns = """June 4: Customer was invoiced $1900.00 for sale of stock to be paid within 30 days
June 7: Paid $160.00 to pay for water expense
June 8: Paid $290.00 to pay for advertising expense
June 10: Paid $250.00 to pay for salaries expense
June 12: Bought $1400.00 worth of supplies on credit, to be paid off within 30 days
June 15: $200.00 paid for advertising service
June 17: Traded in $1000.00 worth of old equipment for store credit we will use within 30 days.
June 18: $50.00 paid for advertising service
June 21: Returned $3000.00 worth of old equipment, but will be refunded within 30 days.
June 22: $230.00 paid for advertising service
June 25: Refunded $3700.00 worth of equipment for cash
June 27: Paid $220.00 to pay for hydro expense"""

    parsed = []
    for line in raw_txns.strip().splitlines():
        p = _parse_single_transaction_line(line, accounts, default_year=2025)
        parsed.append(p)
        print(f"Parsed: {p['date']} | Dr: {p['debit_account_code']} {p['debit_account_name']} ${p['amount']} | Cr: {p['credit_account_code']} {p['credit_account_name']} ${p['amount']}")

    # Bulk create & post
    from models import JournalEntry, JournalLine
    from datetime import date
    for p in parsed:
        je = JournalEntry(
            entry_number=f"JE-{len(JournalEntry.query.all())+1:04d}",
            date=date.fromisoformat(p["date"]),
            description=p["description"],
            status="posted",
            assignment_id=assign.id
        )
        db.session.add(je)
        db.session.flush()
        l1 = JournalLine(journal_entry_id=je.id, line_number=1, account_id=p["debit_account_id"], debit=p["amount"], credit=0.0)
        l2 = JournalLine(journal_entry_id=je.id, line_number=2, account_id=p["credit_account_id"], debit=0.0, credit=p["amount"])
        db.session.add_all([l1, l2])
    db.session.commit()
    print("Posted all entries!")

    # Test Reports
    with app.test_request_context(f"/api/reports/generate/trial-balance?assignment_id={assign.id}&hide_unused=true"):
        res = generate_trial_balance().get_json()
        print("\n--- TRIAL BALANCE ---")
        print(f"Total Debits: ${res['total_debits']:,.2f} | Total Credits: ${res['total_credits']:,.2f} | Balanced: {res['is_balanced']}")
        for a in res["accounts"]:
            dr = f"${a['debit']:,.2f}" if a['debit'] > 0 else ""
            cr = f"${a['credit']:,.2f}" if a['credit'] > 0 else ""
            print(f"  {a['account_code']} {a['account_name']:<25} Dr: {dr:>12} | Cr: {cr:>12}")

    with app.test_request_context(f"/api/reports/generate/income-statement?assignment_id={assign.id}&hide_unused=true"):
        res = generate_income_statement().get_json()
        print("\n--- INCOME STATEMENT ---")
        print(f"Total Revenue: ${res['total_revenue']:,.2f}")
        print(f"Total Expenses: ${res['total_expenses']:,.2f}")
        print(f"Net Income: ${res['net_income']:,.2f}")

    with app.test_request_context(f"/api/reports/generate/balance-sheet?assignment_id={assign.id}&hide_unused=true"):
        res = generate_balance_sheet().get_json()
        print("\n--- BALANCE SHEET ---")
        print(f"Total Assets: ${res['total_assets']:,.2f}")
        print(f"Total Liabilities: ${res['total_liabilities']:,.2f}")
        print(f"Beginning Capital: ${res['beginning_capital']:,.2f}")
        print(f"Net Income: ${res['net_income']:,.2f}")
        print(f"Ending Capital: ${res['ending_capital']:,.2f}")
        print(f"Total Liabilities & Equity: ${res['total_liabilities_and_equity']:,.2f}")
        print(f"Balanced: {res['is_balanced']}")
