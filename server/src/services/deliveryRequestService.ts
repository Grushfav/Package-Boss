import { and, asc, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import {
  DELIVERY_FEE_JMD,
  DELIVERY_REQUEST_OPEN_STATUSES,
  DELIVERY_REQUEST_STATUS_LABELS,
  PAYMENT_ELIGIBLE_STATUS,
} from '../constants.js'
import { db } from '../db/index.js'
import {
  deliveryAddresses,
  deliveryRequestPackages,
  deliveryRequests,
  packages,
  users,
  type UserRow,
} from '../db/schema/index.js'
import { utcIsoformat } from '../lib/dates.js'
import { deliveryRequestToDict } from '../lib/serializers/deliveryRequest.js'
import { getDeliveryAddress } from './deliveryAddressService.js'
import { addPackageEvent, updatePackageStatus } from './packageService.js'

type DeliveryRequestRow = typeof deliveryRequests.$inferSelect

export async function loadDeliveryRequestDetails(requestId: string) {
  const [request] = await db.select().from(deliveryRequests).where(eq(deliveryRequests.id, requestId)).limit(1)
  if (!request) return null

  const links = await db
    .select()
    .from(deliveryRequestPackages)
    .where(eq(deliveryRequestPackages.deliveryRequestId, request.id))

  const packageLinks = []
  for (const link of links) {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, link.packageId)).limit(1)
    packageLinks.push({ link, pkg: pkg ?? null })
  }

  const [deliveryAddress] = await db
    .select()
    .from(deliveryAddresses)
    .where(eq(deliveryAddresses.id, request.deliveryAddressId))
    .limit(1)

  const [customer] = await db.select().from(users).where(eq(users.id, request.customerId)).limit(1)
  let completedBy = null
  let inProgressBy = null
  if (request.completedById) {
    ;[completedBy] = await db.select().from(users).where(eq(users.id, request.completedById)).limit(1)
  }
  if (request.inProgressById) {
    ;[inProgressBy] = await db.select().from(users).where(eq(users.id, request.inProgressById)).limit(1)
  }

  return {
    request,
    packageLinks,
    deliveryAddress: deliveryAddress ?? null,
    customer: customer ?? null,
    completedBy: completedBy ?? null,
    inProgressBy: inProgressBy ?? null,
  }
}

export async function listPendingCustomerDeliveryRequests(customer: UserRow, limit = 20) {
  const openStatuses = [...DELIVERY_REQUEST_OPEN_STATUSES]
  return db
    .select()
    .from(deliveryRequests)
    .where(and(eq(deliveryRequests.customerId, customer.id), inArray(deliveryRequests.status, openStatuses)))
    .orderBy(desc(deliveryRequests.requestedAt))
    .limit(limit)
}

export async function listPendingDeliveryRequests(limit = 100) {
  return db
    .select()
    .from(deliveryRequests)
    .where(eq(deliveryRequests.status, 'pending'))
    .orderBy(asc(deliveryRequests.requestedAt))
    .limit(limit)
}

export async function listOpenDeliveryRequests(limit = 100) {
  const openStatuses = [...DELIVERY_REQUEST_OPEN_STATUSES]
  return db
    .select()
    .from(deliveryRequests)
    .where(inArray(deliveryRequests.status, openStatuses))
    .orderBy(asc(deliveryRequests.requestedAt))
    .limit(limit)
}

export async function listAllDeliveryRequests(limit = 100) {
  return db
    .select()
    .from(deliveryRequests)
    .orderBy(desc(deliveryRequests.requestedAt))
    .limit(limit)
}

export async function listDeliveryRequestHistory(limit = 100) {
  const openStatuses = [...DELIVERY_REQUEST_OPEN_STATUSES]
  return db
    .select()
    .from(deliveryRequests)
    .where(notInArray(deliveryRequests.status, openStatuses))
    .orderBy(desc(deliveryRequests.requestedAt))
    .limit(limit)
}

export async function listDeliveryRequestsByStatus(status: string, limit = 100) {
  return db
    .select()
    .from(deliveryRequests)
    .where(eq(deliveryRequests.status, status))
    .orderBy(desc(deliveryRequests.requestedAt))
    .limit(limit)
}

