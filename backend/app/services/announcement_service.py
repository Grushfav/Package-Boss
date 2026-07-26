import threading
import uuid
from datetime import datetime

from flask import current_app
from sqlalchemy import or_

from app.extensions import db
from app.models.announcement import (
    ANNOUNCEMENT_AUDIENCES,
    ANNOUNCEMENT_DISPLAY_TYPES,
    ANNOUNCEMENT_SEVERITIES,
    BROADCAST_CHANNELS,
    SEVERITY_ORDER,
    Announcement,
    AnnouncementDismissal,
    AnnouncementRead,
    BroadcastJob,
)
from app.models.user import User
from app.services.audit_service import log_entity_action

ACTION_ANNOUNCEMENT_CREATED = "announcement.created"
ACTION_ANNOUNCEMENT_UPDATED = "announcement.updated"
ACTION_ANNOUNCEMENT_DELETED = "announcement.deleted"
ACTION_ANNOUNCEMENT_BROADCAST = "announcement.broadcast"

CONTEXT_AUDIENCES = {
    "public": ("public", "all"),
    "customer": ("public", "customers", "all"),
    "staff": ("public", "staff", "all"),
}

EMAIL_BATCH_SIZE = 50


def _parse_dt(value, field_name: str) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as exc:
        raise ValueError(f"Invalid {field_name}") from exc


def _validate_announcement_data(data: dict, *, partial: bool = False) -> dict:
    cleaned: dict = {}

    if "title" in data or not partial:
        title = (data.get("title") or "").strip()
        if not title:
            raise ValueError("Title is required")
        if len(title) > 120:
            raise ValueError("Title must be 120 characters or fewer")
        cleaned["title"] = title

    if "body" in data or not partial:
        body = (data.get("body") or "").strip()
        if not body:
            raise ValueError("Message body is required")
        if len(body) > 5000:
            raise ValueError("Message body must be 5000 characters or fewer")
        cleaned["body"] = body

    if "severity" in data or not partial:
        severity = (data.get("severity") or "info").strip().lower()
        if severity not in ANNOUNCEMENT_SEVERITIES:
            raise ValueError("Invalid severity")
        cleaned["severity"] = severity

    if "audience" in data or not partial:
        audience = (data.get("audience") or "customers").strip().lower()
        if audience not in ANNOUNCEMENT_AUDIENCES:
            raise ValueError("Invalid audience")
        cleaned["audience"] = audience

    if "display_as" in data or not partial:
        display_as = (data.get("display_as") or "banner").strip().lower()
        if display_as not in ANNOUNCEMENT_DISPLAY_TYPES:
            raise ValueError("Invalid display type")
        cleaned["display_as"] = display_as

    if "starts_at" in data:
        cleaned["starts_at"] = _parse_dt(data.get("starts_at"), "starts_at") or datetime.utcnow()
    elif not partial:
        cleaned["starts_at"] = datetime.utcnow()

    if "ends_at" in data:
        cleaned["ends_at"] = _parse_dt(data.get("ends_at"), "ends_at")

    if "is_active" in data:
        cleaned["is_active"] = bool(data.get("is_active"))

    if "dismissible" in data:
        cleaned["dismissible"] = bool(data.get("dismissible"))

    if cleaned.get("ends_at") and cleaned.get("starts_at") and cleaned["ends_at"] <= cleaned["starts_at"]:
        raise ValueError("End date must be after start date")

    return cleaned


def _active_time_filter():
    now = datetime.utcnow()
    return (
        Announcement.is_active.is_(True),
        Announcement.starts_at <= now,
        or_(Announcement.ends_at.is_(None), Announcement.ends_at > now),
    )


def _audiences_for_context(context: str) -> tuple[str, ...]:
    return CONTEXT_AUDIENCES.get(context, CONTEXT_AUDIENCES["public"])


def _recipient_query(audience: str):
    base = User.query.filter(User.is_active.is_(True))
    if audience == "customers":
        return base.filter(User.role == "customer")
    if audience == "staff":
        return base.filter(User.role.in_(("clerk", "admin")))
    if audience == "all":
        return base.filter(User.role.in_(("customer", "clerk", "admin")))
    # public audience email broadcast → customers only
    return base.filter(User.role == "customer")


def list_admin_announcements() -> list[Announcement]:
    return (
        Announcement.query.order_by(Announcement.created_at.desc()).all()
    )


def get_announcement(announcement_id: uuid.UUID) -> Announcement | None:
    return Announcement.query.get(announcement_id)


def create_announcement(actor: User, data: dict) -> Announcement:
    cleaned = _validate_announcement_data(data)
    dismissible = cleaned.pop("dismissible", True)
    announcement = Announcement(
        created_by_id=actor.id,
        dismissible=dismissible,
        **cleaned,
    )
    db.session.add(announcement)
    db.session.commit()
    log_entity_action(
        actor,
        ACTION_ANNOUNCEMENT_CREATED,
        "announcement",
        str(announcement.id),
        f"Created announcement: {announcement.title}",
    )
    return announcement


def update_announcement(announcement: Announcement, actor: User, data: dict) -> Announcement:
    cleaned = _validate_announcement_data(data, partial=True)
    for key, value in cleaned.items():
        setattr(announcement, key, value)
    db.session.commit()
    log_entity_action(
        actor,
        ACTION_ANNOUNCEMENT_UPDATED,
        "announcement",
        str(announcement.id),
        f"Updated announcement: {announcement.title}",
    )
    return announcement


def delete_announcement(announcement: Announcement, actor: User) -> None:
    title = announcement.title
    announcement_id = str(announcement.id)
    db.session.delete(announcement)
    db.session.commit()
    log_entity_action(
        actor,
        ACTION_ANNOUNCEMENT_DELETED,
        "announcement",
        announcement_id,
        f"Deleted announcement: {title}",
    )


