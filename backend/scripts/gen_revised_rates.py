"""Generate app/data/revised_rate_table.py from frontend/Revised Rates*.xlsx."""

from __future__ import annotations

from pathlib import Path

import openpyxl

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
OUT_PATH = Path(__file__).resolve().parents[1] / "app" / "data" / "revised_rate_table.py"


def find_rate_workbook() -> Path:
    candidates = sorted(
        FRONTEND_DIR.glob("Revised Rates*.xlsx"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError(
            f"No Revised Rates*.xlsx found in {FRONTEND_DIR}. "
            "Add the spreadsheet to the frontend folder."
        )
    return candidates[0]


def main() -> None:
    path = find_rate_workbook()
    ws = openpyxl.load_workbook(path, data_only=True).active
    rows = [
        (int(r[0]), r[2])
        for r in ws.iter_rows(min_row=2, values_only=True)
        if r[0] is not None
    ]
    if not rows:
        raise ValueError(f"No rate rows found in {path}")

    max_lbs = max(lbs for lbs, _ in rows)
    rel_path = path.relative_to(FRONTEND_DIR.parent).as_posix()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f'"""Tiered freight rates from {rel_path} (160 JMD = 1 USD)."""',
        "",
        "from decimal import Decimal",
        "",
        "JMD_PER_USD = 160",
        f'MAX_AUTO_RATE_LBS = {max_lbs}',
        f'RATES_REVISION = "{path.stem.lower().replace(" ", "-")}"',
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

    OUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Source: {path}")
    print(f"Wrote {OUT_PATH} ({len(rows)} tiers, max {max_lbs} lbs)")


if __name__ == "__main__":
    main()
