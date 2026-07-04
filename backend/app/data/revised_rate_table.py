"""Tiered freight rates from frontend/Revised Rates (1).xlsx (160 JMD = 1 USD)."""

from decimal import Decimal

JMD_PER_USD = 160
MAX_AUTO_RATE_LBS = 50
RATES_REVISION = "2026-06-14-revised-rates"
QUOTE_MESSAGE = (
    f"Packages over {MAX_AUTO_RATE_LBS} lbs require a custom quote. "
    "Please contact Package Boss Shipping & Logistics."
)

REVISED_RATE_USD_BY_LBS: dict[int, Decimal] = {
    1: Decimal("4.0625"),
    2: Decimal("5.9375"),
    3: Decimal("8.125"),
    4: Decimal("9.375"),
    5: Decimal("11.5625"),
    6: Decimal("14.0625"),
    7: Decimal("16.25"),
    8: Decimal("18.4375"),
    9: Decimal("20"),
    10: Decimal("22.1875"),
    11: Decimal("24.6875"),
    12: Decimal("27.1875"),
    13: Decimal("29.375"),
    14: Decimal("31.875"),
    15: Decimal("34.0625"),
    16: Decimal("35.9375"),
    17: Decimal("38.125"),
    18: Decimal("40.625"),
    19: Decimal("43.125"),
    20: Decimal("44.375"),
    21: Decimal("45.9375"),
    22: Decimal("47.8125"),
    23: Decimal("49.6875"),
    24: Decimal("51.5625"),
    25: Decimal("53.4375"),
    26: Decimal("57.8125"),
    27: Decimal("60.3125"),
    28: Decimal("62.8125"),
    29: Decimal("65"),
    30: Decimal("67.1875"),
    31: Decimal("68.75"),
    32: Decimal("70.625"),
    33: Decimal("72.5"),
    34: Decimal("74.375"),
    35: Decimal("76.25"),
    36: Decimal("78.125"),
    37: Decimal("80.3125"),
    38: Decimal("82.1875"),
    39: Decimal("84.0625"),
    40: Decimal("85.9375"),
    41: Decimal("87.8125"),
    42: Decimal("90.3125"),
    43: Decimal("92.5"),
    44: Decimal("95"),
    45: Decimal("97.5"),
    46: Decimal("99.375"),
    47: Decimal("101.25"),
    48: Decimal("103.125"),
    49: Decimal("105"),
    50: Decimal("106.875"),
}

