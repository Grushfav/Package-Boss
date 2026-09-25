"""Tiered freight rates from frontend/Revised Rates Newest.xlsx (160 JMD = 1 USD)."""

from decimal import Decimal

JMD_PER_USD = 160
MAX_AUTO_RATE_LBS = 50
RATES_REVISION = "revised-rates-newest"
QUOTE_MESSAGE = (
    f"Packages over {MAX_AUTO_RATE_LBS} lbs require a custom quote. "
    "Please contact Package Boss Shipping & Logistics."
)

REVISED_RATE_USD_BY_LBS: dict[int, Decimal] = {
    1: Decimal("4.0625"),
    2: Decimal("6.875"),
    3: Decimal("9.375"),
    4: Decimal("11.875"),
    5: Decimal("14.6875"),
    6: Decimal("17.1875"),
    7: Decimal("19.6875"),
    8: Decimal("22.1875"),
    9: Decimal("25"),
    10: Decimal("29.0625"),
    11: Decimal("31.5625"),
    12: Decimal("34.375"),
    13: Decimal("36.875"),
    14: Decimal("39.375"),
    15: Decimal("41.875"),
    16: Decimal("44.375"),
    17: Decimal("46.875"),
    18: Decimal("49.6875"),
    19: Decimal("52.1875"),
    20: Decimal("54.6875"),
    21: Decimal("57.1875"),
    22: Decimal("60.3125"),
    23: Decimal("62.1875"),
    24: Decimal("64.6875"),
    25: Decimal("67.1875"),
    26: Decimal("70"),
    27: Decimal("72.5"),
    28: Decimal("75"),
    29: Decimal("77.5"),
    30: Decimal("90"),
    31: Decimal("92.1875"),
    32: Decimal("94.6875"),
    33: Decimal("99.0625"),
    34: Decimal("100.9375"),
    35: Decimal("104.6875"),
    36: Decimal("107.8125"),
    37: Decimal("110.9375"),
    38: Decimal("114.0625"),
    39: Decimal("117.1875"),
    40: Decimal("119.6875"),
    41: Decimal("122.8125"),
    42: Decimal("125.625"),
    43: Decimal("128.4375"),
    44: Decimal("131.875"),
    45: Decimal("134.6875"),
    46: Decimal("137.5"),
    47: Decimal("140.625"),
    48: Decimal("143.125"),
    49: Decimal("146.875"),
    50: Decimal("148.75"),
}

