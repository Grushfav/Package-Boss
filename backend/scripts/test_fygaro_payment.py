"""Generate a test Fygaro payment link using JWT integration."""

from __future__ import annotations

import argparse
import importlib.util
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

_service_path = ROOT / "backend" / "app" / "services" / "fygaro_service.py"
_spec = importlib.util.spec_from_file_location("fygaro_service", _service_path)
_module = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_module)
sign_fygaro_jwt = _module.sign_fygaro_jwt
build_prefill_url = _module.build_prefill_url


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Fygaro test payment link")
    parser.add_argument("--amount", default="100.00", help="Payment amount (default: 100.00)")
    parser.add_argument("--currency", default=None, help="ISO currency code (default: FYGARO_CURRENCY or JMD)")
    parser.add_argument(
        "--reference",
        default="PB-TEST-001",
        help="Your custom_reference for tracking (default: PB-TEST-001)",
    )
    parser.add_argument(
        "--prefill",
        action="store_true",
        help="Use Option 1 query params instead of JWT (only works if button allows it)",
    )
    args = parser.parse_args()

    api_key = (os.environ.get("FYGARO_API_KEY") or "").strip()
    secret_key = (os.environ.get("FYGARO_SECRET_KEY") or "").strip()
    button_url = (os.environ.get("FYGARO_PAYMENT_BUTTON_URL") or "").strip()
    currency = (args.currency or os.environ.get("FYGARO_CURRENCY") or "JMD").upper()

    print("Fygaro test payment link generator")
    print(f"  API key configured: {'yes' if api_key else 'no'}")
    print(f"  Secret configured: {'yes' if secret_key else 'no'}")
    print(f"  Button URL configured: {'yes' if button_url else 'no'}")
    print(f"  Amount: {args.amount} {currency}")
    print(f"  custom_reference: {args.reference}")
    print()

    if not button_url:
        print(
            "Set FYGARO_PAYMENT_BUTTON_URL in .env to your dynamic payment button URL "
            "from Fygaro (Payment Links > your button > copy link)."
        )
        sys.exit(1)

    if args.prefill:
        payment_url = build_prefill_url(
            button_url=button_url,
            amount=args.amount,
            client_reference=args.reference,
        )
        print("Option 1 pre-fill URL (customer can edit amount):")
        print(payment_url)
        return

    if not api_key or not secret_key:
        print("Missing FYGARO_API_KEY or FYGARO_SECRET_KEY in .env")
        sys.exit(1)

    jwt_token = sign_fygaro_jwt(
        amount=args.amount,
        currency=currency,
        custom_reference=args.reference,
        api_key=api_key,
        secret_key=secret_key,
    )
    print("Option 2 JWT (first 80 chars):")
    print(jwt_token[:80] + ("..." if len(jwt_token) > 80 else ""))
    print()

    separator = "&" if "?" in button_url else "?"
    payment_url = f"{button_url}{separator}jwt={jwt_token}"
    print("Open this URL to test checkout:")
    print(payment_url)


if __name__ == "__main__":
    main()
