import { asc, desc, eq, sql } from 'drizzle-orm'
import { config } from '../config.js'
import { JAMAICA_PARISHES, MAX_DELIVERY_ADDRESSES } from '../constants.js'
import { db } from '../db/index.js'
import { deliveryAddresses, type UserRow } from '../db/schema/index.js'
import { normalizePhone } from './authService.js'
import { userFullName } from '../lib/serializers/user.js'

type DeliveryAddressRow = typeof deliveryAddresses.$inferSelect

function validateParish(parish: string): string {
  const trimmed = parish.trim()
  if (!(JAMAICA_PARISHES as readonly string[]).includes(trimmed)) {
    throw new Error('Invalid parish')
  }
  return trimmed
}

export async function listDeliveryAddresses(customer: UserRow): Promise<DeliveryAddressRow[]> {
  return db
    .select()
    .from(deliveryAddresses)
    .where(eq(deliveryAddresses.customerId, customer.id))
    .orderBy(desc(deliveryAddresses.isDefault), asc(deliveryAddresses.sortOrder), asc(deliveryAddresses.createdAt))
}

async function countDeliveryAddresses(customer: UserRow): Promise<number> {
  const rows = await db
    .select({ id: deliveryAddresses.id })
    .from(deliveryAddresses)
    .where(eq(deliveryAddresses.customerId, customer.id))
  return rows.length
}

export async function getDeliveryAddress(
  customer: UserRow,
  addressId: string,
): Promise<DeliveryAddressRow | null> {
  const [row] = await db
    .select()
    .from(deliveryAddresses)
    .where(eq(deliveryAddresses.id, addressId))
    .limit(1)
  if (!row || row.customerId !== customer.id) return null
  return row
}

async function clearDefault(customerId: string): Promise<void> {
  await db
    .update(deliveryAddresses)
    .set({ isDefault: false })
    .where(eq(deliveryAddresses.customerId, customerId))
}

export async function createDeliveryAddress(
  customer: UserRow,
  data: Record<string, unknown>,
): Promise<DeliveryAddressRow> {
  const count = await countDeliveryAddresses(customer)
  if (count >= MAX_DELIVERY_ADDRESSES) {
    throw new Error(`You can save up to ${MAX_DELIVERY_ADDRESSES} delivery addresses`)
  }

  const label = String(data.label ?? '').trim()
  const line1 = String(data.line1 ?? '').trim()
  const parish = validateParish(String(data.parish ?? ''))
  if (!label) throw new Error('label is required')
  if (!line1) throw new Error('line1 is required')

  let contactNumber: string
  try {
    contactNumber = normalizePhone(String(data.contact_number ?? ''))
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err))
  }

  const isDefault = Boolean(data.is_default)
  if (isDefault) await clearDefault(customer.id)

  const [address] = await db
    .insert(deliveryAddresses)
    .values({
      customerId: customer.id,
      label,
      recipientName: String(data.recipient_name ?? '').trim() || userFullName(customer),
      line1,
      line2: String(data.line2 ?? '').trim() || null,
      community: String(data.community ?? '').trim() || null,
      parish,
      contactNumber,
      deliveryNotes: String(data.delivery_notes ?? '').trim() || null,
      isDefault: isDefault || count === 0,
      sortOrder: count,
    })
    .returning()
  return address!
}

export async function updateDeliveryAddress(
  address: DeliveryAddressRow,
  data: Record<string, unknown>,
): Promise<DeliveryAddressRow> {
  const updates: Partial<typeof deliveryAddresses.$inferInsert> = {}

  if ('label' in data) {
    const label = String(data.label ?? '').trim()
    if (!label) throw new Error('label cannot be empty')
    updates.label = label
  }
  if ('recipient_name' in data) {
    updates.recipientName = String(data.recipient_name ?? '').trim() || null
  }
  if ('line1' in data) {
    const line1 = String(data.line1 ?? '').trim()
    if (!line1) throw new Error('line1 cannot be empty')
    updates.line1 = line1
  }
  if ('line2' in data) updates.line2 = String(data.line2 ?? '').trim() || null
  if ('community' in data) updates.community = String(data.community ?? '').trim() || null
  if ('parish' in data) updates.parish = validateParish(String(data.parish ?? ''))
  if ('contact_number' in data) {
    try {
      updates.contactNumber = normalizePhone(String(data.contact_number ?? ''))
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  }
  if ('delivery_notes' in data) {
    updates.deliveryNotes = String(data.delivery_notes ?? '').trim() || null
  }
  if (data.is_default) {
    await clearDefault(address.customerId)
    updates.isDefault = true
  }

  updates.updatedAt = new Date()
  const [updated] = await db
    .update(deliveryAddresses)
    .set(updates)
    .where(eq(deliveryAddresses.id, address.id))
    .returning()
  return updated!
}

export async function deleteDeliveryAddress(address: DeliveryAddressRow): Promise<void> {
  const wasDefault = address.isDefault
  const customerId = address.customerId
  await db.delete(deliveryAddresses).where(eq(deliveryAddresses.id, address.id))

  if (wasDefault) {
    const [replacement] = await db
      .select()
      .from(deliveryAddresses)
      .where(eq(deliveryAddresses.customerId, customerId))
      .orderBy(asc(deliveryAddresses.sortOrder), asc(deliveryAddresses.createdAt))
      .limit(1)
    if (replacement) {
      await db.update(deliveryAddresses).set({ isDefault: true }).where(eq(deliveryAddresses.id, replacement.id))
    }
  }
}

export async function setDefaultDeliveryAddress(address: DeliveryAddressRow): Promise<DeliveryAddressRow> {
  await clearDefault(address.customerId)
  const [updated] = await db
    .update(deliveryAddresses)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(deliveryAddresses.id, address.id))
    .returning()
  return updated!
}

export function buildInvoiceUploadUrl(packageId: string): string {
  const base = config.frontendUrl.replace(/\/$/, '')
  return `${base}/packages/${packageId}/upload-invoice`
}