export async function countOpenDeliveryRequests(): Promise<number> {
  const openStatuses = [...DELIVERY_REQUEST_OPEN_STATUSES]
  const [row] = await db
    .select({ value: count() })
    .from(deliveryRequests)
    .where(inArray(deliveryRequests.status, openStatuses))
  return row?.value ?? 0
}

export async function listCustomerDeliveryRequests(customer: UserRow, limit = 50) {
  const rows = await db
    .select()
    .from(deliveryRequests)
    .where(eq(deliveryRequests.customerId, customer.id))
    .orderBy(desc(deliveryRequests.requestedAt))
    .limit(limit)

  const result = []
  for (const request of rows) {
    const details = await loadDeliveryRequestDetails(request.id)
    if (!details) continue
    result.push(
      deliveryRequestToDict(details.request, {
        includePackages: true,
        packageLinks: details.packageLinks,
        deliveryAddress: details.deliveryAddress,
        customer: details.customer,
        completedBy: details.completedBy,
        inProgressBy: details.inProgressBy,
      }),
    )
  }
  return result
}

export async function getDeliveryRequest(requestId: string): Promise<DeliveryRequestRow | null> {
  try {
    const [row] = await db.select().from(deliveryRequests).where(eq(deliveryRequests.id, requestId)).limit(1)
    return row ?? null
  } catch {
    return null
  }
}

export async function getActiveRequestForPackage(packageId: string): Promise<DeliveryRequestRow | null> {
  const openStatuses = [...DELIVERY_REQUEST_OPEN_STATUSES]
  const links = await db
    .select({ link: deliveryRequestPackages, request: deliveryRequests })
    .from(deliveryRequestPackages)
    .innerJoin(deliveryRequests, eq(deliveryRequestPackages.deliveryRequestId, deliveryRequests.id))
    .where(
      and(eq(deliveryRequestPackages.packageId, packageId), inArray(deliveryRequests.status, openStatuses)),
    )
    .limit(1)

  return links[0]?.request ?? null
}

export async function packagePendingDeliverySummary(pkg: { id: string }) {
  const request = await getActiveRequestForPackage(pkg.id)
  if (!request) return null
  return {
    id: request.id,
    status: request.status,
    status_label: DELIVERY_REQUEST_STATUS_LABELS[request.status] ?? request.status,
    delivery_fee_jmd: parseFloat(request.deliveryFeeJmd),
    requested_at: utcIsoformat(request.requestedAt),
  }
}

async function validateRequestPackages(customer: UserRow, packageIds: unknown[]): Promise<Array<typeof packages.$inferSelect>> {
  if (!packageIds.length) throw new Error('Select at least one package for delivery')
  if (packageIds.length > 50) throw new Error('Cannot request delivery for more than 50 packages at once')

  const pkgs: Array<typeof packages.$inferSelect> = []
  const seen = new Set<string>()

  for (const rawId of packageIds) {
    const pid = String(rawId)
    if (seen.has(pid)) continue
    seen.add(pid)

    const [pkg] = await db
      .select()
      .from(packages)
      .where(and(eq(packages.id, pid), eq(packages.customerId, customer.id)))
      .limit(1)
    if (!pkg) throw new Error('One or more packages were not found on your account')
    if (pkg.status !== PAYMENT_ELIGIBLE_STATUS) {
      throw new Error(`${pkg.trackingNumber} is not ready for pickup or delivery yet`)
    }
    if (await getActiveRequestForPackage(pkg.id)) {
      throw new Error(`${pkg.trackingNumber} already has an active delivery request`)
    }
    pkgs.push(pkg)
  }

  if (!pkgs.length) throw new Error('Select at least one package for delivery')
  return pkgs
}

