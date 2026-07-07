"""Staff package lookup by Package Boss ID or carrier tracking (partial match)."""

from __future__ import annotations

from sqlalchemy import or_

from app.models.package import Package
from app.services.pre_alert_service import tracking_core

MIN_PACKAGE_SEARCH_QUERY_LEN = 5
PREFILTER_LIMIT = 250
DEFAULT_RESULT_LIMIT = 20

PB_EXACT_SCORE = 20_000
PB_PREFIX_BASE = 15_000
CARRIER_EXACT_BASE = 10_000


def _carrier_search_score(query_core: str, carrier: str | None) -> int:
    carrier_core = tracking_core(carrier)
    if not query_core or not carrier_core:
        return 0

    if query_core == carrier_core:
        return CARRIER_EXACT_BASE + len(query_core)

    short, long = (
        (query_core, carrier_core)
        if len(query_core) <= len(carrier_core)
        else (carrier_core, query_core)
    )
    if len(short) < MIN_PACKAGE_SEARCH_QUERY_LEN:
        return 0
    if short not in long:
        return 0

    return len(short)


def _match_type(score: int, field: str) -> str:
    if field == "tracking_number":
        return "exact" if score >= PB_EXACT_SCORE else "prefix"
    if score >= CARRIER_EXACT_BASE:
        return "exact"
    return "partial"


def search_packages(query: str, *, limit: int = DEFAULT_RESULT_LIMIT) -> tuple[list[dict], bool]:
    q = (query or "").strip()
    if len(q) < MIN_PACKAGE_SEARCH_QUERY_LEN:
        return [], False

    limit = max(1, min(limit, 30))
    q_upper = q.upper()
    q_core = tracking_core(q)

    scored: dict[str, tuple[Package, int, str, str]] = {}
    truncated = False

    def add_match(pkg: Package, score: int, field: str, matched_value: str) -> None:
        pid = str(pkg.id)
        existing = scored.get(pid)
        if existing is None or score > existing[1]:
            scored[pid] = (pkg, score, field, matched_value)

    # Exact Package Boss tracking number
    exact_pkg = Package.query.filter_by(tracking_number=q_upper).first()
    if exact_pkg:
        add_match(exact_pkg, PB_EXACT_SCORE + len(q_upper), "tracking_number", exact_pkg.tracking_number)
        return [_format_match(*scored[str(exact_pkg.id)])], False

    # Prefix on PB-… (e.g. PB-2026-000)
    if q_upper.startswith("PB"):
        pb_rows = (
            Package.query.filter(Package.tracking_number.ilike(f"{q_upper}%"))
            .order_by(Package.received_at.desc(), Package.tracking_number.desc())
            .limit(PREFILTER_LIMIT + 1)
            .all()
        )
        if len(pb_rows) > PREFILTER_LIMIT:
            truncated = True
            pb_rows = pb_rows[:PREFILTER_LIMIT]
        for pkg in pb_rows:
            add_match(
                pkg,
                PB_PREFIX_BASE + len(q_upper),
                "tracking_number",
                pkg.tracking_number,
            )

    # Carrier tracking — ILIKE prefilter, then score with normalized core
    carrier_filters = [Package.carrier_tracking.isnot(None)]
    carrier_clauses = []
    if q_core and len(q_core) >= MIN_PACKAGE_SEARCH_QUERY_LEN:
        carrier_clauses.append(Package.carrier_tracking.ilike(f"%{q_core}%"))
    if q != q_core:
        carrier_clauses.append(Package.carrier_tracking.ilike(f"%{q}%"))
    if carrier_clauses:
        carrier_rows = (
            Package.query.filter(*carrier_filters)
            .filter(or_(*carrier_clauses))
            .order_by(Package.received_at.desc(), Package.tracking_number.desc())
            .limit(PREFILTER_LIMIT + 1)
            .all()
        )
        if len(carrier_rows) > PREFILTER_LIMIT:
            truncated = True
            carrier_rows = carrier_rows[:PREFILTER_LIMIT]
        for pkg in carrier_rows:
            score = _carrier_search_score(q_core or q_upper, pkg.carrier_tracking)
            if score > 0:
                add_match(
                    pkg,
                    score,
                    "carrier_tracking",
                    pkg.carrier_tracking or "",
                )

    ranked = sorted(
        scored.values(),
        key=lambda item: (-item[1], -item[0].received_at.timestamp(), item[0].tracking_number),
    )
    return [_format_match(pkg, score, field, matched) for pkg, score, field, matched in ranked[:limit]], truncated


def _format_match(pkg: Package, score: int, field: str, matched_value: str) -> dict:
    from app.services.package_service import warehouse_package_to_dict

    return {
        "package": warehouse_package_to_dict(pkg),
        "match_score": score,
        "match_field": field,
        "match_type": _match_type(score, field),
        "matched_value": matched_value,
    }
