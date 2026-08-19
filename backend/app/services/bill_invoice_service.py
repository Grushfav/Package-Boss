"""Printable bill invoice HTML for clerk/customer records."""

from __future__ import annotations

import base64
import html
from datetime import datetime
from pathlib import Path

from app.constants import PAYMENT_METHOD_LABELS
from app.models.package import Package
from app.models.payment import PaymentCheckout
from app.models.user import User

_LOGO_ASSET_PATH = Path(__file__).resolve().parent.parent / "assets" / "email-logo.png"


def _esc(value: str | None) -> str:
    return html.escape(value or "", quote=True)


def _invoice_logo_src() -> str | None:
    """Prefer a public HTTPS logo URL (email clients block data: URIs). Fall back to embedded PNG."""
    try:
        from flask import current_app

        configured = (current_app.config.get("EMAIL_LOGO_URL") or "").strip()
        if configured:
            return configured

        frontend = (current_app.config.get("FRONTEND_URL") or "").strip().rstrip("/")
        if frontend:
            return f"{frontend}/email-logo.png"
    except RuntimeError:
        pass

    if not _LOGO_ASSET_PATH.is_file():
        return None
    encoded = base64.b64encode(_LOGO_ASSET_PATH.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _invoice_brand_block() -> str:
    logo_src = _invoice_logo_src()
    if logo_src:
        return (
            f'<img src="{logo_src}" alt="Package Boss" '
            'style="display:block;height:72px;width:72px;object-fit:contain;" />'
        )
    return (
        '<p style="margin:0;font-size:22px;font-weight:800;color:#22c55e;'
        'letter-spacing:0.04em;">PACKAGE BOSS</p>'
    )


def _invoice_brand_header_left() -> str:
    return f"""
      <div>
        {_invoice_brand_block()}
        <p style="margin:8px 0 0;font-size:14px;font-weight:700;color:#0f172a;">Package Boss Shipping &amp; Logistics</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Fort Lauderdale → Kingston</p>
      </div>"""


def _money_jmd(value) -> str:
    if value is None:
        return "—"
    amount = float(value)
    if amount == int(amount):
        return f"J${int(amount):,}"
    return f"J${amount:,.2f}"


def _package_line_items(package: Package) -> list[tuple[str, float]]:
    items: list[tuple[str, float]] = []
    if package.estimated_freight_jmd is not None:
        items.append(("Shipping", float(package.estimated_freight_jmd)))
    if package.duties_jmd is not None:
        items.append(("Customs duties", float(package.duties_jmd)))
    if package.handling_jmd is not None:
        items.append(("Handling", float(package.handling_jmd)))
    if package.other_fees_jmd is not None:
        items.append(("Other fees", float(package.other_fees_jmd)))
    return items


def render_checkout_invoice_html(
    checkout: PaymentCheckout,
    customer: User,
    packages: list[Package],
) -> str:
    issued_at = checkout.recorded_at or datetime.utcnow()
    status_label = "PAID"

    package_blocks = ""
    grand_total = float(checkout.total_jmd)

    for package in packages:
        item = next((i for i in checkout.items if str(i.package_id) == str(package.id)), None)
        pkg_total = float(item.amount_jmd) if item else float(package.total_due_jmd or 0)
        rows_html = ""
        for label, amount in _package_line_items(package):
            rows_html += f"""
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">{_esc(label)}</td>
              <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">{_esc(_money_jmd(amount))}</td>
            </tr>"""

        package_blocks += f"""
        <div style="margin-top:20px;padding:16px;border:1px solid #e2e8f0;border-radius:8px;">
          <p style="margin:0 0 8px;font-family:monospace;font-weight:700;color:#22c55e;">{_esc(package.tracking_number)}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#64748b;">
            {_esc(package.carrier_tracking or "No carrier tracking")} ·
            {_esc(str(package.billable_weight_lbs) + " lbs" if package.billable_weight_lbs else "—")}
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tbody>{rows_html}</tbody>
            <tfoot>
              <tr>
                <td style="padding:8px 0 0;font-weight:700;">Package total</td>
                <td style="padding:8px 0 0;text-align:right;font-weight:700;">{_esc(_money_jmd(pkg_total))}</td>
              </tr>
            </tfoot>
          </table>
        </div>"""

    delivery_fee_block = ""
    if checkout.delivery_fee_jmd is not None and float(checkout.delivery_fee_jmd) > 0:
        delivery_fee_block = f"""
    <div style="margin-top:16px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:14px;font-weight:600;color:#64748b;">Delivery fee (Kingston &amp; Portmore)</span>
      <span style="font-size:15px;font-weight:700;">{_esc(_money_jmd(checkout.delivery_fee_jmd))}</span>
    </div>"""

    processing_fee_block = ""
    if checkout.processing_fee_jmd is not None and float(checkout.processing_fee_jmd) > 0:
        processing_fee_block = f"""
    <div style="margin-top:16px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:14px;font-weight:600;color:#64748b;">Processing fee</span>
      <span style="font-size:15px;font-weight:700;">{_esc(_money_jmd(checkout.processing_fee_jmd))}</span>
    </div>"""

    payment_block = f"""
    <div style="margin-top:24px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;color:#166534;">
        Payment received
      </p>
      <p style="margin:0;font-size:14px;color:#14532d;">
        {_esc(PAYMENT_METHOD_LABELS.get(checkout.method, checkout.method))}
        {f" · Ref {_esc(checkout.reference)}" if checkout.reference else ""}
        · {_esc(issued_at.strftime("%b %d, %Y %I:%M %p"))} UTC
      </p>
    </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice {_esc(checkout.invoice_number)}</title>
  <style>
    @media print {{
      body {{ margin: 0; }}
      .no-print {{ display: none !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
      {_invoice_brand_header_left()}
      <div style="text-align:right;">
        <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">Invoice</p>
        <p style="margin:4px 0 0;font-family:monospace;font-size:16px;font-weight:700;">{_esc(checkout.invoice_number)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;">{_esc(issued_at.strftime("%B %d, %Y"))}</p>
        <p style="margin:8px 0 0;display:inline-block;padding:4px 10px;border-radius:999px;background:#ecfdf5;color:#166534;font-size:11px;font-weight:700;">{_esc(status_label)}</p>
      </div>
    </div>

    <div style="margin-top:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;">Bill to</p>
      <p style="margin:0;font-size:15px;font-weight:700;">{_esc(customer.full_name)}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">BOSS ID: {_esc(customer.shipping_id)}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">{_esc(customer.email)} · {_esc(customer.contact_number or "")}</p>
    </div>

    <p style="margin:24px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">
      {len(packages)} package{"s" if len(packages) != 1 else ""}
    </p>
    {package_blocks}
    {delivery_fee_block}
    {processing_fee_block}

    <div style="margin-top:24px;padding-top:16px;border-top:2px solid #0f172a;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:16px;font-weight:800;">Total (JMD)</span>
      <span style="font-size:22px;font-weight:800;color:#22c55e;">{_esc(_money_jmd(grand_total))}</span>
    </div>

    {payment_block}

    <p style="margin:32px 0 0;font-size:12px;color:#64748b;line-height:1.6;">
      Thank you for shipping with Package Boss. Keep this invoice for your records.
    </p>

    <p class="no-print" style="margin-top:24px;">
      <button onclick="window.print()" style="padding:10px 20px;border:none;border-radius:8px;background:#22c55e;color:#fff;font-weight:700;cursor:pointer;">
        Print invoice
      </button>
    </p>
  </div>
</body>
</html>"""


def render_bill_invoice_html(
    package: Package,
    customer: User,
    checkout: PaymentCheckout | None = None,
) -> str:
    if checkout:
        return render_checkout_invoice_html(checkout, customer, [package])

    issued_at = datetime.utcnow()
    invoice_number = "DRAFT"
    status_label = "AMOUNT DUE"
    payment_block = ""

    line_items = _package_line_items(package)
    rows_html = ""
    for label, amount in line_items:
        rows_html += f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">{_esc(label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">
            {_esc(_money_jmd(amount))}
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice {_esc(invoice_number)}</title>
  <style>@media print {{ body {{ margin: 0; }} .no-print {{ display: none !important; }} }}</style>
</head>
<body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:system-ui,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      {_invoice_brand_header_left()}
      <div style="text-align:right;">
        <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">Bill preview</p>
        <p style="margin:4px 0 0;font-family:monospace;font-size:16px;font-weight:700;">{_esc(invoice_number)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;">{_esc(issued_at.strftime("%B %d, %Y"))}</p>
        <p style="margin:8px 0 0;display:inline-block;padding:4px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;">{_esc(status_label)}</p>
      </div>
    </div>
    <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;">Bill to</p>
        <p style="margin:0;font-size:15px;font-weight:700;">{_esc(customer.full_name)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;">BOSS ID: {_esc(customer.shipping_id)}</p>
      </div>
      <div>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;">Shipment</p>
        <p style="margin:0;font-family:monospace;font-size:15px;font-weight:700;color:#22c55e;">{_esc(package.tracking_number)}</p>
      </div>
    </div>
    <table style="width:100%;margin-top:32px;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr>
          <th style="padding:0 0 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #0f172a;">Description</th>
          <th style="padding:0 0 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #0f172a;">Amount (JMD)</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
        <tr>
          <td style="padding:16px 0 0;font-size:16px;font-weight:800;">Total due</td>
          <td style="padding:16px 0 0;text-align:right;font-size:20px;font-weight:800;color:#22c55e;">{_esc(_money_jmd(package.total_due_jmd))}</td>
        </tr>
      </tbody>
    </table>
    {payment_block}
    <p class="no-print" style="margin-top:24px;">
      <button onclick="window.print()" style="padding:10px 20px;border:none;border-radius:8px;background:#22c55e;color:#fff;font-weight:700;cursor:pointer;">Print</button>
    </p>
  </div>
</body>
</html>"""
