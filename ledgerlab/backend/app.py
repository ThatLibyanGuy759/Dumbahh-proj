import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask
from flask_cors import CORS
from sqlalchemy import inspect, text
from config import Config
from models import db

def _migrate(db):
    """Add columns introduced after the database was first created."""
    with db.engine.begin() as conn:
        cols = {column["name"] for column in inspect(conn).get_columns("sheets")}
        if "merges" not in cols:
            conn.execute(text("ALTER TABLE sheets ADD COLUMN merges TEXT DEFAULT '[]'"))


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

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
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=os.environ.get("FLASK_DEBUG") == "1",
    )
