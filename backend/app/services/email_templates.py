"""Branded HTML email templates for Package Boss (table layout for client compatibility)."""

from __future__ import annotations

import html

BRAND_NAME = "Package Boss"
BRAND_TAGLINE = "Ship Smart. Ship Easy."
BRAND_GREEN = "#22c55e"
BRAND_GREEN_DARK = "#16a34a"
BRAND_NAVY = "#0f2744"
BG_PAGE = "#f1f5f9"
BG_CARD = "#ffffff"
TEXT_PRIMARY = "#0f172a"
TEXT_MUTED = "#64748b"
BORDER = "#e2e8f0"


def _esc(value: str) -> str:
    return html.escape(value, quote=True)


def render_layout(
    *,
    preheader: str,
    title: str,
    body_html: str,
    logo_url: str | None = None,
    cta_url: str | None = None,
    cta_label: str | None = None,
    footer_note: str | None = None,
) -> str:
    logo_block = ""
    if logo_url:
        safe_logo = _esc(logo_url)
        logo_block = f"""
          <tr>
            <td align="center" style="padding:28px 32px 8px;">
              <img src="{safe_logo}" alt="{_esc(BRAND_NAME)}" width="72" height="72"
                   style="display:block;border:0;border-radius:12px;" />
            </td>
          </tr>"""
    else:
        logo_block = f"""
          <tr>
            <td align="center" style="padding:28px 32px 8px;">
              <span style="font-size:22px;font-weight:800;letter-spacing:0.04em;color:{BRAND_GREEN};">
                {_esc(BRAND_NAME.upper())}
              </span>
            </td>
          </tr>"""

    cta_block = ""
    if cta_url and cta_label:
        safe_cta_url = _esc(cta_url)
        safe_cta_label = _esc(cta_label)
        cta_block = f"""
          <tr>
            <td align="center" style="padding:8px 32px 24px;">
              <a href="{safe_cta_url}"
                 style="display:inline-block;background:{BRAND_GREEN};color:#ffffff;font-size:15px;
                        font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px;
                        mso-padding-alt:0;">
                <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:24pt">&nbsp;</i><![endif]-->
                <span style="mso-text-raise:12pt;">{safe_cta_label}</span>
                <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%">&nbsp;</i><![endif]-->
              </a>
            </td>
          </tr>"""

    footer_extra = ""
    if footer_note:
        footer_extra = f"""
              <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:{TEXT_MUTED};">
                {_esc(footer_note)}
              </p>"""

    safe_preheader = _esc(preheader)
    safe_title = _esc(title)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>{safe_title}</title>