export async function createDeliveryRequest(
  customer: UserRow,
  opts: { packageIds: unknown[]; deliveryAddressId: string; notes?: string | null },
) {
  const pkgs = await validateRequestPackages(customer, opts.packageIds)
  const address = await getDeliveryAddress(customer, opts.deliveryAddressId)
  if (!address) throw new Error('Delivery address not found')

  const noteText = (opts.notes ?? '').trim() || null
  if (noteText && noteText.length > 500) throw new Error('notes must be 500 characters or fewer')

  const [request] = await db
    .insert(deliveryRequests)
    .values({
      customerId: customer.id,
      deliveryAddressId: address.id,
      status: 'pending',
      deliveryFeeJmd: DELIVERY_FEE_JMD,
      notes: noteText,
      requestedAt: new Date(),
    })
    .returning()

  for (const pkg of pkgs) {
    await db.insert(deliveryRequestPackages).values({
      deliveryRequestId: request!.id,
      packageId: pkg.id,
    })
    await db
      .update(packages)
      .set({ deliveryAddressId: address.id, updatedAt: new Date() })
      .where(eq(packages.id, pkg.id))
    await addPackageEvent(pkg, pkg.status, `Delivery requested to ${address.label}`)
  }

  const details = await loadDeliveryRequestDetails(request!.id)
  return deliveryRequestToDict(details!.request, {
    includePackages: true,
    packageLinks: details!.packageLinks,
    deliveryAddress: details!.deliveryAddress,
    customer: details!.customer,
    completedBy: details!.completedBy,
    inProgressBy: details!.inProgressBy,
  })
}

export async function cancelDeliveryRequest(request: DeliveryRequestRow, byCustomer = true) {
  if (byCustomer && request.status !== 'pending') {
    throw new Error('Only pending delivery requests can be cancelled')
  }
  if (!byCustomer && !(DELIVERY_REQUEST_OPEN_STATUSES as readonly string[]).includes(request.status)) {
    throw new Error('Only open delivery requests can be cancelled')
  }

  await db
    .update(deliveryRequests)
    .set({ status: 'cancelled', cancelledAt: new Date() })
    .where(eq(deliveryRequests.id, request.id))

  const links = await db
    .select()
    .from(deliveryRequestPackages)
    .where(eq(deliveryRequestPackages.deliveryRequestId, request.id))

  for (const link of links) {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, link.packageId)).limit(1)
    if (pkg) await addPackageEvent(pkg, pkg.status, 'Delivery request cancelled')
  }

  const details = await loadDeliveryRequestDetails(request.id)
  return deliveryRequestToDict(details!.request, {
    includePackages: true,
    packageLinks: details!.packageLinks,
    deliveryAddress: details!.deliveryAddress,
    customer: details!.customer,
    completedBy: details!.completedBy,
    inProgressBy: details!.inProgressBy,
  })
}

async function validateRequestPackagesForPayment(customer: UserRow, packageIds: unknown[]) {
  if (!packageIds.length) throw new Error('Select at least one package')

  const pkgs: Array<typeof packages.$inferSelect> = []
  const seen = new Set<string>()

  for (const rawId of packageIds) {
    const pid = String(rawId)
    if (seen.has(pid)) continue
    seen.add(pid)

    const [pkg] = await db
      .select()
      .from(packages)
      .where(and(eq(packages.id, pid), eq(packages.customerId, customer.id)))
      .limit(1)
    if (!pkg) throw new Error('One or more packages were not found on your account')
    if (pkg.billingStatus === 'paid') throw new Error(`${pkg.trackingNumber} is already paid`)
    if (pkg.status !== PAYMENT_ELIGIBLE_STATUS || pkg.billingStatus !== 'ready') {
      throw new Error(`${pkg.trackingNumber} is not ready for payment yet`)
    }
    if (pkg.totalDueJmd == null) throw new Error(`${pkg.trackingNumber} has no bill amount`)
    pkgs.push(pkg)
  }
  return pkgs
}

