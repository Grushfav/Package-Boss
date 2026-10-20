const BRAND_NAME = 'Package Boss'
const BRAND_TAGLINE = 'Ship Smart. Ship Easy.'
const BRAND_GREEN = '#22c55e'
const BRAND_GREEN_DARK = '#16a34a'
const BRAND_NAVY = '#0f2744'
const BG_PAGE = '#f1f5f9'
const BG_CARD = '#ffffff'
const TEXT_PRIMARY = '#0f172a'
const TEXT_MUTED = '#64748b'
const BORDER = '#e2e8f0'
const EMAIL_LOGO_WIDTH = 144
const EMAIL_LOGO_HEIGHT = 144

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderLayout(opts: {
  preheader: string
  title: string
  bodyHtml: string
  logoUrl?: string | null
  ctaUrl?: string | null
  ctaLabel?: string | null
  footerNote?: string | null
}): string {
  const logoBlock = opts.logoUrl
    ? `<tr><td align="center" style="padding:28px 32px 8px;"><img src="${esc(opts.logoUrl)}" alt="${esc(BRAND_NAME)}" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" style="display:block;border:0;" /></td></tr>`
    : `<tr><td align="center" style="padding:28px 32px 8px;"><span style="font-size:22px;font-weight:800;letter-spacing:0.04em;color:${BRAND_GREEN};">${esc(BRAND_NAME.toUpperCase())}</span></td></tr>`

  const ctaBlock =
    opts.ctaUrl && opts.ctaLabel
      ? `<tr><td align="center" style="padding:8px 32px 24px;"><a href="${esc(opts.ctaUrl)}" style="display:inline-block;background:${BRAND_GREEN};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px;">${esc(opts.ctaLabel)}</a></td></tr>`
      : ''

  const footerExtra = opts.footerNote
    ? `<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${TEXT_MUTED};">${esc(opts.footerNote)}</p>`
    : ''

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${esc(opts.title)}</title></head><body style="margin:0;padding:0;background:${BG_PAGE};font-family:Inter,Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(opts.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BG_PAGE};"><tr><td align="center" style="padding:24px 16px;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:${BG_CARD};border-radius:16px;border:1px solid ${BORDER};overflow:hidden;"><tr><td style="background:${BRAND_NAVY};height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>${logoBlock}<tr><td style="padding:8px 32px 0;text-align:center;"><p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${TEXT_MUTED};">${esc(BRAND_TAGLINE)}</p></td></tr><tr><td style="padding:20px 32px 8px;"><h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:${TEXT_PRIMARY};">${esc(opts.title)}</h1></td></tr><tr><td style="padding:0 32px 8px;font-size:15px;line-height:1.6;color:${TEXT_PRIMARY};">${opts.bodyHtml}</td></tr>${ctaBlock}<tr><td style="padding:8px 32px 28px;"><hr style="border:none;border-top:1px solid ${BORDER};margin:16px 0;" /><p style="margin:0;font-size:13px;line-height:1.5;color:${TEXT_MUTED};">Fort Lauderdale → Kingston freight forwarding<br /><strong style="color:${TEXT_PRIMARY};">${esc(BRAND_NAME)} Shipping &amp; Logistics</strong></p>${footerExtra}</td></tr></table><p style="margin:16px 0 0;font-size:11px;color:${TEXT_MUTED};">You received this email because you have an account with ${esc(BRAND_NAME)}.</p></td></tr></table></body></html>`
}

export function renderPasswordResetHtml(
  firstName: string,
  resetUrl: string,
  logoUrl?: string | null,
  opts: {
    heading?: string
    intro?: string
    buttonLabel?: string
    expiryNote?: string
  } = {},
): string {
  const heading = opts.heading ?? 'Reset your password'
  const intro =
    opts.intro ??
    'We received a request to reset your password. Click the button below to choose a new one.'
  const expiryNote = opts.expiryNote ?? '15 minutes'
  const body = `<p style="margin:0 0 12px;">Hi ${esc(firstName)},</p><p style="margin:0 0 12px;">${intro} This link expires in <strong>${esc(expiryNote)}</strong>.</p><p style="margin:0;font-size:13px;color:${TEXT_MUTED};">If you weren't expecting this email, you can safely ignore it.</p>`
  return renderLayout({
    preheader: `${heading} (expires in ${expiryNote})`,
    title: heading,
    bodyHtml: body,
    logoUrl,
    ctaUrl: resetUrl,
    ctaLabel: opts.buttonLabel ?? 'Reset password',
  })
}

export function renderWelcomeHtml(
  firstName: string,
  shippingId: string,
  shippingAddressFormatted: string,
  dashboardUrl: string,
  logoUrl?: string | null,
): string {
  const addressLines = shippingAddressFormatted
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => esc(line))
    .join('<br />')
  const body = `<p style="margin:0 0 12px;">Hi ${esc(firstName)},</p><p style="margin:0 0 12px;">Welcome to <strong>${esc(BRAND_NAME)}</strong>! Your account is ready.</p><p style="margin:0 0 8px;font-family:ui-monospace,Consolas,monospace;font-size:18px;font-weight:700;color:${BRAND_GREEN_DARK};">${esc(shippingId)}</p><p style="margin:0;font-size:14px;line-height:1.5;">${addressLines}</p>`
  return renderLayout({
    preheader: `Welcome to Package Boss — your shipping ID is ${shippingId}`,
    title: 'Welcome aboard!',
    bodyHtml: body,
    logoUrl,
    ctaUrl: dashboardUrl,
    ctaLabel: 'Go to dashboard',
  })
}

