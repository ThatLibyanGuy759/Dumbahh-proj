from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy
import json

db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc)


class Assignment(db.Model):
    __tablename__ = "assignments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, default="")
    course = db.Column(db.String(255), default="")
    status = db.Column(db.String(50), default="in_progress")  # in_progress, completed, archived
    due_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    workbooks = db.relationship("Workbook", backref="assignment", lazy=True, cascade="all, delete-orphan")
    reports = db.relationship("Report", backref="assignment", lazy=True, cascade="all, delete-orphan")
    accounts = db.relationship("Account", backref="assignment", lazy=True, cascade="all, delete-orphan")
    journal_entries = db.relationship("JournalEntry", backref="assignment", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "course": self.course,
            "status": self.status,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "workbook_count": len(self.workbooks),
            "report_count": len(self.reports),
            "account_count": len(self.accounts),
            "entry_count": len(self.journal_entries),
        }


class Workbook(db.Model):
    __tablename__ = "workbooks"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, default="")
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    sheets = db.relationship("Sheet", backref="workbook", lazy=True, cascade="all, delete-orphan",
                             order_by="Sheet.position")

    def to_dict(self, include_sheets=False):
        d = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "assignment_id": self.assignment_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "sheet_count": len(self.sheets),
        }
        if include_sheets:
            d["sheets"] = [s.to_dict() for s in self.sheets]
        return d


