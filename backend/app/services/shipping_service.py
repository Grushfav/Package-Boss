from decimal import Decimal, ROUND_CEILING

from app.data.revised_rate_table import (
    JMD_PER_USD,
    MAX_AUTO_RATE_LBS,
    QUOTE_MESSAGE,
    REVISED_RATE_USD_BY_LBS,
)

__all__ = [
    "JMD_PER_USD",
    "MAX_AUTO_RATE_LBS",
    "QUOTE_MESSAGE",
    "billable_weight_lbs",
    "usd_for_billable_lbs",
    "jmd_for_usd",
    "tier_label_for_billable",
    "build_rate_table",
    "calculate_shipping_cost",
]


def billable_weight_lbs(actual_weight: Decimal | float) -> int:
    weight = Decimal(str(actual_weight))
    if weight <= 0:
        raise ValueError("Weight must be positive")
    return int(weight.to_integral_value(rounding=ROUND_CEILING))


def usd_for_billable_lbs(billable: int) -> Decimal:
    if billable < 1:
        raise ValueError("Weight must be positive")
    if billable > MAX_AUTO_RATE_LBS:
        raise ValueError(QUOTE_MESSAGE)
    return REVISED_RATE_USD_BY_LBS[billable]


def jmd_for_usd(usd: Decimal) -> int:
    return int((usd * JMD_PER_USD).quantize(Decimal("1")))


def tier_label_for_billable(billable: int) -> str:
    if billable == 1:
        return "1 lb"
    return f"{billable} lbs"


def build_rate_table() -> list[dict]:
    rows = []
    for lbs in range(1, MAX_AUTO_RATE_LBS + 1):
        usd = usd_for_billable_lbs(lbs)
        jmd = jmd_for_usd(usd)
        rows.append(
            {
                "label": tier_label_for_billable(lbs),
                "weight_lbs": lbs,
                "cost_usd": float(usd),
                "cost_jmd": jmd,
                "rate_display_usd": f"${float(usd):.2f}",
                "rate_display_jmd": f"${jmd:,}",
            }
        )
    return rows


def calculate_shipping_cost(actual_weight_lbs: Decimal | float) -> dict:
    billable = billable_weight_lbs(actual_weight_lbs)
    cost = usd_for_billable_lbs(billable).quantize(Decimal("0.01"))
    cost_jmd = jmd_for_usd(cost)

    return {
        "actual_weight_lbs": float(actual_weight_lbs),
        "billable_weight_lbs": billable,
        "cost_usd": float(cost),
        "cost_jmd": cost_jmd,
        "tier_label": tier_label_for_billable(billable),
        "route": "Fort Lauderdale → Kingston",
        "currency": "JMD",
        "jmd_per_usd": JMD_PER_USD,
        "rounding_note": "Weights are rounded up to the nearest whole pound.",
        "quote_note": f"Packages over {MAX_AUTO_RATE_LBS} lbs require a custom quote.",
    }
