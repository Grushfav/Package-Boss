import { PAYMENT_METHOD_LABELS } from '../constants.js'
import { config } from '../config.js'
import type { packages, paymentCheckouts, users } from '../db/schema/index.js'
import { formatJamaicaDatetime } from '../lib/dates.js'
import { userFullName } from '../lib/serializers/user.js'

type PackageRow = typeof packages.$inferSelect
type CheckoutRow = typeof paymentCheckouts.$inferSelect
type UserRow = typeof users.$inferSelect

function esc(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function invoiceLogoSrc(): string | null {
  const configured = config.emailLogoUrl.trim()
  if (configured) return configured
  const frontend = config.frontendUrl.trim().replace(/\/$/, '')
  if (frontend) return `${frontend}/email-logo.png`
  return null
}

function invoiceBrandBlock(): string {
  const logoSrc = invoiceLogoSrc()
  if (logoSrc) {
    return `<img src="${esc(logoSrc)}" alt="Package Boss" style="display:block;height:72px;width:72px;object-fit:contain;" />`
  }
  return '<p style="margin:0;font-size:22px;font-weight:800;color:#22c55e;letter-spacing:0.04em;">PACKAGE BOSS</p>'
}

function invoiceBrandHeaderLeft(): string {
  return `<div>${invoiceBrandBlock()}<p style="margin:8px 0 0;font-size:14px;font-weight:700;color:#0f172a;">Package Boss Shipping &amp; Logistics</p><p style="margin:4px 0 0;font-size:13px;color:#64748b;">Fort Lauderdale → Kingston</p></div>`
}

function moneyJmd(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const amount = typeof value === 'number' ? value : parseFloat(String(value))
  if (amount === Math.floor(amount)) return `J$${Math.floor(amount).toLocaleString('en-US')}`
  return `J$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function packageLineItems(pkg: PackageRow): Array<[string, number]> {
  const items: Array<[string, number]> = []
  if (pkg.estimatedFreightJmd != null) items.push(['Shipping', parseFloat(pkg.estimatedFreightJmd)])
  if (pkg.dutiesJmd != null) items.push(['Customs duties', parseFloat(pkg.dutiesJmd)])
  if (pkg.handlingJmd != null) items.push(['Handling', parseFloat(pkg.handlingJmd)])
  if (pkg.otherFeesJmd != null) items.push(['Other fees', parseFloat(pkg.otherFeesJmd)])
  return items
}

export function renderCheckoutInvoiceHtml(
  checkout: CheckoutRow,
  customer: UserRow,
  pkgs: PackageRow[],
  itemAmounts: Map<string, string>,
): string {
  const issuedAt = checkout.recordedAt ?? new Date()
  const statusLabel = 'PAID'
  let packageBlocks = ''
  const grandTotal = parseFloat(checkout.totalJmd)

  for (const pkg of pkgs) {
    const itemAmount = itemAmounts.get(pkg.id)
    const pkgTotal = itemAmount != null ? parseFloat(itemAmount) : parseFloat(pkg.totalDueJmd ?? '0')
    let rowsHtml = ''
    for (const [label, amount] of packageLineItems(pkg)) {
      rowsHtml += `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">${esc(label)}</td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${esc(moneyJmd(amount))}</td></tr>`
    }
    packageBlocks += `<div style="margin-top:20px;padding:16px;border:1px solid #e2e8f0;border-radius:8px;"><p style="margin:0 0 8px;font-family:monospace;font-weight:700;color:#22c55e;">${esc(pkg.trackingNumber)}</p><p style="margin:0 0 12px;font-size:12px;color:#64748b;">${esc(pkg.carrierTracking ?? 'No carrier tracking')} · ${esc(pkg.billableWeightLbs != null ? `${pkg.billableWeightLbs} lbs` : '—')}</p><table style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${rowsHtml}</tbody><tfoot><tr><td style="padding:8px 0 0;font-weight:700;">Package total</td><td style="padding:8px 0 0;text-align:right;font-weight:700;">${esc(moneyJmd(pkgTotal))}</td></tr></tfoot></table></div>`
  }

  let deliveryFeeBlock = ''
  if (checkout.deliveryFeeJmd != null && parseFloat(checkout.deliveryFeeJmd) > 0) {
    deliveryFeeBlock = `<div style="margin-top:16px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:14px;font-weight:600;color:#64748b;">Delivery fee (Kingston &amp; Portmore)</span><span style="font-size:15px;font-weight:700;">${esc(moneyJmd(checkout.deliveryFeeJmd))}</span></div>`
  }

  let processingFeeBlock = ''
  if (checkout.processingFeeJmd != null && parseFloat(checkout.processingFeeJmd) > 0) {
    processingFeeBlock = `<div style="margin-top:16px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:14px;font-weight:600;color:#64748b;">Processing fee</span><span style="font-size:15px;font-weight:700;">${esc(moneyJmd(checkout.processingFeeJmd))}</span></div>`
  }

  const paymentBlock = `<div style="margin-top:24px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;"><p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;color:#166534;">Payment received</p><p style="margin:0;font-size:14px;color:#14532d;">${esc(PAYMENT_METHOD_LABELS[checkout.method] ?? checkout.method)}${checkout.reference ? ` · Ref ${esc(checkout.reference)}` : ''} · ${esc(formatJamaicaDatetime(issuedAt))}</p></div>`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Invoice ${esc(checkout.invoiceNumber)}</title><style>@media print { body { margin: 0; } .no-print { display: none !important; } }</style></head><body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;"><div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">${invoiceBrandHeaderLeft()}<div style="text-align:right;"><p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">Invoice</p><p style="margin:4px 0 0;font-family:monospace;font-size:16px;font-weight:700;">${esc(checkout.invoiceNumber)}</p><p style="margin:4px 0 0;font-size:12px;color:#64748b;">${esc(formatJamaicaDatetime(issuedAt, { dateOnly: true }))}</p><p style="margin:8px 0 0;display:inline-block;padding:4px 10px;border-radius:999px;background:#ecfdf5;color:#166534;font-size:11px;font-weight:700;">${esc(statusLabel)}</p></div></div><div style="margin-top:24px;"><p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;">Bill to</p><p style="margin:0;font-size:15px;font-weight:700;">${esc(userFullName(customer))}</p><p style="margin:4px 0 0;font-size:13px;color:#64748b;">BOSS ID: ${esc(customer.shippingId)}</p><p style="margin:4px 0 0;font-size:13px;color:#64748b;">${esc(customer.email)} · ${esc(customer.contactNumber ?? '')}</p></div><p style="margin:24px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">${pkgs.length} package${pkgs.length !== 1 ? 's' : ''}</p>${packageBlocks}${deliveryFeeBlock}${processingFeeBlock}<div style="margin-top:24px;padding-top:16px;border-top:2px solid #0f172a;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:16px;font-weight:800;">Total (JMD)</span><span style="font-size:22px;font-weight:800;color:#22c55e;">${esc(moneyJmd(grandTotal))}</span></div>${paymentBlock}<p style="margin:32px 0 0;font-size:12px;color:#64748b;line-height:1.6;">Thank you for shipping with Package Boss. Keep this invoice for your records.</p><p class="no-print" style="margin-top:24px;"><button onclick="window.print()" style="padding:10px 20px;border:none;border-radius:8px;background:#22c55e;color:#fff;font-weight:700;cursor:pointer;">Print invoice</button></p></div></body></html>`
}

