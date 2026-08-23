from __future__ import annotations

from datetime import datetime, timezone


def utc_isoformat(value: datetime | None) -> str | None:
    """Serialize naive UTC datetimes for APIs (always append Z for clients)."""
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value.isoformat() + "Z"
