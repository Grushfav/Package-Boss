from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

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


def jamaica_day_start_utc(value: datetime | None = None) -> datetime:
    """Start of the Jamaica calendar day containing value, as naive UTC for DB filters."""
    if value is None:
        value = datetime.utcnow()
    return jamaica_date_start_utc(jamaica_local_date(value))


def jamaica_date_start_utc(calendar_date: date) -> datetime:
    """Naive UTC instant of midnight Jamaica on calendar_date."""
    local = datetime(
        calendar_date.year,
        calendar_date.month,
        calendar_date.day,
        tzinfo=JAMAICA_TZ,
    )
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def jamaica_date_end_utc(calendar_date: date) -> datetime:
    """Naive UTC instant of end-of-day Jamaica on calendar_date."""
    local = datetime(
        calendar_date.year,
        calendar_date.month,
        calendar_date.day,
        23,
        59,
        59,
        999999,
        tzinfo=JAMAICA_TZ,
    )
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def jamaica_local_date(value: datetime) -> date:
    """Calendar date in Jamaica for a stored UTC datetime."""
    return _as_utc(value).astimezone(JAMAICA_TZ).date()


def format_jamaica_datetime(value: datetime | None, *, date_only: bool = False) -> str:
    """Format naive UTC (or aware) datetimes for Jamaica display in HTML/PDF."""
    if value is None:
        return "—"
    local = _as_utc(value).astimezone(JAMAICA_TZ)
    if date_only:
        return local.strftime("%B %d, %Y")
    return local.strftime("%b %d, %Y %I:%M %p")