class Sheet(db.Model):
    __tablename__ = "sheets"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, default="Sheet 1")
    workbook_id = db.Column(db.Integer, db.ForeignKey("workbooks.id"), nullable=False)
    position = db.Column(db.Integer, default=0)
    row_count = db.Column(db.Integer, default=100)
    col_count = db.Column(db.Integer, default=26)
    frozen_rows = db.Column(db.Integer, default=0)
    frozen_cols = db.Column(db.Integer, default=0)
    col_widths = db.Column(db.Text, default="{}")
    row_heights = db.Column(db.Text, default="{}")
    merges = db.Column(db.Text, default="[]")  # [{"r":0,"c":0,"rs":1,"cs":3}, ...]
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    cells = db.relationship("Cell", backref="sheet", lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_cells=False):
        d = {
            "id": self.id,
            "name": self.name,
            "workbook_id": self.workbook_id,
            "position": self.position,
            "row_count": self.row_count,
            "col_count": self.col_count,
            "frozen_rows": self.frozen_rows,
            "frozen_cols": self.frozen_cols,
            "col_widths": json.loads(self.col_widths) if self.col_widths else {},
            "row_heights": json.loads(self.row_heights) if self.row_heights else {},
            "merges": json.loads(self.merges) if self.merges else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_cells:
            d["cells"] = [c.to_dict() for c in self.cells]
        return d


class Cell(db.Model):
    __tablename__ = "cells"

    id = db.Column(db.Integer, primary_key=True)
    sheet_id = db.Column(db.Integer, db.ForeignKey("sheets.id"), nullable=False)
    row = db.Column(db.Integer, nullable=False)
    col = db.Column(db.Integer, nullable=False)
    raw_value = db.Column(db.Text, default="")
    computed_value = db.Column(db.Text, default="")
    data_type = db.Column(db.String(20), default="string")
    format_type = db.Column(db.String(50), default="general")
    decimal_places = db.Column(db.Integer, default=2)
    font_bold = db.Column(db.Boolean, default=False)
    font_italic = db.Column(db.Boolean, default=False)
    font_size = db.Column(db.Integer, default=12)
    font_color = db.Column(db.String(20), default="#000000")
    bg_color = db.Column(db.String(20), default="")
    text_align = db.Column(db.String(10), default="left")
    border = db.Column(db.String(100), default="")
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        db.UniqueConstraint("sheet_id", "row", "col", name="uq_cell_position"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "sheet_id": self.sheet_id,
            "row": self.row,
            "col": self.col,
            "raw_value": self.raw_value,
            "computed_value": self.computed_value,
            "data_type": self.data_type,
            "format_type": self.format_type,
            "decimal_places": self.decimal_places,
            "font_bold": self.font_bold,
            "font_italic": self.font_italic,
            "font_size": self.font_size,
            "font_color": self.font_color,
            "bg_color": self.bg_color,
            "text_align": self.text_align,
            "border": self.border,
        }


class Account(db.Model):
    """Chart of Accounts"""
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    account_type = db.Column(db.String(50), nullable=False)
    # asset, liability, equity, revenue, expense
    normal_balance = db.Column(db.String(10), nullable=False)  # debit, credit
    opening_balance = db.Column(db.Float, default=0.0)  # Beginning balance
    parent_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id"), nullable=True)
    description = db.Column(db.Text, default="")
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    children = db.relationship("Account", backref=db.backref("parent", remote_side=[id]), lazy=True)
    journal_lines = db.relationship("JournalLine", backref="account", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "account_type": self.account_type,
            "normal_balance": self.normal_balance,
            "opening_balance": round(self.opening_balance or 0.0, 2),
            "parent_id": self.parent_id,
            "assignment_id": self.assignment_id,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class JournalEntry(db.Model):
    __tablename__ = "journal_entries"

    id = db.Column(db.Integer, primary_key=True)
    entry_number = db.Column(db.String(50), nullable=False)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.Text, default="")
    reference = db.Column(db.String(100), default="")
    status = db.Column(db.String(20), default="draft")  # draft, posted, void
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    lines = db.relationship("JournalLine", backref="journal_entry", lazy=True,
                            cascade="all, delete-orphan", order_by="JournalLine.line_number")

    @property
    def total_debits(self):
        return sum(line.debit for line in self.lines if line.debit)

    @property
    def total_credits(self):
        return sum(line.credit for line in self.lines if line.credit)

    @property
    def is_balanced(self):
        return abs(self.total_debits - self.total_credits) < 0.01

    def to_dict(self, include_lines=True):
        d = {
            "id": self.id,
            "entry_number": self.entry_number,
            "date": self.date.isoformat() if self.date else None,
            "description": self.description,
            "reference": self.reference,
            "status": self.status,
            "assignment_id": self.assignment_id,
            "total_debits": round(self.total_debits, 2),
            "total_credits": round(self.total_credits, 2),
            "is_balanced": self.is_balanced,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_lines:
            d["lines"] = [l.to_dict() for l in self.lines]
        return d


class JournalLine(db.Model):
    __tablename__ = "journal_lines"

    id = db.Column(db.Integer, primary_key=True)
    journal_entry_id = db.Column(db.Integer, db.ForeignKey("journal_entries.id"), nullable=False)
    line_number = db.Column(db.Integer, nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    debit = db.Column(db.Float, default=0.0)
    credit = db.Column(db.Float, default=0.0)
    description = db.Column(db.Text, default="")

    def to_dict(self):
        return {
            "id": self.id,
            "journal_entry_id": self.journal_entry_id,
            "line_number": self.line_number,
            "account_id": self.account_id,
            "account_name": self.account.name if self.account else None,
            "account_code": self.account.code if self.account else None,
            "debit": self.debit,
            "credit": self.credit,
            "description": self.description,
        }


class BankTransaction(db.Model):
    __tablename__ = "bank_transactions"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.Text, default="")
    amount = db.Column(db.Float, nullable=False)
    balance = db.Column(db.Float, default=0.0)
    reference = db.Column(db.String(100), default="")
    is_reconciled = db.Column(db.Boolean, default=False)
    matched_journal_line_id = db.Column(db.Integer, db.ForeignKey("journal_lines.id"), nullable=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "description": self.description,
            "amount": self.amount,
            "balance": self.balance,
            "reference": self.reference,
            "is_reconciled": self.is_reconciled,
            "matched_journal_line_id": self.matched_journal_line_id,
            "assignment_id": self.assignment_id,
        }


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    report_type = db.Column(db.String(50), nullable=False)
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id"), nullable=True)
    company_name = db.Column(db.String(255), default="")
    reporting_period = db.Column(db.String(100), default="")
    data = db.Column(db.Text, default="{}")
    template = db.Column(db.String(50), default="standard")
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "report_type": self.report_type,
            "assignment_id": self.assignment_id,
            "company_name": self.company_name,
            "reporting_period": self.reporting_period,
            "data": json.loads(self.data) if self.data else {},
            "template": self.template,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class VersionHistory(db.Model):
    __tablename__ = "version_history"

    id = db.Column(db.Integer, primary_key=True)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=False)
    snapshot = db.Column(db.Text, nullable=False)
    description = db.Column(db.String(255), default="Auto-save")
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


def scope_query(query, model, assignment_id):
    """Restrict a query to one workspace: a specific assignment, or the global
    workspace (assignment_id IS NULL) when no assignment is given."""
    if assignment_id:
        return query.filter(model.assignment_id == int(assignment_id))
    return query.filter(model.assignment_id.is_(None))
