import { and, asc, count, desc, eq, inArray, like, notInArray } from 'drizzle-orm'
import { validate as validateUuid } from 'uuid'
import {
  LOGISTICS_DELIVERY_SPEEDS,
  LOGISTICS_ENABLED_PAYMENT_METHODS,
  LOGISTICS_IN_HOUSE_FEE_JMD,
  LOGISTICS_IN_HOUSE_PARISHES,
  LOGISTICS_ISLAND_FEE_JMD,
  LOGISTICS_ITEM_CATEGORIES,
  LOGISTICS_ITEM_CATEGORY_LABELS,
  LOGISTICS_JOB_OPEN_STATUSES,
  LOGISTICS_PAYMENT_METHODS,
  LOGISTICS_VEHICLE_TYPES,
} from '../constants.js'
import { db } from '../db/index.js'
import {
  deliveryAddresses,
  logisticsJobs,
  users,
  type UserRow,
} from '../db/schema/index.js'
import { logisticsJobToDict } from '../lib/serializers/logisticsJob.js'
import { userFullName } from '../lib/user.js'
import { normalizePhone } from './authService.js'
import { createDeliveryAddress, getDeliveryAddress } from './deliveryAddressService.js'

type LogisticsJobRow = typeof logisticsJobs.$inferSelect
type DeliveryAddressRow = typeof deliveryAddresses.$inferSelect

const OPEN_STATUSES = [...LOGISTICS_JOB_OPEN_STATUSES]

export async function serializeJob(job: LogisticsJobRow): Promise<Record<string, unknown>> {
  const userIds = [
    job.customerId,
    job.inProgressById,
    job.pickedUpById,
    job.inTransitById,
    job.driverConfirmedById,
    job.completedById,
    job.assignedClerkId,
    job.assignedById,
    job.rejectedById,
  ].filter((id): id is string => Boolean(id))

  const relatedUsers =
    userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, [...new Set(userIds)]))
      : []
  const userById = new Map(relatedUsers.map((u) => [u.id, u]))

  const addressIds = [job.pickupAddressId, job.dropoffAddressId]
  const relatedAddresses = await db
    .select()
    .from(deliveryAddresses)
    .where(inArray(deliveryAddresses.id, addressIds))
  const addressById = new Map(relatedAddresses.map((a) => [a.id, a]))

  return logisticsJobToDict(job, {
    customer: userById.get(job.customerId) ?? null,
    pickupAddress: addressById.get(job.pickupAddressId) ?? null,
    dropoffAddress: addressById.get(job.dropoffAddressId) ?? null,
    assignedClerk: job.assignedClerkId ? userById.get(job.assignedClerkId) ?? null : null,
    assignedBy: job.assignedById ? userById.get(job.assignedById) ?? null : null,
    rejectedBy: job.rejectedById ? userById.get(job.rejectedById) ?? null : null,
    inProgressBy: job.inProgressById ? userById.get(job.inProgressById) ?? null : null,
    pickedUpBy: job.pickedUpById ? userById.get(job.pickedUpById) ?? null : null,
    inTransitBy: job.inTransitById ? userById.get(job.inTransitById) ?? null : null,
    completedBy: job.completedById ? userById.get(job.completedById) ?? null : null,
  })
}

async function nextReference(): Promise<string> {
  const prefix = 'LD'
  const [latest] = await db
    .select()
    .from(logisticsJobs)
    .where(like(logisticsJobs.reference, `${prefix}-%`))
    .orderBy(desc(logisticsJobs.requestedAt))
    .limit(1)

  let seq: number
  if (latest?.reference.startsWith(`${prefix}-`)) {
    try {
      seq = Number.parseInt(latest.reference.split('-', 2)[1] ?? '', 10) + 1
      if (!Number.isFinite(seq)) throw new Error('bad seq')
    } catch {
      const [total] = await db.select({ value: count() }).from(logisticsJobs)
      seq = (total?.value ?? 0) + 1
    }
  } else {
    const [total] = await db.select({ value: count() }).from(logisticsJobs)
    seq = (total?.value ?? 0) + 1
  }
  return `${prefix}-${String(seq).padStart(5, '0')}`
}

