import threading
import uuid
from collections import defaultdict
from datetime import datetime

from flask import current_app
from sqlalchemy import or_

from app.constants import PACKAGE_STATUSES, UNIDENTIFIED_HOLDER_SHIPPING_ID
from app.extensions import db
from app.models.announcement import (
    ANNOUNCEMENT_AUDIENCES,
    ANNOUNCEMENT_DISPLAY_TYPES,
    ANNOUNCEMENT_SEVERITIES,
    ANNOUNCEMENT_TARGET_MODES,
    BROADCAST_CHANNELS,
    SEVERITY_ORDER,
    Announcement,
    AnnouncementDismissal,
    AnnouncementRead,
    AnnouncementRecipient,
    BroadcastJob,
)
from app.models.package import Package
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


def _parse_uuid_list(values) -> list[uuid.UUID]:
    if not values:
        return []
    parsed: list[uuid.UUID] = []
    for raw in values:
        try:
            parsed.append(uuid.UUID(str(raw)))
        except ValueError as exc:
            raise ValueError(f"Invalid package ID: {raw}") from exc
    return parsed


def _parse_status_list(criteria: dict) -> list[str]:
    raw_statuses = criteria.get("package_statuses")
    if raw_statuses is None and criteria.get("package_status"):
        raw_statuses = [criteria.get("package_status")]
    if not raw_statuses:
        return []

    if not isinstance(raw_statuses, list):
        raise ValueError("package_statuses must be an array")

    statuses: list[str] = []
    seen: set[str] = set()
    for raw in raw_statuses:
        status = str(raw or "").strip().lower()
        if not status or status in seen:
            continue
        if status not in PACKAGE_STATUSES:
            raise ValueError(f"Invalid package status filter: {status}")
        seen.add(status)
        statuses.append(status)
    return statuses


def _validate_target_criteria(criteria: dict | None) -> dict:
    if not criteria or not isinstance(criteria, dict):
        raise ValueError("Targeting criteria are required for targeted announcements")

    package_ids = _parse_uuid_list(criteria.get("package_ids"))
    shipment_id_raw = criteria.get("shipment_id")
    package_statuses = _parse_status_list(criteria)

    shipment_id = None
    if shipment_id_raw:
        try:
            shipment_id = uuid.UUID(str(shipment_id_raw))
        except ValueError as exc:
            raise ValueError("Invalid shipment ID") from exc

    if not package_ids and not shipment_id and not package_statuses:
        raise ValueError(
            "Select at least one target: specific packages, a departure, or a package status"
        )

    cleaned = {}
    if package_ids:
        cleaned["package_ids"] = [str(value) for value in package_ids]
    if shipment_id:
        cleaned["shipment_id"] = str(shipment_id)
    if package_statuses:
        cleaned["package_statuses"] = package_statuses
    return cleaned


def _targeted_package_query(criteria: dict):
    query = Package.query.join(User, Package.customer_id == User.id).filter(
        User.is_active.is_(True),
        User.role == "customer",
        User.shipping_id != UNIDENTIFIED_HOLDER_SHIPPING_ID,
    )

    package_ids = _parse_uuid_list(criteria.get("package_ids"))
    if package_ids:
        query = query.filter(Package.id.in_(package_ids))

    shipment_id_raw = criteria.get("shipment_id")
    if shipment_id_raw:
        query = query.filter(Package.shipment_id == uuid.UUID(str(shipment_id_raw)))

    package_statuses = criteria.get("package_statuses") or []
    if not package_statuses and criteria.get("package_status"):
        package_statuses = [criteria.get("package_status")]
    if package_statuses:
        query = query.filter(Package.status.in_(package_statuses))

    return query


def resolve_target_packages(criteria: dict) -> list[Package]:
    cleaned = _validate_target_criteria(criteria)
    return _targeted_package_query(cleaned).order_by(Package.tracking_number).all()


def preview_target_recipients(criteria: dict) -> dict:
    packages = resolve_target_packages(criteria)
    by_customer: dict[uuid.UUID, list[Package]] = defaultdict(list)
    for package in packages:
        by_customer[package.customer_id].append(package)

    customers = []
    for customer_id, customer_packages in sorted(
        by_customer.items(),
        key=lambda item: item[1][0].customer.full_name if item[1][0].customer else "",
    ):
        customer = customer_packages[0].customer
        customers.append(
            {
                "user_id": str(customer_id),
                "name": customer.full_name if customer else "Unknown",
                "email": customer.email if customer else None,
                "package_count": len(customer_packages),
                "tracking_numbers": [pkg.tracking_number for pkg in customer_packages],
            }
        )

    return {
        "package_count": len(packages),
        "customer_count": len(customers),
        "customers": customers,
    }


def _group_packages_by_customer(packages: list[Package]) -> dict[uuid.UUID, list[Package]]:
    grouped: dict[uuid.UUID, list[Package]] = defaultdict(list)
    for package in packages:
        grouped[package.customer_id].append(package)
    return grouped


