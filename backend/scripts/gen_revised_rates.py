import openpyxl
from pathlib import Path

path = Path(__file__).resolve().parents[2] / "frontend" / "Revised Rates.xlsx"
ws = openpyxl.load_workbook(path, data_only=True).active
rows = [(int(r[0]), r[2]) for r in ws.iter_rows(min_row=2, values_only=True) if r[0]]
out = Path(__file__).resolve().parents[1] / "app" / "data" / "revised_rate_table.py"
out.parent.mkdir(parents=True, exist_ok=True)
lines = [
    '"""Tiered freight rates from frontend/Revised Rates.xlsx (160 JMD = 1 USD)."""',
    "",
    "from decimal import Decimal",
    "",
    "JMD_PER_USD = 160",
    "MAX_AUTO_RATE_LBS = 50",
    "QUOTE_MESSAGE = (",
    '    f"Packages over {MAX_AUTO_RATE_LBS} lbs require a custom quote. "',
    '    "Please contact Package Boss Shipping & Logistics."',
    ")",
    "",
    "REVISED_RATE_USD_BY_LBS: dict[int, Decimal] = {",
]
for lbs, usd in rows:
    lines.append(f'    {lbs}: Decimal("{usd}"),')
lines.append("}")
lines.append("")
out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {out} ({len(rows)} tiers)")