async function resolveAddress(
  customer: UserRow,
  opts: {
    addressId?: string | null
    addressData?: Record<string, unknown> | null
    defaultLabel: string
  },
): Promise<DeliveryAddressRow> {
  if (opts.addressId) {
    const address = await getDeliveryAddress(customer, String(opts.addressId))
    if (!address) throw new Error(`${opts.defaultLabel} address not found`)
    return address
  }

  if (opts.addressData && typeof opts.addressData === 'object') {
    const payload = { ...opts.addressData }
    if (!String(payload.label ?? '').trim()) {
      payload.label = opts.defaultLabel
    }
    return createDeliveryAddress(customer, payload)
  }

  throw new Error(`${opts.defaultLabel} address is required`)
}

export function estimateLogisticsFee(
  pickupParish: string,
  dropoffParish: string,
): { fee: string | null; feePending: boolean } {
  const pickupInHouse = (LOGISTICS_IN_HOUSE_PARISHES as readonly string[]).includes(pickupParish)
  const dropoffInHouse = (LOGISTICS_IN_HOUSE_PARISHES as readonly string[]).includes(dropoffParish)
  if (pickupInHouse && dropoffInHouse) {
    return { fee: LOGISTICS_IN_HOUSE_FEE_JMD, feePending: false }
  }
  if (pickupInHouse || dropoffInHouse) {
    return { fee: LOGISTICS_ISLAND_FEE_JMD, feePending: false }
  }
  return { fee: null, feePending: true }
}

export async function listCustomerLogisticsJobs(
  customer: UserRow,
  limit = 50,
): Promise<LogisticsJobRow[]> {
  return db
    .select()
    .from(logisticsJobs)
    .where(eq(logisticsJobs.customerId, customer.id))
    .orderBy(desc(logisticsJobs.requestedAt))
    .limit(limit)
}

export async function listPendingLogisticsJobs(limit = 100): Promise<LogisticsJobRow[]> {
  return db
    .select()
    .from(logisticsJobs)
    .where(eq(logisticsJobs.status, 'pending'))
    .orderBy(asc(logisticsJobs.requestedAt))
    .limit(limit)
}

export async function listOpenLogisticsJobs(limit = 100): Promise<LogisticsJobRow[]> {
  return db
    .select()
    .from(logisticsJobs)
    .where(inArray(logisticsJobs.status, OPEN_STATUSES))
    .orderBy(asc(logisticsJobs.requestedAt))
    .limit(limit)
}

export async function listAllLogisticsJobs(limit = 200): Promise<LogisticsJobRow[]> {
  return db
    .select()
    .from(logisticsJobs)
    .orderBy(desc(logisticsJobs.requestedAt))
    .limit(limit)
}

export async function listLogisticsJobHistory(limit = 200): Promise<LogisticsJobRow[]> {
  return db
    .select()
    .from(logisticsJobs)
    .where(notInArray(logisticsJobs.status, OPEN_STATUSES))
    .orderBy(desc(logisticsJobs.requestedAt))
    .limit(limit)
}

export async function listLogisticsJobsByStatus(
  status: string,
  limit = 200,
): Promise<LogisticsJobRow[]> {
  return db
    .select()
    .from(logisticsJobs)
    .where(eq(logisticsJobs.status, status))
    .orderBy(desc(logisticsJobs.requestedAt))
    .limit(limit)
}

export async function countOpenLogisticsJobs(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(logisticsJobs)
    .where(inArray(logisticsJobs.status, OPEN_STATUSES))
  return row?.value ?? 0
}

export async function countClerkOpenLogisticsJobs(clerk: UserRow): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(logisticsJobs)
    .where(
      and(
        eq(logisticsJobs.assignedClerkId, clerk.id),
        inArray(logisticsJobs.status, OPEN_STATUSES),
      ),
    )
  return row?.value ?? 0
}

