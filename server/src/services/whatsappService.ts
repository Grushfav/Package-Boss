import { config } from '../config.js'

export class WhatsAppServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly response: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'WhatsAppServiceError'
  }
}

function normalizeWhatsappRecipient(phone: string): string {
  const raw = (phone ?? '').trim()
  if (!raw) throw new WhatsAppServiceError('Recipient phone number is required')
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    throw new WhatsAppServiceError('Recipient phone must be 7-15 digits including country code')
  }
  return digits
}

function metaConfig(): [string, string, string] {
  const apiVersion = config.whatsappApiVersion
  const phoneNumberId = config.whatsappPhoneNumberId
  const accessToken = config.whatsappAccessToken
  if (!phoneNumberId || !accessToken) {
    throw new WhatsAppServiceError(
      'WhatsApp Cloud API is not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)',
    )
  }
  return [apiVersion, phoneNumberId, accessToken]
}

async function sendMetaTextMessage(toPhone: string, body: string): Promise<Record<string, unknown>> {
  const [apiVersion, phoneNumberId, accessToken] = metaConfig()
  const recipient = normalizeWhatsappRecipient(toPhone)
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: { preview_url: true, body },
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    throw new WhatsAppServiceError(`WhatsApp request failed: ${err instanceof Error ? err.message : err}`)
  }

  let data: Record<string, unknown>
  try {
    data = (await response.json()) as Record<string, unknown>
  } catch {
    data = { error: await response.text() }
  }

  if (!response.ok) {
    const error = data.error
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: string }).message)
        : null
    throw new WhatsAppServiceError(message || 'WhatsApp send failed', response.status, data)
  }

  return data
}

export async function dispatchWhatsapp(toPhone: string, body: string): Promise<Record<string, unknown>> {
  const provider = config.whatsappProvider

  if (provider === 'console') {
    console.log(`\n--- WHATSAPP ---\nTo: ${toPhone}\n\n${body}\n`)
    return { provider: 'console', to: toPhone }
  }

  if (provider === 'meta' || provider === 'cloud_api') {
    return sendMetaTextMessage(toPhone, body)
  }

  throw new WhatsAppServiceError(`WhatsApp provider '${provider}' is not configured`)
}

export async function sendInvoiceRequestWhatsapp(
  toPhone: string,
  firstName: string,
  packageTracking: string,
  uploadUrl: string,
  note?: string | null,
) {
  const noteLine = note ? ` Note: ${note}` : ''
  const body = `Hi ${firstName}, Package Boss needs an invoice for ${packageTracking} to complete customs and your final bill.${noteLine} Upload here: ${uploadUrl}`
  return dispatchWhatsapp(toPhone, body)
}

export async function sendWhatsappText(toPhone: string, body: string) {
  return dispatchWhatsapp(toPhone, body)
}
