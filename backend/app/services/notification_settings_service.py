from datetime import datetime

from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models.app_setting import CUSTOMER_EMAIL_NOTIFICATIONS_KEY, AppSetting
from app.models.user import User


def _parse_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in ("1", "true", "yes", "on"):
        return True
    if normalized in ("0", "false", "no", "off"):
        return False
    return default


def _ensure_settings_table() -> None:
    from sqlalchemy import inspect

    from app.db_schema import ensure_schema
    from flask import current_app

    if "app_settings" not in inspect(db.engine).get_table_names():
        ensure_schema(current_app._get_current_object())
        db.session.rollback()


def customer_email_notifications_enabled() -> bool:
    try:
        _ensure_settings_table()
        row = db.session.get(AppSetting, CUSTOMER_EMAIL_NOTIFICATIONS_KEY)
    except SQLAlchemyError:
        db.session.rollback()
        return True
    if row is None:
        return True
    return _parse_bool(row.value, default=True)


def get_customer_email_notification_settings() -> dict:
    try:
        _ensure_settings_table()
        row = db.session.get(AppSetting, CUSTOMER_EMAIL_NOTIFICATIONS_KEY)
    except SQLAlchemyError:
        db.session.rollback()
        return {
            "customer_email_notifications_enabled": True,
            "updated_at": None,
            "updated_by_id": None,
        }
    enabled = customer_email_notifications_enabled()
    return {
        "customer_email_notifications_enabled": enabled,
        "updated_at": row.updated_at.isoformat() if row and row.updated_at else None,
        "updated_by_id": str(row.updated_by_id) if row and row.updated_by_id else None,
    }


def set_customer_email_notifications_enabled(enabled: bool, updated_by: User | None = None) -> dict:
    _ensure_settings_table()
    row = db.session.get(AppSetting, CUSTOMER_EMAIL_NOTIFICATIONS_KEY)
    value = "true" if enabled else "false"
    now = datetime.utcnow()

    if row is None:
        row = AppSetting(
            key=CUSTOMER_EMAIL_NOTIFICATIONS_KEY,
            value=value,
            updated_at=now,
            updated_by_id=updated_by.id if updated_by else None,
        )
        db.session.add(row)
    else:
        row.value = value
        row.updated_at = now
        row.updated_by_id = updated_by.id if updated_by else row.updated_by_id

    db.session.commit()
    return get_customer_email_notification_settings()