export async function listClerkLogisticsJobs(
  clerk: UserRow,
  status = 'active',
  limit = 100,
): Promise<LogisticsJobRow[]> {
  const conditions = [eq(logisticsJobs.assignedClerkId, clerk.id)]

  if (status === 'pending') {
    conditions.push(eq(logisticsJobs.status, 'pending'))
  } else if (status === 'active') {
    conditions.push(inArray(logisticsJobs.status, OPEN_STATUSES))
  } else if (status === 'history') {
    conditions.push(notInArray(logisticsJobs.status, OPEN_STATUSES))
  } else if (status !== 'all') {
    conditions.push(eq(logisticsJobs.status, status))
  }

  return db
    .select()
    .from(logisticsJobs)
    .where(and(...conditions))
    .orderBy(asc(logisticsJobs.requestedAt))
    .limit(limit)
}

export async function countPendingLogisticsJobs(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(logisticsJobs)
    .where(eq(logisticsJobs.status, 'pending'))
  return row?.value ?? 0
}

export async function getLogisticsJob(jobId: string): Promise<LogisticsJobRow | null> {
  if (!validateUuid(String(jobId))) return null
  const [row] = await db
    .select()
    .from(logisticsJobs)
    .where(eq(logisticsJobs.id, String(jobId)))
    .limit(1)
  return row ?? null
}

export function resolveItemDescription(opts: {
  itemCategory?: string | null
  itemOtherDetail?: string | null
  itemDescription?: string | null
}): string {
  if (opts.itemCategory) {
    const category = opts.itemCategory.trim().toLowerCase()
    if (!(LOGISTICS_ITEM_CATEGORIES as readonly string[]).includes(category)) {
      throw new Error('Select a valid item category')
    }
    if (category === 'other') {
      const detail = (opts.itemOtherDetail || '').trim()
      if (!detail) throw new Error('Describe the item when selecting Other')
      if (detail.length > 480) {
        throw new Error('Item description must be 500 characters or fewer')
      }
      return `Other — ${detail}`
    }
    return LOGISTICS_ITEM_CATEGORY_LABELS[category]!
  }

  const description = (opts.itemDescription || '').trim()
  if (!description) throw new Error('Item category is required')
  if (description.length > 500) {
    throw new Error('Item description must be 500 characters or fewer')
  }
  return description
}

export function resolveVehicleType(vehicleType: string | null | undefined): string {
  const value = (vehicleType || '').trim().toLowerCase()
  if (!(LOGISTICS_VEHICLE_TYPES as readonly string[]).includes(value)) {
    throw new Error('Select a vehicle size for this delivery')
  }
  return value
}

export function resolveDeliverySpeed(deliverySpeed: string | null | undefined): string {
  const value = (deliverySpeed || 'immediate').trim().toLowerCase()
  if (!(LOGISTICS_DELIVERY_SPEEDS as readonly string[]).includes(value)) {
    throw new Error('Select when you need this delivery')
  }
  return value
}

export function resolvePaymentMethod(paymentMethod: string | null | undefined): string {
  const value = (paymentMethod || 'cash').trim().toLowerCase()
  if (!(LOGISTICS_PAYMENT_METHODS as readonly string[]).includes(value)) {
    throw new Error('Select a payment method')
  }
  if (!(LOGISTICS_ENABLED_PAYMENT_METHODS as readonly string[]).includes(value)) {
    throw new Error('Online payment is not available yet — please choose cash')
  }
  return value
}

