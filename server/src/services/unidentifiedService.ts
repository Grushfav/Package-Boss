import { and, asc, count, eq, ilike, inArray, ne, or } from 'drizzle-orm'

import { UNIDENTIFIED_HOLDER_EMAIL, UNIDENTIFIED_HOLDER_SHIPPING_ID } from '../constants.js'
import { db } from '../db/index.js'
import { packages, users } from '../db/schema/index.js'
import type { UserRow } from '../db/schema/index.js'
import { hashPassword } from './werkzeugPassword.js'

export function isUnidentifiedHolder(user: UserRow | null | undefined): boolean {
  return Boolean(user && user.shippingId === UNIDENTIFIED_HOLDER_SHIPPING_ID)
}

export async function ensureUnidentifiedHolder(): Promise<UserRow> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.shippingId, UNIDENTIFIED_HOLDER_SHIPPING_ID))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(users)
    .values({
      email: UNIDENTIFIED_HOLDER_EMAIL,
      passwordHash: hashPassword('not-a-login-account'),
      firstName: 'Unidentified',
      lastName: 'Packages',
      contactNumber: '+18760000000',
      parish: 'Kingston',
      shippingId: UNIDENTIFIED_HOLDER_SHIPPING_ID,
      role: 'customer',
    })
    .returning()

  return created
}

export function customerQueryConditions() {
  return { role: 'customer' as const, excludeShippingId: UNIDENTIFIED_HOLDER_SHIPPING_ID }
}

export function customerUsersWhere() {
  return and(eq(users.role, 'customer'), ne(users.shippingId, UNIDENTIFIED_HOLDER_SHIPPING_ID))
}

export async function findCustomerByShippingId(shippingId: string): Promise<UserRow | null> {
  const normalized = shippingId.trim().toUpperCase()
  const [user] = await db
    .select()
    .from(users)
    .where(and(customerUsersWhere(), eq(users.shippingId, normalized)))
    .limit(1)
  return user ?? null
}

export async function listCustomers(options: {
  q?: string
  limit?: number
  offset?: number
}): Promise<[UserRow[], number]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 100))
  const offset = Math.max(0, options.offset ?? 0)
  const q = (options.q ?? '').trim()

  const conditions = [customerUsersWhere()]
  if (q) {
    const pattern = `%${q}%`
    const shippingPattern = `%${q.toUpperCase()}%`
    conditions.push(
      or(
        ilike(users.shippingId, shippingPattern),
        ilike(users.firstName, pattern),
        ilike(users.lastName, pattern),
        ilike(users.email, pattern),
        ilike(users.contactNumber, pattern),
      )!,
    )
  }

  const where = and(...conditions)
  const [totalRow] = await db.select({ value: count() }).from(users).where(where)
  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(asc(users.lastName), asc(users.firstName), asc(users.shippingId))
    .limit(limit)
    .offset(offset)

  return [rows, Number(totalRow?.value ?? 0)]
}

export async function searchCustomers(q: string, limit = 15): Promise<UserRow[]> {
  const trimmed = q.trim()
  if (trimmed.length < 2) return []

  const pattern = `%${trimmed}%`
  const shippingPattern = `%${trimmed.toUpperCase()}%`

  return db
    .select()
    .from(users)
    .where(
      and(
        customerUsersWhere(),
        or(
          ilike(users.shippingId, shippingPattern),
          ilike(users.firstName, pattern),
          ilike(users.lastName, pattern),
          ilike(users.email, pattern),
          ilike(users.contactNumber, pattern),
        ),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName))
    .limit(limit)
}

export async function activePackageCountsByCustomerIds(
  userIds: string[],
): Promise<Map<string, number>> {
  if (!userIds.length) return new Map()

  const rows = await db
    .select({ customerId: packages.customerId, value: count() })
    .from(packages)
    .where(and(inArray(packages.customerId, userIds), ne(packages.status, 'delivered')))
    .groupBy(packages.customerId)

  return new Map(rows.map((row) => [row.customerId, Number(row.value)]))
}
