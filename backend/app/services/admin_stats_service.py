from datetime import datetime, timedelta

from sqlalchemy import case, func

from app.constants import (
    BANK_TRANSFER_PROOF_OPEN_STATUSES,
    DELIVERY_REQUEST_OPEN_STATUSES,
    STATUS_LABELS,
    UNIDENTIFIED_HOLDER_SHIPPING_ID,
)
from app.extensions import db
from app.models.bank_transfer_proof import BankTransferProof
from app.models.delivery_request import DeliveryRequest
from app.models.package import Package
from app.models.pre_alert import PreAlert
from app.models.user import User
from app.utils.datetime_format import jamaica_day_start_utc, jamaica_local_date


def _utc_now() -> datetime:
    return datetime.utcnow()


def _today_start() -> datetime:
    return jamaica_day_start_utc(_utc_now())


def _customer_signups_query():
    return User.query.filter(
        User.role == "customer",
        User.shipping_id != UNIDENTIFIED_HOLDER_SHIPPING_ID,
    )


def get_customer_signup_stats() -> dict:
    today_start = _today_start()
    week_start = today_start - timedelta(days=7)

    base = _customer_signups_query()
    return {
        "customers_today": base.filter(User.created_at >= today_start).count(),
        "customers_7d": base.filter(User.created_at >= week_start).count(),
        "customers_total": base.count(),
    }


def get_delivery_request_submission_stats() -> dict:
    today_start = _today_start()
    week_start = today_start - timedelta(days=7)

    base = DeliveryRequest.query
    return {
        "delivery_requests_active": base.filter(
            DeliveryRequest.status.in_(DELIVERY_REQUEST_OPEN_STATUSES)
        ).count(),
        "delivery_requests_today": base.filter(DeliveryRequest.requested_at >= today_start).count(),
        "delivery_requests_7d": base.filter(DeliveryRequest.requested_at >= week_start).count(),
        "delivery_requests_total": base.count(),
    }


def get_bank_transfer_proof_submission_stats() -> dict:
    today_start = _today_start()
    week_start = today_start - timedelta(days=7)

    base = BankTransferProof.query
    return {
        "bank_transfer_proofs_active": base.filter(
            BankTransferProof.status.in_(BANK_TRANSFER_PROOF_OPEN_STATUSES)
        ).count(),
        "bank_transfer_proofs_today": base.filter(BankTransferProof.submitted_at >= today_start).count(),
        "bank_transfer_proofs_7d": base.filter(BankTransferProof.submitted_at >= week_start).count(),
        "bank_transfer_proofs_total": base.count(),
    }


def get_overview() -> dict:
    today_start = _today_start()
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    packages_today = Package.query.filter(Package.received_at >= today_start).count()
    packages_7d = Package.query.filter(Package.received_at >= week_start).count()
    packages_30d = Package.query.filter(Package.received_at >= month_start).count()
    packages_total = Package.query.count()
    pending_pre_alerts = PreAlert.query.filter_by(status="pending").count()
    in_transit = Package.query.filter_by(status="in_transit").count()

    customer_stats = get_customer_signup_stats()
    delivery_request_stats = get_delivery_request_submission_stats()
    bank_transfer_proof_stats = get_bank_transfer_proof_submission_stats()

    revenue_30d = (
        db.session.query(
            func.coalesce(
                func.sum(
                    case(
                        (
                            Package.billing_status.in_(["ready", "paid"]),
                            Package.total_due_jmd,
                        ),
                        else_=Package.estimated_freight_jmd,
                    )
                ),
                0,
            )
        )
        .filter(Package.received_at >= month_start)
        .scalar()
    )

    return {
        "packages_today": packages_today,
        "packages_7d": packages_7d,
        "packages_30d": packages_30d,
        "packages_total": packages_total,
        "pending_pre_alerts": pending_pre_alerts,
        "in_transit": in_transit,
        **customer_stats,
        **delivery_request_stats,
        **bank_transfer_proof_stats,
        "revenue_30d_jmd": float(revenue_30d or 0),
        "revenue_30d_usd": float(revenue_30d or 0),
    }


def _jamaica_day_series(days: int) -> list[str]:
    end_date = jamaica_local_date(_utc_now())
    start_date = end_date - timedelta(days=days - 1)
    series: list[str] = []
    current = start_date
    while current <= end_date:
        series.append(str(current))
        current += timedelta(days=1)
    return series


def get_packages_timeline(days: int = 30) -> list[dict]:
    today_start = _today_start()
    range_start = today_start - timedelta(days=days - 1)

    received_at_values = (
        db.session.query(Package.received_at)
        .filter(Package.received_at >= range_start)
        .all()
    )

    counts_by_day: dict[str, int] = {}
    for (received_at,) in received_at_values:
        if received_at is None:
            continue
        key = str(jamaica_local_date(received_at))
        counts_by_day[key] = counts_by_day.get(key, 0) + 1

    return [
        {"date": day, "count": counts_by_day.get(day, 0)}
        for day in _jamaica_day_series(days)
    ]


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
    today_start = _today_start()
    range_start = today_start - timedelta(days=days - 1)

    alert_rows = (
        db.session.query(PreAlert.created_at)
        .filter(PreAlert.created_at >= range_start)
        .all()
    )
    package_rows = (
        db.session.query(Package.received_at)
        .filter(Package.received_at >= range_start)
        .all()
    )

    alerts_by_day: dict[str, int] = {}
    for (created_at,) in alert_rows:
        if created_at is None:
            continue
        key = str(jamaica_local_date(created_at))
        alerts_by_day[key] = alerts_by_day.get(key, 0) + 1

    receives_by_day: dict[str, int] = {}
    for (received_at,) in package_rows:
        if received_at is None:
            continue
        key = str(jamaica_local_date(received_at))
        receives_by_day[key] = receives_by_day.get(key, 0) + 1

    return [
        {
            "date": day,
            "pre_alerts": alerts_by_day.get(day, 0),
            "received": receives_by_day.get(day, 0),
        }
        for day in _jamaica_day_series(days)
    ]
