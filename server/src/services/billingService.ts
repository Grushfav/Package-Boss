import { eq, sql } from 'drizzle-orm'
import { BILLING_STATUSES, INVOICE_REQUEST_CHANNELS } from '../constants.js'
import { packages, users, type UserRow } from '../db/schema/index.js'
import { db } from '../db/index.js'
import { computeTotalDue } from './billingCalculations.js'
import { buildInvoiceUploadUrl, getDeliveryAddress } from './deliveryAddressService.js'
import { EmailServiceError, sendInvoiceRequestEmail } from './emailService.js'
import { isValidInvoiceReference } from './imageUploadService.js'
import { addPackageEvent } from './packageService.js'
import { WhatsAppServiceError, sendInvoiceRequestWhatsapp } from './whatsappService.js'

type PackageRow = typeof packages.$inferSelect

function decimal(value: unknown): string | null {
  if (value == null) return null
  return (Math.round(parseFloat(String(value)) * 100) / 100).toFixed(2)
}

export async function updatePackageBilling(
  pkg: PackageRow,
  opts: {
    estimatedFreightJmd?: number | null
    dutiesJmd?: number | null
    handlingJmd?: number | null
    otherFeesJmd?: number | null
    declaredValueUsd?: number | null
    billingStatus?: string | null
    publish?: boolean
  },
): Promise<PackageRow> {
  const updates: Partial<typeof packages.$inferInsert> = { updatedAt: new Date() }

  if (opts.estimatedFreightJmd != null) updates.estimatedFreightJmd = decimal(opts.estimatedFreightJmd)
  if (opts.dutiesJmd != null) updates.dutiesJmd = decimal(opts.dutiesJmd)
  if (opts.handlingJmd != null) updates.handlingJmd = decimal(opts.handlingJmd)
  if (opts.otherFeesJmd != null) updates.otherFeesJmd = decimal(opts.otherFeesJmd)
  if (opts.declaredValueUsd != null) updates.declaredValueUsd = decimal(opts.declaredValueUsd)

  const freight =
    opts.estimatedFreightJmd != null
      ? parseFloat(decimal(opts.estimatedFreightJmd)!)
      : pkg.estimatedFreightJmd != null
        ? parseFloat(pkg.estimatedFreightJmd)
        : null
  const duties =
    opts.dutiesJmd != null
      ? parseFloat(decimal(opts.dutiesJmd)!)
      : pkg.dutiesJmd != null
        ? parseFloat(pkg.dutiesJmd)
        : null
  const handling =
    opts.handlingJmd != null
      ? parseFloat(decimal(opts.handlingJmd)!)
      : pkg.handlingJmd != null
        ? parseFloat(pkg.handlingJmd)
        : null
  const other =
    opts.otherFeesJmd != null
      ? parseFloat(decimal(opts.otherFeesJmd)!)
      : pkg.otherFeesJmd != null
        ? parseFloat(pkg.otherFeesJmd)
        : null

  const totalDue = computeTotalDue(freight, duties, handling, other)
  if (totalDue != null) updates.totalDueJmd = totalDue.toFixed(2)

  if (opts.publish) {
    if (pkg.status !== 'ready_for_pickup') {
      throw new Error(
        'Bills publish when a package is marked ready for pickup. For packages in customs, use Release & bill.',
      )
    }
    if (totalDue == null) {
      throw new Error('Set at least freight or fee amounts before publishing a bill')
    }
    updates.billingStatus = 'ready'
  } else if (opts.billingStatus) {
    if (!(BILLING_STATUSES as readonly string[]).includes(opts.billingStatus)) {
      throw new Error('Invalid billing status')
    }
    updates.billingStatus = opts.billingStatus
  }

  const [updated] = await db.update(packages).set(updates).where(eq(packages.id, pkg.id)).returning()
  return updated!
}

