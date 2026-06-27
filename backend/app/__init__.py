from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.extensions import db, jwt, migrate
from app.models.user import User
from app.services.unidentified_service import ensure_unidentified_holder
from app.routes import (
    admin_bp,
    auth_bp,
    health_bp,
    me_bp,
    packages_bp,
    parishes_bp,
    pre_alerts_bp,
    rates_bp,
    staff_bp,
    track_bp,
    uploads_bp,
)
from app.seeds.rate_tiers import seed_rate_tiers

_STARTUP_USER_COLUMNS = frozenset({"terms_accepted_at", "whatsapp_opt_in"})
_STARTUP_PACKAGE_COLUMNS = frozenset({"estimated_freight_jmd", "billing_status", "invoice_status"})


def _startup_schema_ready(inspector) -> bool:
    tables = set(inspector.get_table_names())
    if "users" not in tables or "shipping_rate_tiers" not in tables:
        return False
    if "delivery_addresses" not in tables:
        return False
    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if not _STARTUP_USER_COLUMNS.issubset(user_columns):
        return False
    package_columns = {col["name"] for col in inspector.get_columns("packages")}
    return _STARTUP_PACKAGE_COLUMNS.issubset(package_columns)


def create_app(config_class=Config):
    root_env = Path(__file__).resolve().parent.parent.parent / ".env"
    load_dotenv(root_env)
    load_dotenv()

    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    CORS(
        app,
        origins=app.config["CORS_ORIGINS"],
        supports_credentials=True,
    )

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(me_bp, url_prefix="/api")
    app.register_blueprint(parishes_bp, url_prefix="/api")
    app.register_blueprint(pre_alerts_bp, url_prefix="/api")
    app.register_blueprint(rates_bp, url_prefix="/api")
    app.register_blueprint(track_bp, url_prefix="/api")
    app.register_blueprint(packages_bp, url_prefix="/api")
    app.register_blueprint(staff_bp, url_prefix="/api")
    app.register_blueprint(uploads_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api")

    with app.app_context():
        from sqlalchemy import inspect

        from app import models  # noqa: F401

        inspector = inspect(db.engine)
        if _startup_schema_ready(inspector):
            seed_rate_tiers()
            ensure_unidentified_holder()
            _promote_role_emails(app)
        elif inspector.get_table_names():
            app.logger.warning(
                "Skipping startup seeds — run `flask db upgrade` to apply pending migrations."
            )

    return app


def _promote_role_emails(app):
    admin_email = app.config.get("ADMIN_EMAIL")
    if admin_email:
        user = User.query.filter_by(email=admin_email).first()
        if user and user.role != "admin":
            user.role = "admin"
            db.session.commit()
            app.logger.info("Promoted %s to admin role", admin_email)

    clerk_email = app.config.get("CLERK_EMAIL") or app.config.get("STAFF_EMAIL")
    if clerk_email:
        user = User.query.filter_by(email=clerk_email).first()
        if user and user.role == "customer":
            user.role = "clerk"
            db.session.commit()
            app.logger.info("Promoted %s to clerk role", clerk_email)