export async function createLogisticsJob(
  customer: UserRow,
  opts: {
    pickupAddressId?: string | null
    pickupAddress?: Record<string, unknown> | null
    dropoffAddressId?: string | null
    dropoffAddress?: Record<string, unknown> | null
    itemCategory?: string | null
    itemOtherDetail?: string | null
    itemDescription?: string | null
    vehicleType?: string | null
    deliverySpeed?: string | null
    paymentMethod?: string | null
    weightLbs?: number | string | null
    notes?: string | null
  },
): Promise<LogisticsJobRow> {
  const description = resolveItemDescription({
    itemCategory: opts.itemCategory,
    itemOtherDetail: opts.itemOtherDetail,
    itemDescription: opts.itemDescription,
  })
  const vehicle = resolveVehicleType(opts.vehicleType)
  const speed = resolveDeliverySpeed(opts.deliverySpeed)
  const payMethod = resolvePaymentMethod(opts.paymentMethod)

  const noteText = (opts.notes || '').trim() || null
  if (noteText && noteText.length > 500) {
    throw new Error('notes must be 500 characters or fewer')
  }

  const pickup = await resolveAddress(customer, {
    addressId: opts.pickupAddressId,
    addressData: opts.pickupAddress,
    defaultLabel: 'Pickup',
  })
  const dropoff = await resolveAddress(customer, {
    addressId: opts.dropoffAddressId,
    addressData: opts.dropoffAddress,
    defaultLabel: 'Drop-off',
  })

  if (pickup.id === dropoff.id) {
    throw new Error('Pickup and drop-off must be different addresses')
  }

  let { fee, feePending } = estimateLogisticsFee(pickup.parish, dropoff.parish)
  if (vehicle === 'truck') {
    feePending = true
    fee = null
  }

  const [job] = await db
    .insert(logisticsJobs)
    .values({
      reference: await nextReference(),
      customerId: customer.id,
      pickupAddressId: pickup.id,
      dropoffAddressId: dropoff.id,
      itemDescription: description,
      vehicleType: vehicle,
      deliverySpeed: speed,
      paymentMethod: payMethod,
      weightLbs: null,
      notes: noteText,
      status: 'pending',
      quotedFeeJmd: feePending ? null : fee,
      feePendingQuote: feePending,
      requestedAt: new Date(),
    })
    .returning()

  return job!
}

export async function updateCustomerLogisticsNotes(
  job: LogisticsJobRow,
  customer: UserRow,
  notes: string,
): Promise<LogisticsJobRow> {
  if (job.customerId !== customer.id) {
    throw new Error('Local delivery request not found')
  }
  if (!(OPEN_STATUSES as readonly string[]).includes(job.status)) {
    throw new Error('Notes can only be updated on active deliveries')
  }

  const noteText = (notes || '').trim()
  if (!noteText) throw new Error('Note cannot be empty')
  if (noteText.length > 500) throw new Error('Note must be 500 characters or fewer')

  const [updated] = await db
    .update(logisticsJobs)
    .set({ notes: noteText })
    .where(eq(logisticsJobs.id, job.id))
    .returning()
  return updated!
}

export async function confirmLogisticsDriver(
  job: LogisticsJobRow,
  staffUser: UserRow,
  opts: { driverName: string; driverContactNumber: string },
): Promise<LogisticsJobRow> {
  if (job.status !== 'pending') {
    throw new Error('Driver can only be confirmed on jobs searching for a driver')
  }

  const name = (opts.driverName || '').trim()
  if (!name) throw new Error('Driver name is required')

  let contact: string
  try {
    contact = normalizePhone(opts.driverContactNumber)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err))
  }

  const [updated] = await db
    .update(logisticsJobs)
    .set({
      driverName: name,
      driverContactNumber: contact,
      driverConfirmedAt: new Date(),
      driverConfirmedById: staffUser.id,
    })
    .where(eq(logisticsJobs.id, job.id))
    .returning()
  return updated!
}

async function getActiveClerk(clerkId: unknown): Promise<UserRow> {
  if (!validateUuid(String(clerkId))) {
    throw new Error('Select a valid clerk')
  }

  const [clerk] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, String(clerkId)), eq(users.role, 'clerk')))
    .limit(1)

  if (!clerk || clerk.isActive === false) {
    throw new Error('Clerk not found or inactive')
  }
  if (!(clerk.contactNumber || '').trim()) {
    throw new Error('Clerk must have a contact number before assignment')
  }
  return clerk
}

