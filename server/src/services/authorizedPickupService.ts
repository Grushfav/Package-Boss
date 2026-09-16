import { asc, eq, sql } from 'drizzle-orm'
import { MAX_AUTHORIZED_PICKUPS, PICKUP_ID_TYPES } from '../constants.js'
import { db } from '../db/index.js'
import { authorizedPickupPersons, type UserRow } from '../db/schema/index.js'
import { normalizePhone } from './authService.js'

type AuthorizedPickupRow = typeof authorizedPickupPersons.$inferSelect

export async function listAuthorizedPickups(customer: UserRow): Promise<AuthorizedPickupRow[]> {
  return db
    .select()
    .from(authorizedPickupPersons)
    .where(eq(authorizedPickupPersons.customerId, customer.id))
    .orderBy(asc(authorizedPickupPersons.sortOrder), asc(authorizedPickupPersons.createdAt))
}

async function countAuthorizedPickups(customer: UserRow): Promise<number> {
  const rows = await db
    .select({ id: authorizedPickupPersons.id })
    .from(authorizedPickupPersons)
    .where(eq(authorizedPickupPersons.customerId, customer.id))
  return rows.length
}

export async function getAuthorizedPickup(
  customer: UserRow,
  pickupId: string,
): Promise<AuthorizedPickupRow | null> {
  const [row] = await db
    .select()
    .from(authorizedPickupPersons)
    .where(eq(authorizedPickupPersons.id, pickupId))
    .limit(1)
  if (!row || row.customerId !== customer.id) return null
  return row
}

function validateIdType(value: string): string {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!(PICKUP_ID_TYPES as readonly string[]).includes(normalized)) {
    throw new Error('Invalid ID type')
  }
  return normalized
}

export async function createAuthorizedPickup(
  customer: UserRow,
  data: Record<string, unknown>,
): Promise<AuthorizedPickupRow> {
  const count = await countAuthorizedPickups(customer)
  if (count >= MAX_AUTHORIZED_PICKUPS) {
    throw new Error(`You can save up to ${MAX_AUTHORIZED_PICKUPS} authorized pickup persons`)
  }

  const fullName = String(data.full_name ?? '').trim()
  if (!fullName) throw new Error('Full name is required')

  const [pickup] = await db
    .insert(authorizedPickupPersons)
    .values({
      customerId: customer.id,
      fullName,
      relationship: 'other',
      contactNumber: normalizePhone(String(data.contact_number ?? '')),
      idType: validateIdType(String(data.id_type ?? '')),
      notes: String(data.notes ?? '').trim() || null,
      sortOrder: count,
    })
    .returning()
  return pickup!
}

export async function updateAuthorizedPickup(
  pickup: AuthorizedPickupRow,
  data: Record<string, unknown>,
): Promise<AuthorizedPickupRow> {
  const updates: Partial<typeof authorizedPickupPersons.$inferInsert> = {}

  if ('full_name' in data) {
    const fullName = String(data.full_name ?? '').trim()
    if (!fullName) throw new Error('Full name cannot be empty')
    updates.fullName = fullName
  }
  if ('contact_number' in data) {
    updates.contactNumber = normalizePhone(String(data.contact_number ?? ''))
  }
  if ('id_type' in data) {
    updates.idType = validateIdType(String(data.id_type ?? ''))
  }
  if ('notes' in data) {
    updates.notes = String(data.notes ?? '').trim() || null
  }

  updates.updatedAt = new Date()
  const [updated] = await db
    .update(authorizedPickupPersons)
    .set(updates)
    .where(eq(authorizedPickupPersons.id, pickup.id))
    .returning()
  return updated!
}

export async function deleteAuthorizedPickup(pickup: AuthorizedPickupRow): Promise<void> {
  await db.delete(authorizedPickupPersons).where(eq(authorizedPickupPersons.id, pickup.id))
}
