import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask
from flask_cors import CORS
from config import Config
from models import db

def _migrate(db):
    """Add columns introduced after the database was first created (SQLite has no auto-migrate)."""
    from sqlalchemy import text
    with db.engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(sheets)"))}
        if "merges" not in cols:
            conn.execute(text("ALTER TABLE sheets ADD COLUMN merges TEXT DEFAULT '[]'"))


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    db.init_app(app)

    # Register blueprints
    from routes.assignments import bp as assignments_bp
    from routes.workbooks import bp as workbooks_bp
    from routes.sheets import bp as sheets_bp
    from routes.journal_entries import bp as journal_entries_bp
    from routes.accounts import bp as accounts_bp
    from routes.reports import bp as reports_bp
    from routes.bank_reconciliation import bp as bank_reconciliation_bp

    app.register_blueprint(assignments_bp)
    app.register_blueprint(workbooks_bp)
    app.register_blueprint(sheets_bp)
    app.register_blueprint(journal_entries_bp)
    app.register_blueprint(accounts_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(bank_reconciliation_bp)

    with app.app_context():
        db.create_all()
        _migrate(db)

    @app.route("/api/health")
    def health():
        return {"status": "ok", "app": "LedgerLab"}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
