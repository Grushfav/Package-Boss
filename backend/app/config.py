import os
from pathlib import Path

from dotenv import load_dotenv

_root_env = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_root_env)
load_dotenv()

INSECURE_SECRET_VALUES = frozenset(
    {
        "",
        "dev-secret-change-me",
        "change-me-in-production",
    }
)


def is_production_env() -> bool:
    env = (os.environ.get("FLASK_ENV") or os.environ.get("ENV") or "development").strip().lower()
    return env == "production"


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///package_boss.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    }

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24  # 24 hours

    BOSS_ID_SEQ_START = int(os.environ.get("BOSS_ID_SEQ_START", "1000"))

    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")

    @staticmethod
    def _build_cors_origins() -> list[str]:
        frontend = os.environ.get("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")
        raw = os.environ.get("CORS_ORIGINS", "").strip()
        if not raw:
            raw = frontend
        origins = {origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()}
        if frontend:
            origins.add(frontend)
        return sorted(origins)

    CORS_ORIGINS = _build_cors_origins()

    WAREHOUSE_LINE1 = os.environ.get("WAREHOUSE_LINE1", "2201 SW 59th Terrace")
    WAREHOUSE_CITY = os.environ.get("WAREHOUSE_CITY", "West Park")
    WAREHOUSE_STATE = os.environ.get("WAREHOUSE_STATE", "FL")
    WAREHOUSE_ZIP = os.environ.get("WAREHOUSE_ZIP", "33023")
    WAREHOUSE_COUNTRY = os.environ.get("WAREHOUSE_COUNTRY", "US")

    EMAIL_PROVIDER = os.environ.get("EMAIL_PROVIDER", "console")
    EMAIL_API_URL = os.environ.get("EMAIL_API_URL", "").rstrip("/")
    EMAIL_API_KEY = os.environ.get("EMAIL_API_KEY", "")
    IMAGE_UPLOAD_URL = os.environ.get("IMAGE_UPLOAD_URL", "")
    IMAGE_API_KEY = os.environ.get("IMAGE_API_KEY", "")
    IMAGE_UPLOAD_WORKER_URL = os.environ.get("IMAGE_UPLOAD_WORKER_URL", "").rstrip("/")
    IMAGE_UPLOAD_API_KEY = os.environ.get("IMAGE_UPLOAD_API_KEY", "") or IMAGE_API_KEY
    DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "info@packagebossja.com")
    DEFAULT_FROM_NAME = os.environ.get("DEFAULT_FROM_NAME", "Package Boss")
    EMAIL_LOGO_URL = os.environ.get("EMAIL_LOGO_URL", "").strip()
    WHATSAPP_PROVIDER = os.environ.get("WHATSAPP_PROVIDER", "console")
    WHATSAPP_ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    WHATSAPP_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_API_VERSION = os.environ.get("WHATSAPP_API_VERSION", "v21.0")

    # Optional base URL when DB stores object keys instead of full B2 URLs
    STORAGE_PUBLIC_URL = os.environ.get("STORAGE_PUBLIC_URL", "").strip().rstrip("/")

    # Local filesystem uploads when the B2 worker is not configured (development only)
    LOCAL_UPLOADS_ENABLED = os.environ.get("LOCAL_UPLOADS_ENABLED", "true").strip().lower() not in (
        "0",
        "false",
        "no",
    )
    LOCAL_UPLOAD_ROOT = os.environ.get("LOCAL_UPLOAD_ROOT", "").strip()

    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    CLERK_EMAIL = os.environ.get("CLERK_EMAIL", "").strip().lower()
    # Legacy alias — treated as CLERK_EMAIL if CLERK_EMAIL is unset
    STAFF_EMAIL = os.environ.get("STAFF_EMAIL", "").strip().lower()

    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()

    FYGARO_API_KEY = os.environ.get("FYGARO_API_KEY", "").strip()
    FYGARO_SECRET_KEY = os.environ.get("FYGARO_SECRET_KEY", "").strip()
    FYGARO_PAYMENT_BUTTON_URL = os.environ.get("FYGARO_PAYMENT_BUTTON_URL", "").strip().rstrip("/")
    FYGARO_CURRENCY = os.environ.get("FYGARO_CURRENCY", "JMD").strip().upper()


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False

    @classmethod
    def validate(cls) -> None:
        secret = (os.environ.get("SECRET_KEY") or "").strip()
        jwt_secret = (os.environ.get("JWT_SECRET_KEY") or "").strip()
        database_url = (os.environ.get("DATABASE_URL") or "").strip()

        errors: list[str] = []

        if secret in INSECURE_SECRET_VALUES:
            errors.append("SECRET_KEY must be set to a secure random value in production")
        if jwt_secret in INSECURE_SECRET_VALUES:
            errors.append("JWT_SECRET_KEY must be set to a secure random value in production")
        elif jwt_secret == secret:
            errors.append("JWT_SECRET_KEY must differ from SECRET_KEY in production")
        if not database_url:
            errors.append("DATABASE_URL must be set in production")
        elif database_url.lower().startswith("sqlite"):
            errors.append("DATABASE_URL must not use SQLite in production")

        if errors:
            message = "Production configuration invalid:\n" + "\n".join(f"  - {item}" for item in errors)
            raise RuntimeError(message)


def get_config_class():
    if is_production_env():
        return ProductionConfig
    return DevelopmentConfig


# Backwards-compatible default for imports and tests that pass Config explicitly.
Config = DevelopmentConfig
