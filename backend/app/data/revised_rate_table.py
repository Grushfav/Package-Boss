"""Tiered freight rates from frontend/Revised Rates.xlsx (160 JMD = 1 USD)."""

from decimal import Decimal

JMD_PER_USD = 160
MAX_AUTO_RATE_LBS = 50
QUOTE_MESSAGE = (
    f"Packages over {MAX_AUTO_RATE_LBS} lbs require a custom quote. "
    "Please contact Package Boss Shipping & Logistics."
)

REVISED_RATE_USD_BY_LBS: dict[int, Decimal] = {
    1: Decimal("4"),
    2: Decimal("5.875"),
    3: Decimal("8.0625"),
    4: Decimal("9.3125"),
    5: Decimal("11.5"),
    6: Decimal("14"),
    7: Decimal("16.1875"),
    8: Decimal("18.375"),
    9: Decimal("19.9375"),
    10: Decimal("22.125"),
    11: Decimal("24.625"),
    12: Decimal("27.125"),
    13: Decimal("29.3125"),
    14: Decimal("31.8125"),
    15: Decimal("34"),
    16: Decimal("35.875"),
    17: Decimal("38.0625"),
    18: Decimal("40.5625"),
    19: Decimal("43.0625"),
    20: Decimal("44.3125"),
    21: Decimal("45.875"),
    22: Decimal("47.75"),
    23: Decimal("49.625"),
    24: Decimal("51.5"),
    25: Decimal("53.375"),
    26: Decimal("57.75"),
    27: Decimal("60.25"),
    28: Decimal("62.75"),
    29: Decimal("64.9375"),
    30: Decimal("67.125"),
    31: Decimal("68.6875"),
    32: Decimal("70.5625"),
    33: Decimal("72.4375"),
    34: Decimal("74.3125"),
    35: Decimal("76.1875"),
    36: Decimal("78.0625"),
    37: Decimal("80.25"),
    38: Decimal("82.125"),
    39: Decimal("84"),
    40: Decimal("85.875"),
    41: Decimal("87.75"),
    42: Decimal("90.25"),
    43: Decimal("92.4375"),
    44: Decimal("94.9375"),
    45: Decimal("97.4375"),
    46: Decimal("99.3125"),
    47: Decimal("101.1875"),
    48: Decimal("103.0625"),
    49: Decimal("104.9375"),
    50: Decimal("106.8125"),
}