export async function requestPackageInvoice(
  pkg: PackageRow,
  channel: string,
  note?: string | null,
): Promise<Record<string, unknown>> {
  if (!(INVOICE_REQUEST_CHANNELS as readonly string[]).includes(channel)) {
    throw new Error('channel must be email, whatsapp, or both')
  }
  if (pkg.status === 'unidentified') {
    throw new Error('Assign package to a customer before requesting an invoice')
  }

  const [customer] = await db.select().from(users).where(eq(users.id, pkg.customerId)).limit(1)
  if (!customer) throw new Error('Package customer not found')

  const uploadUrl = buildInvoiceUploadUrl(pkg.id)
  const channelsSent: string[] = []
  let emailResult: Record<string, unknown> | null = null

  if (channel === 'email' || channel === 'both') {
    try {
      emailResult = await sendInvoiceRequestEmail(
        customer.email,
        customer.firstName,
        pkg.trackingNumber,
        uploadUrl,
        note,
      )
      if (emailResult != null) channelsSent.push('email')
    } catch (err) {
      if (err instanceof EmailServiceError || err instanceof Error) {
        throw new Error(`Failed to send invoice email: ${err.message}`)
      }
      throw err
    }
  }

  if (channel === 'whatsapp' || channel === 'both') {
    if (customer.whatsappOptIn) {
      try {
        await sendInvoiceRequestWhatsapp(
          customer.contactNumber,
          customer.firstName,
          pkg.trackingNumber,
          uploadUrl,
          note,
        )
        channelsSent.push('whatsapp')
      } catch (err) {
        if (channel === 'whatsapp') {
          const message = err instanceof WhatsAppServiceError || err instanceof Error ? err.message : String(err)
          throw new Error(`Failed to send WhatsApp message: ${message}`)
        }
        console.warn(`WhatsApp invoice request skipped for ${pkg.trackingNumber}:`, err)
      }
    } else if (channel === 'whatsapp') {
      throw new Error('Customer has not opted in to WhatsApp notifications')
    }
  }

  if (!channelsSent.length) {
    throw new Error(
      'Could not deliver the invoice request. Customer email notifications may be disabled by admin, or WhatsApp is unavailable.',
    )
  }

  const noteText = (note ?? '').trim() || null
  const [updated] = await db
    .update(packages)
    .set({
      invoiceStatus: 'requested',
      invoiceRequestedAt: new Date(),
      invoiceRequestedVia: channel,
      invoiceRequestNote: noteText,
      updatedAt: sql`now()`,
    })
    .where(eq(packages.id, pkg.id))
    .returning()

  await addPackageEvent(
    updated!,
    updated!.status,
    `Invoice requested via ${channel}${noteText ? ` — ${noteText}` : ''}`,
  )

  return {
    channels_sent: channelsSent,
    invoice_status: updated!.invoiceStatus,
    email_recipient: channelsSent.includes('email') ? customer.email : null,
    email_request_id: emailResult?.requestId ?? null,
  }
}

export async function attachPackageInvoice(
  pkg: PackageRow,
  invoiceObjectKey: string,
  declaredValueUsd: number | null | undefined,
  customer: UserRow,
): Promise<PackageRow> {
  if (!isValidInvoiceReference(invoiceObjectKey, customer.shippingId)) {
    throw new Error('Invalid invoice object key')
  }

  const updates: Partial<typeof packages.$inferInsert> = {
    invoiceObjectKey,
    invoiceStatus: 'received',
    invoiceReceivedAt: new Date(),
    updatedAt: new Date(),
  }
  if (declaredValueUsd != null) {
    updates.declaredValueUsd = decimal(declaredValueUsd)
  }

  const [updated] = await db.update(packages).set(updates).where(eq(packages.id, pkg.id)).returning()
  await addPackageEvent(updated!, updated!.status, 'Customer uploaded invoice')
  return updated!
}

export async function assignDeliveryAddress(
  pkg: PackageRow,
  addressId: string,
  customer: UserRow,
): Promise<PackageRow> {
  const address = await getDeliveryAddress(customer, addressId)
  if (!address) throw new Error('Delivery address not found')

  const [updated] = await db
    .update(packages)
    .set({ deliveryAddressId: address.id, updatedAt: sql`now()` })
    .where(eq(packages.id, pkg.id))
    .returning()
  return updated!
}