export async function assignLogisticsClerk(
  job: LogisticsJobRow,
  adminUser: UserRow,
  opts: { clerkId: unknown },
): Promise<LogisticsJobRow> {
  if (job.status !== 'pending') {
    throw new Error('Only pending local delivery requests can be assigned')
  }

  const clerk = await getActiveClerk(opts.clerkId)

  let contact: string
  try {
    contact = normalizePhone(clerk.contactNumber!)
  } catch (err) {
    throw new Error(
      `Clerk contact number is invalid: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const now = new Date()
  await db
    .update(logisticsJobs)
    .set({
      assignedClerkId: clerk.id,
      assignedAt: now,
      assignedById: adminUser.id,
      driverName: userFullName(clerk),
      driverContactNumber: contact,
      driverConfirmedAt: now,
      driverConfirmedById: adminUser.id,
    })
    .where(eq(logisticsJobs.id, job.id))

  return (await getLogisticsJob(job.id)) ?? job
}

export async function rejectLogisticsJob(
  job: LogisticsJobRow,
  adminUser: UserRow,
  opts: { reason?: string | null } = {},
): Promise<LogisticsJobRow> {
  if (job.status !== 'pending') {
    throw new Error('Only pending local delivery requests can be rejected')
  }

  const reasonText = (opts.reason || '').trim() || null
  if (reasonText && reasonText.length > 500) {
    throw new Error('Rejection reason must be 500 characters or fewer')
  }

  const [updated] = await db
    .update(logisticsJobs)
    .set({
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedById: adminUser.id,
      rejectionReason: reasonText,
    })
    .where(eq(logisticsJobs.id, job.id))
    .returning()
  return updated!
}

export async function cancelLogisticsJob(
  job: LogisticsJobRow,
  opts: { byCustomer?: boolean } = {},
): Promise<LogisticsJobRow> {
  const byCustomer = opts.byCustomer !== false
  if (byCustomer && job.status !== 'pending') {
    throw new Error('Only pending jobs can be cancelled')
  }
  if (!byCustomer && !(OPEN_STATUSES as readonly string[]).includes(job.status)) {
    throw new Error('Only open jobs can be cancelled')
  }

  const [updated] = await db
    .update(logisticsJobs)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
    })
    .where(eq(logisticsJobs.id, job.id))
    .returning()
  return updated!
}

export async function markLogisticsJobPickedUp(
  job: LogisticsJobRow,
  staffUser: UserRow,
): Promise<LogisticsJobRow> {
  if (job.status !== 'pending') {
    throw new Error('Only jobs searching for a driver can be marked picked up')
  }

  const [updated] = await db
    .update(logisticsJobs)
    .set({
      status: 'picked_up',
      pickedUpAt: new Date(),
      pickedUpById: staffUser.id,
    })
    .where(eq(logisticsJobs.id, job.id))
    .returning()
  return updated!
}

export async function markLogisticsJobInTransit(
  job: LogisticsJobRow,
  staffUser: UserRow,
): Promise<LogisticsJobRow> {
  if (job.status !== 'picked_up') {
    throw new Error('Only picked-up jobs can be marked in transit')
  }

  const [updated] = await db
    .update(logisticsJobs)
    .set({
      status: 'in_transit',
      inTransitAt: new Date(),
      inTransitById: staffUser.id,
    })
    .where(eq(logisticsJobs.id, job.id))
    .returning()
  return updated!
}

export async function completeLogisticsJob(
  job: LogisticsJobRow,
  staffUser: UserRow,
): Promise<LogisticsJobRow> {
  if (job.status !== 'in_transit') {
    throw new Error('Only in-transit jobs can be completed')
  }

  const [updated] = await db
    .update(logisticsJobs)
    .set({
      status: 'completed',
      completedAt: new Date(),
      completedById: staffUser.id,
    })
    .where(eq(logisticsJobs.id, job.id))
    .returning()
  return updated!
}

export async function confirmCustomerLogisticsReceipt(
  job: LogisticsJobRow,
  customer: UserRow,
): Promise<LogisticsJobRow> {
  if (job.customerId !== customer.id) {
    throw new Error('Local delivery request not found')
  }
  if (job.status !== 'completed') {
    throw new Error('Receipt can only be confirmed after delivery')
  }
  if (job.customerReceiptConfirmedAt) {
    throw new Error('Receipt already confirmed')
  }

  const [updated] = await db
    .update(logisticsJobs)
    .set({ customerReceiptConfirmedAt: new Date() })
    .where(eq(logisticsJobs.id, job.id))
    .returning()
  return updated!
}
