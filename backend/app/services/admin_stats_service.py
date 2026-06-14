from datetime import datetime, timedelta

from sqlalchemy import func

from app.constants import STATUS_LABELS
from app.extensions import db
from app.models.package import Package
from app.models.pre_alert import PreAlert


def _utc_now() -> datetime:
    return datetime.utcnow()


def _start_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def get_overview() -> dict:
    now = _utc_now()
    today_start = _start_of_day(now)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    packages_today = Package.query.filter(Package.received_at >= today_start).count()
    packages_7d = Package.query.filter(Package.received_at >= week_start).count()
    packages_30d = Package.query.filter(Package.received_at >= month_start).count()
    pending_pre_alerts = PreAlert.query.filter_by(status="pending").count()
    in_transit = Package.query.filter_by(status="in_transit").count()

    revenue_30d = (
        db.session.query(func.coalesce(func.sum(Package.shipping_cost_usd), 0))
        .filter(Package.received_at >= month_start)
        .scalar()
    )

    return {
        "packages_today": packages_today,
        "packages_7d": packages_7d,
        "packages_30d": packages_30d,
        "pending_pre_alerts": pending_pre_alerts,
        "in_transit": in_transit,
        "revenue_30d_usd": float(revenue_30d or 0),
    }


def get_packages_timeline(days: int = 30) -> list[dict]:
    now = _utc_now()
    start = _start_of_day(now) - timedelta(days=days - 1)

    rows = (
        db.session.query(
            func.date(Package.received_at).label("day"),
            func.count(Package.id).label("count"),
        )
        .filter(Package.received_at >= start)
        .group_by(func.date(Package.received_at))
        .order_by(func.date(Package.received_at))
        .all()
    )

    counts_by_day = {str(row.day): row.count for row in rows}
    timeline = []
    for i in range(days):
        day = (start + timedelta(days=i)).date()
        key = str(day)
        timeline.append({"date": key, "count": counts_by_day.get(key, 0)})
    return timeline


def get_packages_by_status() -> list[dict]:
    rows = (
        db.session.query(Package.status, func.count(Package.id))
        .group_by(Package.status)
        .all()
    )
    return [
        {
            "status": status,
            "label": STATUS_LABELS.get(status, status),
            "count": count,
        }
        for status, count in rows
    ]


def get_weight_distribution() -> list[dict]:
    packages = Package.query.filter(Package.billable_weight_lbs.isnot(None)).all()
    buckets = [
        {"label": "1–5 lbs", "min": 1, "max": 5, "count": 0},
        {"label": "6–10 lbs", "min": 6, "max": 10, "count": 0},
        {"label": "11–20 lbs", "min": 11, "max": 20, "count": 0},
        {"label": "21–50 lbs", "min": 21, "max": 50, "count": 0},
        {"label": "51+ lbs", "min": 51, "max": 9999, "count": 0},
    ]
    for pkg in packages:
        w = pkg.billable_weight_lbs or 0
        for bucket in buckets:
            if bucket["min"] <= w <= bucket["max"]:
                bucket["count"] += 1
                break
    return [{"label": b["label"], "count": b["count"]} for b in buckets]


def get_pre_alerts_vs_receives(days: int = 30) -> list[dict]:
    now = _utc_now()
    start = _start_of_day(now) - timedelta(days=days - 1)

    alert_rows = (
        db.session.query(
            func.date(PreAlert.created_at).label("day"),
            func.count(PreAlert.id).label("count"),
        )
        .filter(PreAlert.created_at >= start)
        .group_by(func.date(PreAlert.created_at))
        .all()
    )
    package_rows = (
        db.session.query(
            func.date(Package.received_at).label("day"),
            func.count(Package.id).label("count"),
        )
        .filter(Package.received_at >= start)
        .group_by(func.date(Package.received_at))
        .all()
    )

    alerts_by_day = {str(r.day): r.count for r in alert_rows}
    receives_by_day = {str(r.day): r.count for r in package_rows}

    series = []
    for i in range(days):
        day = (start + timedelta(days=i)).date()
        key = str(day)
        series.append(
            {
                "date": key,
                "pre_alerts": alerts_by_day.get(key, 0),
                "received": receives_by_day.get(key, 0),
            }
        )
    return series
