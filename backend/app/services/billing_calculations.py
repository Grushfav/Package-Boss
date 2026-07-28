"""JMD billing calculations and ready-for-pickup bill publishing."""

from decimal import Decimal

from app.data.revised_rate_table import MAX_AUTO_RATE_LBS, QUOTE_MESSAGE
from app.models.package import Package
from app.services.shipping_service import billable_weight_lbs, calculate_shipping_cost


def compute_total_due(
    freight: Decimal | None,
    duties: Decimal | None,
    handling: Decimal | None,
    other: Decimal | None,
) -> Decimal | None:
    parts = [freight, duties, handling, other]
    if all(p is None for p in parts):
        return None
    total = Decimal("0")
    for part in parts:
        if part is not None:
            total += part
    return total.quantize(Decimal("0.01"))


def _decimal(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value)).quantize(Decimal("0.01"))


def ensure_freight_jmd(package: Package) -> None:
    """Set shipping charge from billable weight when releasing from customs."""
    if package.billable_weight_lbs is None and package.actual_weight_lbs is None:
        raise ValueError(f"{package.tracking_number} has no weight on file")

    if package.estimated_freight_jmd is not None and package.estimated_freight_jmd > 0:
        return

    weight = package.actual_weight_lbs or package.billable_weight_lbs
    billable = billable_weight_lbs(weight)
    if billable > MAX_AUTO_RATE_LBS:
        raise ValueError(f"{package.tracking_number}: {QUOTE_MESSAGE}")

    quote = calculate_shipping_cost(weight)
    package.estimated_freight_jmd = _decimal(quote["cost_jmd"])
    package.rate_tier_label = quote["tier_label"]
    if package.billable_weight_lbs is None:
        package.billable_weight_lbs = quote["billable_weight_lbs"]


def publish_ready_for_pickup_bill(
    package: Package,
    *,
    estimated_freight_jmd: float | None = None,
    duties_jmd: float | None = None,
    handling_jmd: float | None = None,
    other_fees_jmd: float | None = None,
) -> None:
    if estimated_freight_jmd is not None:
        package.estimated_freight_jmd = _decimal(estimated_freight_jmd)
    ensure_freight_jmd(package)

    if duties_jmd is not None:
        package.duties_jmd = _decimal(duties_jmd)
    if handling_jmd is not None:
        package.handling_jmd = _decimal(handling_jmd)
    if other_fees_jmd is not None:
        package.other_fees_jmd = _decimal(other_fees_jmd)

    package.total_due_jmd = compute_total_due(
        package.estimated_freight_jmd,
        package.duties_jmd,
        package.handling_jmd,
        package.other_fees_jmd,
    )
    if package.total_due_jmd is None or package.total_due_jmd <= 0:
        raise ValueError(f"Could not calculate bill for {package.tracking_number}")
    package.billing_status = "ready"