const STATUS_CUSTOMER_MESSAGES: Record<string, string> = {
  awaiting_receipt: "We're waiting for your package to arrive at our Fort Lauderdale warehouse.",
  received: 'Your package has been received at our warehouse.',
  in_transit: 'Your package is in transit to Jamaica.',
  customs: 'Your package is in customs clearance.',
  ready_for_pickup: 'Your package is ready for pickup or delivery. Your bill is now available.',
  delivered: 'Your package has been delivered. Thank you for shipping with Package Boss!',
}

const STATUS_CUSTOMER_MESSAGES_BATCH: Record<string, string> = {
  awaiting_receipt: "We're waiting for your packages to arrive at our Fort Lauderdale warehouse.",
  received: 'Your packages have been received at our warehouse.',
  in_transit: 'Your packages are in transit to Jamaica.',
  customs: 'Your packages are in customs clearance.',
  ready_for_pickup: 'Your packages are ready for pickup or delivery. Your bills are now available.',
  delivered: 'Your packages have been delivered. Thank you for shipping with Package Boss!',
}

function renderInfoBox(contentHtml: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;background:#f8fafc;border:1px solid ${BORDER};border-radius:8px;"><tr><td style="padding:14px 16px;font-size:14px;line-height:1.5;color:${TEXT_PRIMARY};">${contentHtml}</td></tr></table>`
}

export function renderPackageStatusHtml(
  firstName: string,
  trackingNumber: string,
  statusLabel: string,
  trackUrl: string,
  logoUrl?: string | null,
  opts: { ctaUrl?: string; ctaLabel?: string } = {},
): string {
  const body = `<p style="margin:0 0 12px;">Hi ${esc(firstName)},</p><p style="margin:0 0 12px;">Your package status is now: <strong>${esc(statusLabel)}</strong>.</p><p style="margin:0;font-family:ui-monospace,Consolas,monospace;font-size:16px;font-weight:700;color:${BRAND_GREEN_DARK};">${esc(trackingNumber)}</p>`
  return renderLayout({
    preheader: `Package ${trackingNumber} — ${statusLabel}`,
    title: 'Package status update',
    bodyHtml: body,
    logoUrl,
    ctaUrl: opts.ctaUrl ?? trackUrl,
    ctaLabel: opts.ctaLabel ?? 'Track package',
  })
}

/** Batch status email HTML — mirrors Flask render_package_status_batch_html. */
export function renderPackageStatusBatchHtml(
  firstName: string,
  packageRows: Array<[string, string | null, string | null]>,
  status: string,
  statusLabel: string,
  packagesUrl: string,
  opts: {
    note?: string | null
    logoUrl?: string | null
    ctaUrl?: string | null
    ctaLabel?: string | null
  } = {},
): string {
  const count = packageRows.length
  const message =
    STATUS_CUSTOMER_MESSAGES_BATCH[status] ??
    STATUS_CUSTOMER_MESSAGES[status] ??
    statusLabel
  const noteBlock = opts.note
    ? renderInfoBox(
        `<strong style="color:${TEXT_PRIMARY};">Update</strong><br />${esc(opts.note)}`,
      )
    : ''

  let tableRows = ''
  for (const [tracking, carrierTracking, shipperLabel] of packageRows) {
    const extraParts: string[] = []
    if (carrierTracking?.trim()) extraParts.push(`Carrier: ${esc(carrierTracking.trim())}`)
    if (shipperLabel?.trim()) extraParts.push(`Shipper: ${esc(shipperLabel.trim())}`)
    const extraHtml = extraParts.length
      ? `<br /><span style="font-size:12px;color:${TEXT_MUTED};">${extraParts.join(' · ')}</span>`
      : ''
    tableRows += `<tr><td style="padding:10px 12px;border-bottom:1px solid ${BORDER};font-family:ui-monospace,Consolas,monospace;font-size:14px;font-weight:600;color:${BRAND_GREEN_DARK};">${esc(tracking)}${extraHtml}</td></tr>`
  }

  const packagesTable = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;"><tr><td style="padding:10px 12px;background:${BG_PAGE};font-size:12px;font-weight:700;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.04em;">${count} package${count !== 1 ? 's' : ''} · ${esc(statusLabel)}</td></tr>${tableRows}</table>`

  const body = `<p style="margin:0 0 12px;">Hi ${esc(firstName)},</p><p style="margin:0 0 12px;">${esc(message)}</p>${packagesTable}${noteBlock}`

  let trackingPreview = packageRows
    .slice(0, 3)
    .map(([tn]) => tn)
    .join(', ')
  if (count > 3) trackingPreview += ` +${count - 3} more`

  return renderLayout({
    preheader: `${count} packages — ${statusLabel} (${trackingPreview})`,
    title: 'Package status update',
    bodyHtml: body,
    logoUrl: opts.logoUrl,
    ctaUrl: opts.ctaUrl ?? packagesUrl,
    ctaLabel: opts.ctaLabel ?? 'View packages',
  })
}

export function renderInvoiceRequestHtml(
  firstName: string,
  packageTracking: string,
  uploadUrl: string,
  logoUrl?: string | null,
): string {
  const body = `<p style="margin:0 0 12px;">Hi ${esc(firstName)},</p><p style="margin:0 0 12px;">We need an invoice or receipt for package <strong>${esc(packageTracking)}</strong>.</p>`
  return renderLayout({
    preheader: `Upload an invoice for package ${packageTracking}`,
    title: 'Receipt needed for your package',
    bodyHtml: body,
    logoUrl,
    ctaUrl: uploadUrl,
    ctaLabel: 'Upload receipt',
    footerNote: 'Accepted formats: PDF, JPEG, PNG, or WebP.',
  })
}