def list_active_banners(
    context: str,
    user: User | None = None,
) -> list[dict]:
    audiences = _audiences_for_context(context)
    filters = [
        *_active_time_filter(),
        Announcement.audience.in_(audiences),
        Announcement.display_as.in_(("banner", "modal")),
    ]
    rows = Announcement.query.filter(*filters).all()

    dismissed_ids: set[uuid.UUID] = set()
    if user:
        dismissed_ids = {
            d.announcement_id
            for d in AnnouncementDismissal.query.filter_by(user_id=user.id).all()
        }

    visible = [a for a in rows if a.id not in dismissed_ids]
    visible.sort(
        key=lambda a: (
            -SEVERITY_ORDER.get(a.severity, 0),
            -(a.created_at.timestamp() if a.created_at else 0),
        )
    )
    return [a.to_banner_dict() for a in visible]


def pick_primary_banner(banners: list[dict]) -> dict | None:
    if not banners:
        return None
    banner_type = next((b for b in banners if b["display_as"] == "banner"), None)
    if banner_type:
        return banner_type
    return banners[0]


def list_user_inbox(user: User) -> list[dict]:
    audiences = _audiences_for_context("customer" if user.role == "customer" else "staff")
    if user.role == "admin":
        audiences = ("public", "customers", "staff", "all")

    now = datetime.utcnow()
    rows = (
        Announcement.query.filter(
            Announcement.broadcast_at.isnot(None),
            Announcement.audience.in_(audiences),
            Announcement.is_active.is_(True),
            or_(Announcement.ends_at.is_(None), Announcement.ends_at > now),
        )
        .order_by(Announcement.broadcast_at.desc())
        .limit(100)
        .all()
    )

    read_ids = {
        r.announcement_id
        for r in AnnouncementRead.query.filter_by(user_id=user.id).all()
    }

    return [
        {
            **a.to_dict(include_body=True),
            "is_read": a.id in read_ids,
        }
        for a in rows
    ]


def dismiss_announcement(user: User, announcement_id: uuid.UUID) -> None:
    announcement = get_announcement(announcement_id)
    if not announcement:
        raise ValueError("Announcement not found")
    if not announcement.dismissible:
        raise ValueError("This announcement cannot be dismissed")

    existing = AnnouncementDismissal.query.filter_by(
        user_id=user.id, announcement_id=announcement_id
    ).first()
    if existing:
        return

    db.session.add(
        AnnouncementDismissal(user_id=user.id, announcement_id=announcement_id)
    )
    db.session.commit()


def mark_announcement_read(user: User, announcement_id: uuid.UUID) -> None:
    announcement = get_announcement(announcement_id)
    if not announcement:
        raise ValueError("Announcement not found")

    existing = AnnouncementRead.query.filter_by(
        user_id=user.id, announcement_id=announcement_id
    ).first()
    if existing:
        return

    db.session.add(AnnouncementRead(user_id=user.id, announcement_id=announcement_id))
    db.session.commit()


def _run_email_broadcast(app, job_id: uuid.UUID) -> None:
    with app.app_context():
        from app.services.email_service import send_announcement_email

        job = BroadcastJob.query.get(job_id)
        if not job:
            return
        announcement = job.announcement
        job.status = "running"
        job.started_at = datetime.utcnow()
        db.session.commit()

        recipients = _recipient_query(announcement.audience).all()
        sent = 0
        failed = 0

        for user in recipients:
            try:
                send_announcement_email(
                    user.email,
                    user.first_name,
                    announcement.title,
                    announcement.body,
                )
                sent += 1
            except Exception as exc:
                failed += 1
                app.logger.warning(
                    "Broadcast email failed for %s: %s", user.email, exc
                )

            if (sent + failed) % EMAIL_BATCH_SIZE == 0:
                job.sent_count = sent
                job.failed_count = failed
                db.session.commit()

        job.sent_count = sent
        job.failed_count = failed
        job.status = "completed" if failed == 0 else "completed"
        job.completed_at = datetime.utcnow()
        db.session.commit()


def broadcast_announcement(
    announcement: Announcement,
    actor: User,
    *,
    channels: list[str],
    also_show_banner: bool = False,
) -> BroadcastJob:
    normalized = [c.strip().lower() for c in channels if c]
    for channel in normalized:
        if channel not in BROADCAST_CHANNELS:
            raise ValueError(f"Invalid channel: {channel}")
    if not normalized:
        raise ValueError("Select at least one broadcast channel")

    if also_show_banner and announcement.display_as == "inbox_only":
        announcement.display_as = "banner"

    announcement.broadcast_at = datetime.utcnow()
    job = BroadcastJob(
        announcement_id=announcement.id,
        channels=normalized,
        status="pending",
    )
    db.session.add(job)
    db.session.commit()

    log_entity_action(
        actor,
        ACTION_ANNOUNCEMENT_BROADCAST,
        "announcement",
        str(announcement.id),
        f"Broadcast announcement: {announcement.title}",
        {"channels": normalized, "also_show_banner": also_show_banner},
    )

    if "email" in normalized:
        app = current_app._get_current_object()
        thread = threading.Thread(
            target=_run_email_broadcast,
            args=(app, job.id),
            daemon=True,
        )
        thread.start()
    else:
        job.status = "completed"
        job.started_at = datetime.utcnow()
        job.completed_at = datetime.utcnow()
        db.session.commit()

    return job


def latest_broadcast_job(announcement: Announcement) -> BroadcastJob | None:
    return (
        BroadcastJob.query.filter_by(announcement_id=announcement.id)
        .order_by(BroadcastJob.created_at.desc())
        .first()
    )
