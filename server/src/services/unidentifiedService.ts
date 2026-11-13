import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  ne,
  notExists,
  or,
  sql,
} from 'drizzle-orm'

import {
  DELIVERY_REQUEST_OPEN_STATUSES,
  UNIDENTIFIED_HOLDER_EMAIL,
  UNIDENTIFIED_HOLDER_SHIPPING_ID,
  WORKFLOW_STATUSES,
} from '../constants.js'
import { db } from '../db/index.js'
import { deliveryRequests, packages, users } from '../db/schema/index.js'
import type { UserRow } from '../db/schema/index.js'
import { hashPassword } from './werkzeugPassword.js'

export type CustomerActivePackagesFilter = 'any' | 'has' | 'none'

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
      isActive: true,
      mustSetPassword: false,
      tokenVersion: 0,
      whatsappOptIn: false,
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
  packageStatus?: string | null
  activePackages?: CustomerActivePackagesFilter | null
  openRequest?: boolean | null
}): Promise<[UserRow[], number]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 100))
  const offset = Math.max(0, options.offset ?? 0)
  const q = (options.q ?? '').trim()
  const packageStatus = (options.packageStatus ?? '').trim()
  const activePackages = options.activePackages ?? 'any'
  const openRequest = Boolean(options.openRequest)

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
        ilike(users.companyName, pattern),
      )!,
    )
  }

  if (packageStatus) {
    if (!(WORKFLOW_STATUSES as readonly string[]).includes(packageStatus)) {
      throw new Error('Invalid package_status')
    }
    conditions.push(
      exists(
        db
          .select({ id: packages.id })
          .from(packages)
          .where(and(eq(packages.customerId, users.id), eq(packages.status, packageStatus))),
      ),
    )
  }

  if (activePackages === 'has') {
    conditions.push(
      exists(
        db
          .select({ id: packages.id })
          .from(packages)
          .where(and(eq(packages.customerId, users.id), ne(packages.status, 'delivered'))),
      ),
    )
  } else if (activePackages === 'none') {
    conditions.push(
      notExists(
        db
          .select({ id: packages.id })
          .from(packages)
          .where(and(eq(packages.customerId, users.id), ne(packages.status, 'delivered'))),
      ),
    )
  }

  if (openRequest) {
    conditions.push(
      exists(
        db
          .select({ id: deliveryRequests.id })
          .from(deliveryRequests)
          .where(
            and(
              eq(deliveryRequests.customerId, users.id),
              inArray(deliveryRequests.status, [...DELIVERY_REQUEST_OPEN_STATUSES]),
            ),
          ),
      ),
    )
  }

  const where = and(...conditions)
  const [totalRow] = await db.select({ value: count() }).from(users).where(where)

  const activeCountSq = db
    .select({
      customerId: packages.customerId,
      activeCount: count().as('active_count'),
    })
    .from(packages)
    .where(ne(packages.status, 'delivered'))
    .groupBy(packages.customerId)
    .as('active_pkg_counts')

  // Most active packages first (warehouse traffic), then name.
  const rows = await db
    .select({ user: users })
    .from(users)
    .leftJoin(activeCountSq, eq(users.id, activeCountSq.customerId))
    .where(where)
    .orderBy(
      desc(sql`coalesce(${activeCountSq.activeCount}, 0)`),
      asc(users.lastName),
      asc(users.firstName),
      asc(users.shippingId),
    )
    .limit(limit)
    .offset(offset)

  return [rows.map((r) => r.user), Number(totalRow?.value ?? 0)]
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
          ilike(users.companyName, pattern),
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