</head>
<body style="margin:0;padding:0;background:{BG_PAGE};font-family:Inter,Arial,Helvetica,sans-serif;
             -webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    {safe_preheader}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
         style="background:{BG_PAGE};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
               style="max-width:600px;width:100%;background:{BG_CARD};border-radius:16px;
                      border:1px solid {BORDER};overflow:hidden;">
          <tr>
            <td style="background:{BRAND_NAVY};height:6px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          {logo_block}
          <tr>
            <td style="padding:8px 32px 0;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.12em;
                        text-transform:uppercase;color:{TEXT_MUTED};">
                {_esc(BRAND_TAGLINE)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 8px;">
              <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:{TEXT_PRIMARY};">
                {safe_title}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;font-size:15px;line-height:1.6;color:{TEXT_PRIMARY};">
              {body_html}
            </td>
          </tr>
          {cta_block}
          <tr>
            <td style="padding:8px 32px 28px;">
              <hr style="border:none;border-top:1px solid {BORDER};margin:16px 0;" />
              <p style="margin:0;font-size:13px;line-height:1.5;color:{TEXT_MUTED};">
                Miami → Kingston freight forwarding<br />
                <strong style="color:{TEXT_PRIMARY};">{_esc(BRAND_NAME)} Shipping &amp; Logistics</strong>
              </p>
              {footer_extra}
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:{TEXT_MUTED};">
          You received this email because you have an account with {_esc(BRAND_NAME)}.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"""


def render_info_box(content_html: str) -> str:
    return f"""
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="margin:16px 0;background:#f8fafc;border:1px solid {BORDER};border-radius:8px;">
        <tr>
          <td style="padding:14px 16px;font-size:14px;line-height:1.5;color:{TEXT_PRIMARY};">
            {content_html}
          </td>
        </tr>
      </table>"""


def render_password_reset_html(first_name: str, reset_url: str, logo_url: str | None = None) -> str:
    safe_name = _esc(first_name)
    body = f"""
      <p style="margin:0 0 12px;">Hi {safe_name},</p>
      <p style="margin:0 0 12px;">
        We received a request to reset your password. Click the button below to choose a new one.
        This link expires in <strong>15 minutes</strong>.
      </p>
      <p style="margin:0;font-size:13px;color:{TEXT_MUTED};">
        If you didn't request a password reset, you can safely ignore this email — your password
        won't change.
      </p>"""
    return render_layout(
        preheader="Reset your Package Boss password (expires in 15 minutes)",
        title="Reset your password",
        body_html=body,
        logo_url=logo_url,
        cta_url=reset_url,
        cta_label="Reset password",
    )


def render_invoice_request_html(
    first_name: str,
    package_tracking: str,
    upload_url: str,
    note: str | None = None,
    logo_url: str | None = None,
) -> str:
    safe_name = _esc(first_name)
    safe_tracking = _esc(package_tracking)
    note_block = ""
    if note:
        note_block = render_info_box(
            f'<strong style="color:{TEXT_PRIMARY};">Note from our team</strong><br />'
            f"{html.escape(note)}"
        )
    tracking_box = render_info_box(
        f'<span style="font-size:12px;color:{TEXT_MUTED};">Tracking number</span><br />'
        f'<span style="font-family:ui-monospace,Consolas,monospace;font-size:16px;'
        f'font-weight:700;color:{BRAND_GREEN_DARK};">{safe_tracking}</span>'
    )
    body = f"""
      <p style="margin:0 0 12px;">Hi {safe_name},</p>
      <p style="margin:0 0 12px;">
        We need an invoice or receipt for your package to complete customs clearance and prepare
        your final bill.
      </p>
      {tracking_box}
      {note_block}
      <p style="margin:12px 0 0;font-size:13px;color:{TEXT_MUTED};">
        Items valued over <strong>$100 USD</strong> may incur duties and additional charges.
      </p>"""
    return render_layout(
        preheader=f"Upload an invoice for package {package_tracking}",
        title="Receipt needed for your package",
        body_html=body,
        logo_url=logo_url,
        cta_url=upload_url,
        cta_label="Upload receipt",
        footer_note="Accepted formats: PDF, JPEG, PNG, or WebP.",
    )


STATUS_CUSTOMER_MESSAGES: dict[str, str] = {
    "awaiting_receipt": "We're waiting for your package to arrive at our Miami warehouse.",
    "received_miami": "Your package has been received at our Miami warehouse.",
    "processing": "Your package is being processed and prepared for shipment to Kingston.",
    "in_transit": "Your package is in transit to Kingston, Jamaica.",
    "arrived_kingston": "Your package has arrived in Kingston and is being prepared for delivery.",
    "out_for_delivery": "Your package is out for delivery.",
    "delivered": "Your package has been delivered. Thank you for shipping with Package Boss!",
}


def render_welcome_html(
    first_name: str,
    shipping_id: str,
    shipping_address_formatted: str,
    dashboard_url: str,
    logo_url: str | None = None,
) -> str:
    safe_name = _esc(first_name)
    safe_id = _esc(shipping_id)
    safe_dashboard = _esc(dashboard_url)
    address_lines = "<br />".join(_esc(line) for line in shipping_address_formatted.splitlines() if line.strip())
    address_box = render_info_box(
        f'<span style="font-size:12px;color:{TEXT_MUTED};">Your BOSS shipping ID</span><br />'
        f'<span style="font-family:ui-monospace,Consolas,monospace;font-size:18px;'
        f'font-weight:700;color:{BRAND_GREEN_DARK};">{safe_id}</span><br /><br />'
        f'<span style="font-size:12px;color:{TEXT_MUTED};">Miami warehouse address</span><br />'
        f'<span style="font-size:14px;line-height:1.5;">{address_lines}</span>'
    )
    body = f"""
      <p style="margin:0 0 12px;">Hi {safe_name},</p>
      <p style="margin:0 0 12px;">
        Welcome to <strong>{_esc(BRAND_NAME)}</strong>! Your account is ready. Use the address below
        when shopping online in the US — always include your BOSS ID on the shipping label.
      </p>
      {address_box}
      <p style="margin:12px 0 0;font-size:13px;color:{TEXT_MUTED};">
        Track packages and manage pre-alerts anytime from your dashboard.
      </p>"""
    return render_layout(
        preheader=f"Welcome to Package Boss — your shipping ID is {shipping_id}",
        title="Welcome aboard!",
        body_html=body,
        logo_url=logo_url,
        cta_url=dashboard_url,
        cta_label="Go to dashboard",
    )


def render_package_status_html(
    first_name: str,
    tracking_number: str,
    status: str,
    status_label: str,
    track_url: str,
    note: str | None = None,
    logo_url: str | None = None,
) -> str:
    from app.constants import STATUS_LABELS

    safe_name = _esc(first_name)
    safe_tracking = _esc(tracking_number)
    safe_label = _esc(status_label)
    message = STATUS_CUSTOMER_MESSAGES.get(status) or STATUS_LABELS.get(status, status)
    safe_message = _esc(message)
    note_block = ""
    if note:
        note_block = render_info_box(
            f'<strong style="color:{TEXT_PRIMARY};">Update</strong><br />{html.escape(note)}'
        )
    tracking_box = render_info_box(
        f'<span style="font-size:12px;color:{TEXT_MUTED};">Tracking number</span><br />'
        f'<span style="font-family:ui-monospace,Consolas,monospace;font-size:16px;'
        f'font-weight:700;color:{BRAND_GREEN_DARK};">{safe_tracking}</span><br /><br />'
        f'<span style="font-size:12px;color:{TEXT_MUTED};">Status</span><br />'
        f'<span style="font-size:15px;font-weight:700;color:{TEXT_PRIMARY};">{safe_label}</span>'
    )
    body = f"""
      <p style="margin:0 0 12px;">Hi {safe_name},</p>
      <p style="margin:0 0 12px;">{safe_message}</p>
      {tracking_box}
      {note_block}"""
    return render_layout(
        preheader=f"Package {tracking_number} — {status_label}",
        title="Package status update",
        body_html=body,
        logo_url=logo_url,
        cta_url=track_url,
        cta_label="Track package",
    )
