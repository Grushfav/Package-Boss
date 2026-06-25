import os
from pathlib import Path

from dotenv import load_dotenv

_root_env = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_root_env)
load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///package_boss.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    }

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24 * 7  # 7 days

    BOSS_ID_SEQ_START = int(os.environ.get("BOSS_ID_SEQ_START", "90001"))

    TRN_ENCRYPTION_KEY = os.environ.get("TRN_ENCRYPTION_KEY", "")
    TRN_PEPPER = os.environ.get("TRN_PEPPER", "")

    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

    WAREHOUSE_LINE1 = os.environ.get("WAREHOUSE_LINE1", "9999 North America Way")
    WAREHOUSE_CITY = os.environ.get("WAREHOUSE_CITY", "Miami")
    WAREHOUSE_STATE = os.environ.get("WAREHOUSE_STATE", "FL")
    WAREHOUSE_ZIP = os.environ.get("WAREHOUSE_ZIP", "33132")
    WAREHOUSE_COUNTRY = os.environ.get("WAREHOUSE_COUNTRY", "US")

    EMAIL_PROVIDER = os.environ.get("EMAIL_PROVIDER", "console")
    EMAIL_API_URL = os.environ.get("EMAIL_API_URL", "").rstrip("/")
    EMAIL_API_KEY = os.environ.get("EMAIL_API_KEY", "")
    IMAGE_UPLOAD_URL = os.environ.get("IMAGE_UPLOAD_URL", "")
    IMAGE_API_KEY = os.environ.get("IMAGE_API_KEY", "")
    IMAGE_UPLOAD_WORKER_URL = os.environ.get("IMAGE_UPLOAD_WORKER_URL", "").rstrip("/")
    IMAGE_UPLOAD_API_KEY = os.environ.get("IMAGE_UPLOAD_API_KEY", "") or IMAGE_API_KEY
    DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "gavin@geeksja.com")
    EMAIL_LOGO_URL = os.environ.get("EMAIL_LOGO_URL", "").strip()
    WHATSAPP_PROVIDER = os.environ.get("WHATSAPP_PROVIDER", "console")

    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    CLERK_EMAIL = os.environ.get("CLERK_EMAIL", "").strip().lower()
    # Legacy alias — treated as CLERK_EMAIL if CLERK_EMAIL is unset
    STAFF_EMAIL = os.environ.get("STAFF_EMAIL", "").strip().lower()

    R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET = os.environ.get("R2_BUCKET", "package-boss-uploads")
    R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "")
