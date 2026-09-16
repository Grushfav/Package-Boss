import { PAYMENT_METHOD_LABELS, STATUS_LABELS } from '../constants.js'
import { config } from '../config.js'
import type { packages, paymentCheckouts, users } from '../db/schema/index.js'
import { renderCheckoutInvoiceHtml } from './billInvoiceService.js'
import { customerEmailNotificationsEnabled } from './notificationSettingsService.js'
import {
  renderInvoiceRequestHtml,
  renderPackageStatusHtml,
  renderPasswordResetHtml,
  renderWelcomeHtml,
} from './emailTemplates.js'

const APP_ID = 'package-boss'
let cachedLogoUrl: string | null = null

export class EmailServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly response: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'EmailServiceError'
  }
}

function workerConfig(): [string, string, string] {
  const apiUrl = config.emailApiUrl
  const apiKey = config.emailApiKey
  const fromAddress = config.defaultFromEmail
  if (!apiUrl || !apiKey) {
    throw new EmailServiceError('Email worker is not configured (EMAIL_API_URL / EMAIL_API_KEY)')
  }
  return [apiUrl, apiKey, fromAddress]
}

export function resolveLogoUrl(): string | null {
  if (config.emailLogoUrl) return config.emailLogoUrl
  if (cachedLogoUrl) return cachedLogoUrl
  if (config.frontendUrl) return `${config.frontendUrl}/email-logo.png`
  return null
}

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  text?: string | null
  htmlBody?: string | null
  fromAddress?: string | null
  replyTo?: string | null
  metadata?: Record<string, unknown>
}): Promise<Record<string, unknown>> {
  if (!opts.text && !opts.htmlBody) {
    throw new Error('Either text or html is required')
  }

  const [apiUrl, apiKey] = workerConfig()
  const payload: Record<string, unknown> = {
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.htmlBody,
    from: opts.fromAddress ?? config.defaultFromEmail,
    fromName: config.defaultFromName || undefined,
    replyTo: opts.replyTo,
    metadata: { appId: APP_ID, ...(opts.metadata ?? {}) },
  }

  const body = Object.fromEntries(Object.entries(payload).filter(([, v]) => v != null))

  let response: Response
  try {
    response = await fetch(`${apiUrl}/v1/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    throw new EmailServiceError(`Email request failed: ${err instanceof Error ? err.message : err}`)
  }

  let data: Record<string, unknown>
  try {
    data = (await response.json()) as Record<string, unknown>
  } catch {
    data = { error: await response.text() }
  }

  if (!response.ok) {
    throw new EmailServiceError(
      (data.error as string) || 'Email send failed',
      response.status,
      data,
    )
  }

  return data
}

function dispatchEmail(
  toEmail: string,
  subject: string,
  body: string,
  opts: { htmlBody?: string; metadata?: Record<string, unknown>; asyncSend?: boolean } = {},
): Promise<Record<string, unknown> | null> | null {
  const provider = config.emailProvider

  if (provider === 'console') {
    console.log(`\n--- EMAIL ---\nTo: ${toEmail}\nSubject: ${subject}\n\n${body}\n`)
    return null
  }

  if (provider === 'worker') {
    const send = () =>
      sendEmail({
        to: toEmail,
        subject,
        text: body,
        htmlBody: opts.htmlBody,
        metadata: opts.metadata,
      })

    if (opts.asyncSend) {
      void send().catch((err) => console.error(`Async email failed for ${toEmail}:`, err))
      return null
    }
    return send()
  }

  throw new EmailServiceError(`Email provider '${provider}' is not configured`)
}

export function sendWelcomeEmail(
  toEmail: string,
  firstName: string,
  shippingId: string,
  shippingAddress: { formatted?: string },
) {
  const dashboardUrl = `${config.frontendUrl}/dashboard`
  const formattedAddress = shippingAddress.formatted ?? ''
  const subject = `Welcome to Package Boss — ${shippingId}`
  const body = `Hi ${firstName},\n\nWelcome to Package Boss! Your shipping ID is ${shippingId}.\n\nFort Lauderdale warehouse address:\n${formattedAddress}\n\nDashboard: ${dashboardUrl}\n\n— Package Boss`
  const htmlBody = renderWelcomeHtml(firstName, shippingId, formattedAddress, dashboardUrl, resolveLogoUrl())
  dispatchEmail(toEmail, subject, body, {
    htmlBody,
    metadata: { type: 'welcome', shippingId },
    asyncSend: true,
  })
}

export function sendPasswordResetEmail(toEmail: string, firstName: string, resetUrl: string) {
  const subject = 'Reset your Package Boss password'
  const body = `Hi ${firstName},\n\nWe received a request to reset your password.\nClick the link below (expires in 15 minutes):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n\n— Package Boss`
  const htmlBody = renderPasswordResetHtml(firstName, resetUrl, resolveLogoUrl())
  dispatchEmail(toEmail, subject, body, {
    htmlBody,
    metadata: { type: 'password_reset' },
    asyncSend: true,
  })
}

export function sendClerkInviteEmail(toEmail: string, firstName: string, inviteUrl: string) {
  const subject = "You're invited to Package Boss warehouse"
  const body = `Hi ${firstName},\n\nAn admin created a clerk account for you on Package Boss.\nSet your password using the link below (expires in 24 hours):\n\n${inviteUrl}\n\nIf you weren't expecting this, ignore this email.\n\n— Package Boss`
  const htmlBody = renderPasswordResetHtml(firstName, inviteUrl, resolveLogoUrl(), {
    heading: 'Set your clerk password',
    intro: 'An admin created a warehouse clerk account for you. Choose a password to get started.',
    expiryNote: '24 hours',
  })
  dispatchEmail(toEmail, subject, body, {
    htmlBody,
    metadata: { type: 'clerk_invite' },
    asyncSend: true,
  })
}

export async function sendPackageStatusEmail(
  toEmail: string,
  firstName: string,
  trackingNumber: string,
  status: string,
  opts: {
    packageId?: string | null
    statusLabel?: string | null
    note?: string | null
    carrierTracking?: string | null
    shipperLabel?: string | null
  } = {},
): Promise<void> {
  if (!(await customerEmailNotificationsEnabled())) {
    console.info(
      `Customer email notifications disabled — skipping status email for ${trackingNumber}`,
    )
    return
  }

  const label =
    opts.statusLabel ?? STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const frontend = (config.frontendUrl || 'http://localhost:5173').replace(/\/$/, '')
  const trackUrl = `${frontend}/track?tracking=${encodeURIComponent(trackingNumber)}`
  const ctaUrl =
    status === 'ready_for_pickup' && opts.packageId
      ? `${frontend}/dashboard/packages/${opts.packageId}/bill`
      : trackUrl
  const ctaLabel = status === 'ready_for_pickup' && opts.packageId ? 'View invoice' : 'Track package'
  const subject = `Package update — ${trackingNumber}: ${label}`

  const shipmentLines = [`Package Boss tracking: ${trackingNumber}`]
  if (opts.carrierTracking?.trim()) shipmentLines.push(`Carrier tracking: ${opts.carrierTracking.trim()}`)
  if (opts.shipperLabel?.trim()) shipmentLines.push(`Shipper: ${opts.shipperLabel.trim()}`)
  const shipmentBlock = shipmentLines.join('\n')

  let body = `Hi ${firstName},\n\nYour package status is now: ${label}.\n\n${shipmentBlock}\n\n`
  body += status === 'ready_for_pickup' && opts.packageId
    ? `View your invoice: ${ctaUrl}\n\n`
    : `Track your package: ${trackUrl}\n\n`
  body += '— Package Boss'

  if (opts.note) {
    body = `Hi ${firstName},\n\nYour package status is now: ${label}.\n\n${opts.note}\n\n${shipmentBlock}\n\n`
    body += status === 'ready_for_pickup' && opts.packageId
      ? `View your invoice: ${ctaUrl}\n\n`
      : `Track your package: ${trackUrl}\n\n`
    body += '— Package Boss'
  }

  const htmlBody = renderPackageStatusHtml(firstName, trackingNumber, label, trackUrl, resolveLogoUrl(), {
    ctaUrl,
    ctaLabel,
  })

  dispatchEmail(toEmail, subject, body, {
    htmlBody,
    metadata: { type: 'package_status', trackingNumber, status },
    asyncSend: true,
  })
}

export async function sendInvoiceRequestEmail(
  toEmail: string,
  firstName: string,
  packageTracking: string,
  uploadUrl: string,
  note?: string | null,
): Promise<Record<string, unknown> | null> {
  if (!(await customerEmailNotificationsEnabled())) {
    console.info(
      `Customer email notifications disabled — skipping invoice request for ${packageTracking}`,
    )
    return null
  }

  const noteLine = note ? `\n\nNote from our team:\n${note}\n` : ''
  const subject = `Package Boss — upload receipt for ${packageTracking}`
  const body = `Hi ${firstName},\n\nWe need an invoice or receipt for package ${packageTracking} to complete customs clearance and prepare your final bill.${noteLine}\nUpload your invoice here:\n${uploadUrl}\n\nItems over $100 USD may incur duties and additional charges.\n\n— Package Boss`
  const htmlBody = renderInvoiceRequestHtml(firstName, packageTracking, uploadUrl, resolveLogoUrl())

  const result = await dispatchEmail(toEmail, subject, body, {
    htmlBody,
    metadata: { type: 'invoice_request', trackingNumber: packageTracking },
    asyncSend: true,
  })
  return result
}

export async function sendCheckoutInvoiceEmail(
  customer: typeof users.$inferSelect,
  checkout: typeof paymentCheckouts.$inferSelect,
  pkgs: Array<typeof packages.$inferSelect>,
): Promise<Record<string, unknown>> {
  const itemAmounts = new Map(pkgs.map((pkg) => [pkg.id, pkg.totalDueJmd ?? '0']))
  const htmlBody = renderCheckoutInvoiceHtml(checkout, customer, pkgs, itemAmounts)
  const methodLabel = PAYMENT_METHOD_LABELS[checkout.method] ?? checkout.method
  const total = parseFloat(checkout.totalJmd)
  const totalDisplay = total === Math.trunc(total) ? `J$${total.toLocaleString()}` : `J$${total.toFixed(2)}`
  const subject = `Package Boss invoice ${checkout.invoiceNumber}`
  const body = `Hi ${customer.firstName},\n\nThank you for your payment. Invoice ${checkout.invoiceNumber} for ${totalDisplay} (${methodLabel}) is included below.\n\n— Package Boss Shipping & Logistics`

  const result = await dispatchEmail(customer.email, subject, body, {
    htmlBody,
    metadata: { type: 'checkout_invoice', invoiceNumber: checkout.invoiceNumber },
    asyncSend: false,
  })
  if (result == null) {
    throw new EmailServiceError('Email provider is not configured')
  }
  return result
}

export async function sendAnnouncementEmail(
  toEmail: string,
  firstName: string,
  title: string,
  bodyText: string,
) {
  if (!(await customerEmailNotificationsEnabled())) {
    console.info(`Customer email notifications disabled — skipping announcement email to ${toEmail}`)
    return
  }

  const dashboardUrl = `${config.frontendUrl}/dashboard/notifications`
  const subject = `Package Boss update — ${title}`
  const body = `Hi ${firstName},\n\n${bodyText}\n\nView in your dashboard: ${dashboardUrl}\n\n— Package Boss`
  await dispatchEmail(toEmail, subject, body, {
    metadata: { type: 'announcement', title },
    asyncSend: false,
  })
}