def _store_target_recipients(announcement: Announcement, packages: list[Package]) -> list[User]:
    AnnouncementRecipient.query.filter_by(announcement_id=announcement.id).delete(
        synchronize_session=False
    )

    grouped = _group_packages_by_customer(packages)
    recipients: list[User] = []
    for customer_id, customer_packages in grouped.items():
        customer = customer_packages[0].customer
        if customer is None:
            customer = db.session.get(User, customer_id)
        if not customer:
            continue
        db.session.add(
            AnnouncementRecipient(
                announcement_id=announcement.id,
                user_id=customer.id,
                package_ids=[str(pkg.id) for pkg in customer_packages],
                tracking_numbers=[pkg.tracking_number for pkg in customer_packages],
            )
        )
        recipients.append(customer)
    return recipients


def _targeted_recipient_subquery(user_id: uuid.UUID):
    return db.session.query(AnnouncementRecipient.announcement_id).filter(
        AnnouncementRecipient.user_id == user_id
    )


def _targeted_visibility_filter(user: User | None):
    if user is None:
        return Announcement.target_mode != "targeted"
    return or_(
        Announcement.target_mode != "targeted",
        Announcement.id.in_(_targeted_recipient_subquery(user.id)),
    )


def _parse_dt(value, field_name: str) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as exc:
        raise ValueError(f"Invalid {field_name}") from exc


def _validate_announcement_data(
    data: dict,
    *,
    partial: bool = False,
    existing: Announcement | None = None,
) -> dict:
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

    if "target_mode" in data or not partial:
        target_mode = (data.get("target_mode") or "broadcast").strip().lower()
        if target_mode not in ANNOUNCEMENT_TARGET_MODES:
            raise ValueError("Invalid target mode")
        cleaned["target_mode"] = target_mode

    effective_target_mode = (
        cleaned.get("target_mode")
        or (existing.target_mode if existing else None)
        or "broadcast"
    )

    if cleaned.get("target_mode") == "broadcast":
        cleaned["target_criteria"] = None

    if partial and cleaned.get("target_mode") == "targeted" and "target_criteria" not in data:
        if not existing or existing.target_mode != "targeted":
            raise ValueError("Provide targeting criteria when enabling targeted mode")

    if "target_criteria" in data or (not partial and effective_target_mode == "targeted"):
        if effective_target_mode == "targeted":
            cleaned["target_criteria"] = _validate_target_criteria(data.get("target_criteria"))
        elif data.get("target_criteria") is not None:
            cleaned["target_criteria"] = None
    elif effective_target_mode == "targeted" and existing and existing.target_mode == "targeted":
        if "target_criteria" in data or any(
            key in data for key in ("target_mode", "title", "body", "audience", "display_as")
        ):
            _validate_target_criteria(existing.target_criteria)

    if effective_target_mode == "targeted":
        audience = (
            cleaned.get("audience")
            or (existing.audience if existing else None)
            or data.get("audience")
            or "customers"
        )
        if audience not in ("customers", "all"):
            raise ValueError("Targeted announcements must use the customers audience")

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
    return base.filter(User.role == "customer")


def list_admin_announcements() -> list[Announcement]:
    return Announcement.query.order_by(Announcement.created_at.desc()).all()


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
    cleaned = _validate_announcement_data(data, partial=True, existing=announcement)
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
        _targeted_visibility_filter(user),
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
            _targeted_visibility_filter(user),
        )
        .order_by(Announcement.broadcast_at.desc())
        .limit(100)
        .all()
    )

    read_ids = {
        r.announcement_id for r in AnnouncementRead.query.filter_by(user_id=user.id).all()
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

    db.session.add(AnnouncementDismissal(user_id=user.id, announcement_id=announcement_id))
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

        recipient_rows = AnnouncementRecipient.query.filter_by(
            announcement_id=announcement.id
        ).all()
        if announcement.target_mode == "targeted":
            email_targets = [
                (row.user, row.tracking_numbers or [])
                for row in recipient_rows
                if row.user
            ]
        else:
            email_targets = [(user, []) for user in _recipient_query(announcement.audience).all()]

        sent = 0
        failed = 0

        for user, tracking_numbers in email_targets:
            body_text = announcement.body
            if tracking_numbers:
                tracking_line = ", ".join(tracking_numbers)
                body_text = (
                    f"{announcement.body}\n\n"
                    f"Your affected package(s): {tracking_line}"
                )
            try:
                send_announcement_email(
                    user.email,
                    user.first_name,
                    announcement.title,
                    body_text,
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
        job.status = "completed"
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

    if announcement.target_mode == "targeted":
        packages = resolve_target_packages(announcement.target_criteria or {})
        if not packages:
            raise ValueError("No packages match the selected targeting criteria")
        _store_target_recipients(announcement, packages)

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
        if announcement.target_mode == "targeted":
            job.sent_count = AnnouncementRecipient.query.filter_by(
                announcement_id=announcement.id
            ).count()
        db.session.commit()

    return job


def latest_broadcast_job(announcement: Announcement) -> BroadcastJob | None:
    return (
        BroadcastJob.query.filter_by(announcement_id=announcement.id)
        .order_by(BroadcastJob.created_at.desc())
        .first()
    )