export function renderBillInvoiceHtml(pkg: PackageRow, customer: UserRow): string {
  const issuedAt = new Date()
  const invoiceNumber = 'DRAFT'
  const statusLabel = 'AMOUNT DUE'
  let rowsHtml = ''
  for (const [label, amount] of packageLineItems(pkg)) {
    rowsHtml += `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">${esc(label)}</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${esc(moneyJmd(amount))}</td></tr>`
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Invoice ${esc(invoiceNumber)}</title><style>@media print { body { margin: 0; } .no-print { display: none !important; } }</style></head><body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:system-ui,sans-serif;color:#0f172a;"><div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;"><div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">${invoiceBrandHeaderLeft()}<div style="text-align:right;"><p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">Bill preview</p><p style="margin:4px 0 0;font-family:monospace;font-size:16px;font-weight:700;">${esc(invoiceNumber)}</p><p style="margin:4px 0 0;font-size:12px;color:#64748b;">${esc(formatJamaicaDatetime(issuedAt, { dateOnly: true }))}</p><p style="margin:8px 0 0;display:inline-block;padding:4px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;">${esc(statusLabel)}</p></div></div><div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:24px;"><div><p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;">Bill to</p><p style="margin:0;font-size:15px;font-weight:700;">${esc(userFullName(customer))}</p><p style="margin:4px 0 0;font-size:13px;color:#64748b;">BOSS ID: ${esc(customer.shippingId)}</p></div><div><p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;">Shipment</p><p style="margin:0;font-family:monospace;font-size:15px;font-weight:700;color:#22c55e;">${esc(pkg.trackingNumber)}</p><p style="margin:6px 0 0;font-size:13px;color:#64748b;">${esc(pkg.carrierTracking ?? 'No carrier tracking')} · Billable weight: ${esc(pkg.billableWeightLbs != null ? `${pkg.billableWeightLbs} lbs` : '—')}</p></div></div><table style="width:100%;margin-top:32px;border-collapse:collapse;font-size:14px;"><thead><tr><th style="padding:0 0 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #0f172a;">Description</th><th style="padding:0 0 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #0f172a;">Amount (JMD)</th></tr></thead><tbody>${rowsHtml}<tr><td style="padding:16px 0 0;font-size:16px;font-weight:800;">Total due</td><td style="padding:16px 0 0;text-align:right;font-size:20px;font-weight:800;color:#22c55e;">${esc(moneyJmd(pkg.totalDueJmd))}</td></tr></tbody></table><p class="no-print" style="margin-top:24px;"><button onclick="window.print()" style="padding:10px 20px;border:none;border-radius:8px;background:#22c55e;color:#fff;font-weight:700;cursor:pointer;">Print</button></p></div></body></html>`
}
