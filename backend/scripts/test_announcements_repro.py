"""Minimal repro for admin announcement service flows."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from flask import Flask

from app.extensions import db
import app.models  # noqa: F401 — register models for create_all
from app.models.announcement import Announcement
from app.models.user import User
from app.services.announcement_service import (
    broadcast_announcement,
    latest_broadcast_job,
    list_admin_announcements,
    update_announcement,
)
from app.services.auth_service import hash_password


def main() -> None:
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    with app.app_context():
        db.create_all()
        admin = User(
            email="admin@test.local",
            password_hash=hash_password("secret"),
            first_name="Admin",
            last_name="User",
            role="admin",
            shipping_id="BOSS-ADMIN",
            is_active=True,
        )
        db.session.add(admin)
        db.session.commit()

        now = datetime.utcnow()
        announcement = Announcement(
            title="Shipping Timeline",
            body="Test body",
            severity="info",
            audience="customers",
            target_mode="broadcast",
            target_criteria=None,
            display_as="banner",
            starts_at=now - timedelta(days=7),
            ends_at=now - timedelta(days=1),
            is_active=True,
            dismissible=True,
            created_by_id=admin.id,
        )
        db.session.add(announcement)
        db.session.commit()

        print("list:", len(list_admin_announcements()))
        print("serialize:", list_admin_announcements()[0].to_dict(job=latest_broadcast_job(announcement)))
        print("deactivate:", update_announcement(announcement, admin, {"is_active": False}).is_active)
        print("broadcast:", broadcast_announcement(announcement, admin, channels=["in_app"]).status)
        print("OK")


if __name__ == "__main__":
    main()
