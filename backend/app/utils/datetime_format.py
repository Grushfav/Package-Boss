from __future__ import annotations

from datetime import datetime, timedelta, timezone

# Jamaica uses UTC-5 year-round (no daylight saving).
JAMAICA_TZ = timezone(timedelta(hours=-5))


def utc_isoformat(value: datetime | None) -> str | None:
    """Serialize naive UTC datetimes for APIs (always append Z for clients)."""
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value.isoformat() + "Z"


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def format_jamaica_datetime(value: datetime | None, *, date_only: bool = False) -> str:
    """Format naive UTC (or aware) datetimes for Jamaica display in HTML/PDF."""
    if value is None:
        return "—"
    local = _as_utc(value).astimezone(JAMAICA_TZ)
    if date_only:
        return local.strftime("%B %d, %Y")
    return local.strftime("%b %d, %Y %I:%M %p")