export async function resolveDeliveryRequestForPayment(
  customer: UserRow,
  pkgs: Array<typeof packages.$inferSelect>,
): Promise<[DeliveryRequestRow | null, number]> {
  if (!pkgs.length) return [null, 0]

  const requestIds = new Set<string>()
  for (const pkg of pkgs) {
    const request = await getActiveRequestForPackage(pkg.id)
    if (request) {
      if (request.customerId !== customer.id) throw new Error('Invalid delivery request for customer')
      requestIds.add(request.id)
    }
  }

  if (!requestIds.size) return [null, 0]
  if (requestIds.size > 1) throw new Error('Selected packages belong to different delivery requests')

  const requestId = [...requestIds][0]!
  const request = await getDeliveryRequest(requestId)
  if (!request || !(DELIVERY_REQUEST_OPEN_STATUSES as readonly string[]).includes(request.status)) {
    throw new Error('Delivery request is no longer active')
  }

  const links = await db
    .select()
    .from(deliveryRequestPackages)
    .where(eq(deliveryRequestPackages.deliveryRequestId, request.id))

  const requestPackageIds = new Set(links.map((l) => l.packageId))
  const checkoutPackageIds = new Set(pkgs.map((p) => p.id))
  if (requestPackageIds.size !== checkoutPackageIds.size || ![...requestPackageIds].every((id) => checkoutPackageIds.has(id))) {
    throw new Error('All packages in a delivery request must be paid together')
  }

  return [request, parseFloat(request.deliveryFeeJmd)]
}

export async function markDeliveryRequestInProgress(request: DeliveryRequestRow, staffUser: UserRow) {
  if (request.status !== 'pending') {
    throw new Error('Only pending delivery requests can be marked in progress')
  }

  await db
    .update(deliveryRequests)
    .set({
      status: 'in_progress',
      inProgressAt: new Date(),
      inProgressById: staffUser.id,
    })
    .where(eq(deliveryRequests.id, request.id))

  const links = await db
    .select()
    .from(deliveryRequestPackages)
    .where(eq(deliveryRequestPackages.deliveryRequestId, request.id))

  for (const link of links) {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, link.packageId)).limit(1)
    if (pkg) await addPackageEvent(pkg, pkg.status, 'Delivery in progress')
  }

  const [updated] = await db.select().from(deliveryRequests).where(eq(deliveryRequests.id, request.id)).limit(1)
  return updated!
}

export async function completeDeliveryRequest(request: DeliveryRequestRow, staffUser: UserRow) {
  if (!(DELIVERY_REQUEST_OPEN_STATUSES as readonly string[]).includes(request.status)) {
    throw new Error('Only open delivery requests can be completed')
  }

  const links = await db
    .select()
    .from(deliveryRequestPackages)
    .where(eq(deliveryRequestPackages.deliveryRequestId, request.id))

  const unpaid: string[] = []
  for (const link of links) {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, link.packageId)).limit(1)
    if (pkg && pkg.billingStatus !== 'paid') unpaid.push(pkg.trackingNumber)
  }
  if (unpaid.length) {
    throw new Error(`Payment required before delivery: ${unpaid.join(', ')}`)
  }

  for (const link of links) {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, link.packageId)).limit(1)
    if (!pkg || pkg.status === 'delivered') continue
    await updatePackageStatus(pkg, 'delivered', 'Delivery completed')
  }

  await db
    .update(deliveryRequests)
    .set({
      status: 'completed',
      completedAt: new Date(),
      completedById: staffUser.id,
    })
    .where(eq(deliveryRequests.id, request.id))

  const [updated] = await db.select().from(deliveryRequests).where(eq(deliveryRequests.id, request.id)).limit(1)
  return updated!
}

export async function computePaymentTotalWithDelivery(customer: UserRow, packageIds: unknown[]) {
  const pkgs = await validateRequestPackagesForPayment(customer, packageIds)
  let packagesTotal = 0
  for (const pkg of pkgs) {
    if (pkg.totalDueJmd != null) packagesTotal += parseFloat(pkg.totalDueJmd)
  }

  const [request, deliveryFee] = await resolveDeliveryRequestForPayment(customer, pkgs)
  const total = Math.round((packagesTotal + deliveryFee) * 100) / 100

  return {
    packages_total_jmd: packagesTotal,
    delivery_fee_jmd: deliveryFee,
    delivery_request_id: request?.id ?? null,
    total_jmd: total,
    currency: 'JMD',
  }
}
