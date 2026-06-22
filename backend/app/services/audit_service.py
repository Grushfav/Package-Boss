from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.user import User

# Clerk/admin package actions
ACTION_PACKAGE_RECEIVED = "package.received"
ACTION_PACKAGE_RECEIVED_UNIDENTIFIED = "package.received_unidentified"
ACTION_PACKAGE_ASSIGNED = "package.assigned"
ACTION_PACKAGE_STATUS_UPDATED = "package.status_updated"
ACTION_PACKAGE_INVOICE_REQUESTED = "package.invoice_requested"
ACTION_PACKAGE_BILLING_UPDATED = "package.billing_updated"


def log_package_action(
    actor: User | None,
    action: str,
    package_id: str,
    summary: str,
    metadata: dict | None = None,
) -> AuditLog:
    if actor and actor.role not in ("clerk", "admin"):
        raise ValueError("Only clerk or admin actions are logged here")

    entry = AuditLog(
        actor_id=actor.id if actor else None,
        actor_name=actor.full_name if actor else "System",
        actor_role=actor.role if actor else "system",
        action=action,
        entity_type="package",
        entity_id=str(package_id),
        summary=summary,
        metadata_json=metadata or {},
    )
    db.session.add(entry)
    db.session.commit()
    return entry
