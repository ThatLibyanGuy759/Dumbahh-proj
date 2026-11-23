import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'ledgerlab.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get("SECRET_KEY", "ledgerlab-dev-key-change-in-production")
    CORS_ORIGINS = [
        origin.strip().rstrip("/")
        for origin in f"{os.environ.get('FRONTEND_URL', '')},{os.environ.get('CORS_ORIGINS', '')}".split(",")
        if origin.strip()
    ] or ["http://localhost:5173"]
    JSON_SORT_KEYS = False
