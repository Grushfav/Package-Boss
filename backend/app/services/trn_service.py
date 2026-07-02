import re

TRN_PATTERN = re.compile(r"^\d{9}$")


def normalize_trn(value: str | None) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if not TRN_PATTERN.match(digits):
        raise ValueError("TRN must be 9 digits")
    return digits


def format_trn(trn: str) -> str:
    n = normalize_trn(trn)
    if not n:
        raise ValueError("TRN must be 9 digits")
    return f"{n[:3]}-{n[3:6]}-{n[6:]}"
