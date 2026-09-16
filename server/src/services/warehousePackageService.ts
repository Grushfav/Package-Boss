import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lte,
  ne,
  sql,
} from 'drizzle-orm'

import {
  BANK_TRANSFER_PROOF_OPEN_STATUSES,
  DELIVERY_REQUEST_OPEN_STATUSES,
  LABEL_EDITABLE_STATUSES,
  SHIPPER_CODES,
  SHIPPER_LABELS,
  STATUS_LABELS,
  UNIDENTIFIED_HOLDER_SHIPPING_ID,
  UPDATABLE_STATUSES,
  WORKFLOW_STATUSES,
  WORKFLOW_TRANSITIONS,
} from '../constants.js'
import { db } from '../db/index.js'
import {
  auditLogs,
  bankTransferProofPackages,
  bankTransferProofs,
  deliveryAddresses,
  deliveryRequestPackages,
  deliveryRequests,
  packageEvents,
  packagePhotos,
  packages,
  preAlerts,
  receiveBatches,
  shipments,
  users,
  type UserRow,
} from '../db/schema/index.js'
import { utcIsoformat } from '../lib/dates.js'
import {
  packageToDict,
  warehousePackageListToDict as warehousePackageListToDictSerializer,
  warehousePackageToDict as warehousePackageToDictSerializer,
} from '../lib/serializers/package.js'
import { userFullName } from '../lib/serializers/user.js'
import {
  ACTION_PACKAGE_RECEIVED,
  ACTION_PACKAGE_RECEIVED_UNIDENTIFIED,
} from './auditService.js'
import { countOpenTransferProofs } from './bankTransferProofService.js'
import { publishReadyForPickupBill } from './billingCalculations.js'
import { countOpenDeliveryRequests } from './deliveryRequestService.js'
import { EmailServiceError, sendPackageStatusEmail } from './emailService.js'
import { isValidPhotoReference } from './imageUploadService.js'
import { countOpenLogisticsJobs } from './logisticsJobService.js'
import {
  matchPreAlertOnReceive,
  normalizeCarrierTracking,
} from './preAlertService.js'
import {
  assignPackageToReceiveBatch,
  resolveReceiveBatchId,
} from './receiveBatchService.js'
import { calculateReceiveQuote } from './shippingService.js'
import { countOpenShipments } from './shipmentService.js'
import { ensureUnidentifiedHolder, isUnidentifiedHolder } from './unidentifiedService.js'

type PackageRow = typeof packages.$inferSelect
type PackageEventRow = typeof packageEvents.$inferSelect
type PackagePhotoRow = typeof packagePhotos.$inferSelect
type PreAlertRow = typeof preAlerts.$inferSelect
type ShipmentRow = typeof shipments.$inferSelect
type ReceiveBatchRow = typeof receiveBatches.$inferSelect
type DeliveryAddressRow = typeof deliveryAddresses.$inferSelect

export { warehousePackageListToDictSerializer as warehousePackageListToDict }
export { warehousePackageToDictSerializer as warehousePackageToDict }

export type PackageRelations = {
  customer: UserRow | null
  shipment: ShipmentRow | null
  receiveBatch: ReceiveBatchRow | null
  deliveryAddress: DeliveryAddressRow | null
  events: PackageEventRow[]
  photos: PackagePhotoRow[]
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function transitionKey(from: string, to: string): string {
  return `${from}->${to}`
}

async function getPackageEvents(packageId: string): Promise<PackageEventRow[]> {
  return db
    .select()
    .from(packageEvents)
    .where(eq(packageEvents.packageId, packageId))
    .orderBy(asc(packageEvents.createdAt))
}

function packageBillingFields(pkg: PackageRow): Partial<typeof packages.$inferInsert> {
  return {
    billingStatus: pkg.billingStatus,
    totalDueJmd: pkg.totalDueJmd,
    estimatedFreightJmd: pkg.estimatedFreightJmd,
    dutiesJmd: pkg.dutiesJmd,
    handlingJmd: pkg.handlingJmd,
    otherFeesJmd: pkg.otherFeesJmd,
    rateTierLabel: pkg.rateTierLabel,
    billableWeightLbs: pkg.billableWeightLbs,
  }
}

export async function generateTrackingNumber(): Promise<string> {
  const year = new Date().getUTCFullYear()
  const rows = await db
    .select({ trackingNumber: packages.trackingNumber })
    .from(packages)
    .where(like(packages.trackingNumber, `PB-${year}-%`))

  let maxSeq = 0
  const pattern = new RegExp(`^PB-${year}-(\\d+)$`)
  for (const row of rows) {
    const match = row.trackingNumber.match(pattern)
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1]!, 10))
  }

  return `PB-${year}-${String(maxSeq + 1).padStart(6, '0')}`
}

async function notifyPackageStatusEmail(
  pkg: PackageRow,
  status: string,
  note?: string | null,
): Promise<void> {
  let customer: UserRow | null = null
  if (pkg.customerId) {
    ;[customer] = await db.select().from(users).where(eq(users.id, pkg.customerId)).limit(1)
  }

  if (!customer || customer.shippingId === UNIDENTIFIED_HOLDER_SHIPPING_ID) {
    console.info(
      `Skipping status email for ${pkg.trackingNumber} (no customer or unidentified holder)`,
    )
    return
  }

  try {
    const shipperLabel = pkg.shipper ? (SHIPPER_LABELS[pkg.shipper] ?? pkg.shipper) : null
    await sendPackageStatusEmail(customer.email, customer.firstName, pkg.trackingNumber, status, {
      packageId: pkg.id,
      note: note ?? null,
      carrierTracking: pkg.carrierTracking,
      shipperLabel,
    })
  } catch (err) {
    if (err instanceof EmailServiceError) {
      console.error(
        `Status email failed for ${pkg.trackingNumber} → ${customer.email}: ${err.message}`,
      )
    } else {
      console.warn(`Failed to send status email for ${pkg.trackingNumber}: ${err}`)
    }
  }
}

export async function addPackageEvent(
  pkg: PackageRow,
  status: string,
  note?: string | null,
): Promise<void> {
  const existingEvents = await getPackageEvents(pkg.id)
  const previousStatus = pkg.status
  const hadEvents = existingEvents.length > 0

  if (previousStatus !== status) {
    if (status === 'ready_for_pickup' && previousStatus === 'customs') {
      // allowed without an explicit workflow transition
    } else if (!WORKFLOW_TRANSITIONS.has(transitionKey(previousStatus, status))) {
      throw new Error(
        `Cannot change ${pkg.trackingNumber} from ` +
          `${STATUS_LABELS[previousStatus] ?? previousStatus} to ` +
          `${STATUS_LABELS[status] ?? status}. Use the next step in the workflow.`,
      )
    }
  }

  if (status === 'ready_for_pickup' && previousStatus !== 'ready_for_pickup') {
    if (pkg.billingStatus !== 'paid') {
      if (previousStatus === 'customs') {
        if (pkg.billingStatus !== 'ready') {
          throw new Error(
            `${pkg.trackingNumber} must be released from customs ` +
              'so the bill is published before marking ready for pickup',
          )
        }
      } else {
        publishReadyForPickupBill(pkg)
      }
    }
  }

  if (status === 'delivered' && previousStatus !== 'delivered') {
    if (pkg.billingStatus !== 'paid') {
      throw new Error(`${pkg.trackingNumber} cannot be delivered until payment is confirmed`)
    }
  }

  await db.insert(packageEvents).values({
    packageId: pkg.id,
    status,
    note: note ?? null,
  })

  pkg.status = status

  let notifyPrevious = previousStatus
  if (existingEvents.length && pkg.status === status && previousStatus === status) {
    notifyPrevious = existingEvents[existingEvents.length - 1]!.status
  }

  await db
    .update(packages)
    .set({
      status,
      ...packageBillingFields(pkg),
      updatedAt: sql`now()`,
    })
    .where(eq(packages.id, pkg.id))

  if (status !== 'unidentified' && (notifyPrevious !== status || !hadEvents)) {
    await notifyPackageStatusEmail(pkg, status, note)
  }
}

export async function receivePackage(
  customer: UserRow,
  actualWeightLbs: number,
  opts: {
    carrierTracking?: string | null
    shipper?: string | null
    photoKeys?: string[] | null
    note?: string | null
    receiveBatchId?: string | null
  } = {},
): Promise<[PackageRow, PreAlertRow | null]> {
  const quote = calculateReceiveQuote(actualWeightLbs)
  const trackingNumber = await generateTrackingNumber()

  let normalizedCarrier = opts.carrierTracking
    ? normalizeCarrierTracking(opts.carrierTracking)
    : null
  if (normalizedCarrier === '') normalizedCarrier = null

  const itemDescription = (opts.note ?? '').trim() || null

  const [pkg] = await db
    .insert(packages)
    .values({
      id: crypto.randomUUID(),
      trackingNumber,
      customerId: customer.id,
      carrierTracking: normalizedCarrier,
      itemDescription,
      shipper: (opts.shipper ?? '').trim().toLowerCase() || null,
      actualWeightLbs: String(quote.actual_weight_lbs),
      billableWeightLbs: quote.billable_weight_lbs,
      estimatedFreightJmd: String(quote.cost_jmd),
      rateTierLabel: quote.tier_label,
      billingStatus: 'pending',
      invoiceStatus: 'pending',
      status: 'received',
      receivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  const receiveBatch = await resolveReceiveBatchId(opts.receiveBatchId)
  if (receiveBatch) {
    assignPackageToReceiveBatch(pkg!, receiveBatch)
    await db
      .update(packages)
      .set({ receiveBatchId: pkg!.receiveBatchId, updatedAt: sql`now()` })
      .where(eq(packages.id, pkg!.id))
  }

  await addPackageEvent(
    pkg!,
    'received',
    opts.note ?? `Package received at Fort Lauderdale for ${customer.shippingId}`,
  )

  for (const key of opts.photoKeys ?? []) {
    if (isValidPhotoReference(key, { shippingId: customer.shippingId })) {
      await db.insert(packagePhotos).values({ packageId: pkg!.id, r2ObjectKey: key })
    }
  }

  const matchedPreAlert = await matchPreAlertOnReceive(pkg!)
  if (matchedPreAlert) {
    await db.insert(packageEvents).values({
      packageId: pkg!.id,
      status: pkg!.status,
      note: `Matched customer pre-alert (${matchedPreAlert.carrierTracking})`,
    })
  }

  const [fresh] = await db.select().from(packages).where(eq(packages.id, pkg!.id)).limit(1)
  return [fresh!, matchedPreAlert]
}

export async function receiveUnidentifiedPackage(
  actualWeightLbs: number,
  opts: {
    carrierTracking?: string | null
    shipper?: string | null
    labelName?: string | null
    labelBossId?: string | null
    photoKeys?: string[] | null
    note?: string | null
    receiveBatchId?: string | null
  } = {},
): Promise<PackageRow> {
  const holder = await ensureUnidentifiedHolder()
  const quote = calculateReceiveQuote(actualWeightLbs)
  const trackingNumber = await generateTrackingNumber()

  const normalizedLabelName = (opts.labelName ?? '').trim() || null
  const normalizedLabelBossId = (opts.labelBossId ?? '').trim().toUpperCase() || null

  let normalizedCarrier = opts.carrierTracking
    ? normalizeCarrierTracking(opts.carrierTracking)
    : null
  if (normalizedCarrier === '') normalizedCarrier = null

  if (!normalizedLabelName && !normalizedLabelBossId && !normalizedCarrier) {
    throw new Error(
      'Provide a label name, BOSS ID from the label, or carrier tracking to identify the package',
    )
  }

  const itemDescription = (opts.note ?? '').trim() || null

  const [pkg] = await db
    .insert(packages)
    .values({
      id: crypto.randomUUID(),
      trackingNumber,
      customerId: holder.id,
      carrierTracking: normalizedCarrier,
      itemDescription,
      labelName: normalizedLabelName,
      labelBossId: normalizedLabelBossId,
      shipper: (opts.shipper ?? '').trim().toLowerCase() || null,
      actualWeightLbs: String(quote.actual_weight_lbs),
      billableWeightLbs: quote.billable_weight_lbs,
      estimatedFreightJmd: String(quote.cost_jmd),
      rateTierLabel: quote.tier_label,
      billingStatus: 'pending',
      invoiceStatus: 'pending',
      status: 'unidentified',
      receivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  const receiveBatch = await resolveReceiveBatchId(opts.receiveBatchId)
  if (receiveBatch) {
    assignPackageToReceiveBatch(pkg!, receiveBatch)
    await db
      .update(packages)
      .set({ receiveBatchId: pkg!.receiveBatchId, updatedAt: sql`now()` })
      .where(eq(packages.id, pkg!.id))
  }

  const labelBits: string[] = []
  if (normalizedLabelName) labelBits.push(`name: ${normalizedLabelName}`)
  if (normalizedLabelBossId) labelBits.push(`BOSS ID: ${normalizedLabelBossId}`)
  const labelSummary = labelBits.length ? labelBits.join(', ') : 'no label details'

  await addPackageEvent(
    pkg!,
    'unidentified',
    opts.note ?? `Added to unidentified queue (${labelSummary})`,
  )

  for (const key of opts.photoKeys ?? []) {
    if (isValidPhotoReference(key, { unidentified: true })) {
      await db.insert(packagePhotos).values({ packageId: pkg!.id, r2ObjectKey: key })
    }
  }

  const [fresh] = await db.select().from(packages).where(eq(packages.id, pkg!.id)).limit(1)
  return fresh!
}

export async function updatePackageReceiveDetails(
  pkg: PackageRow,
  opts: {
    actualWeightLbs?: number | null
    shipper?: string | null
    carrierTracking?: string | null
    labelName?: string | null
    labelBossId?: string | null
    carrierTrackingProvided?: boolean
    labelNameProvided?: boolean
    labelBossIdProvided?: boolean
    requeuePrint?: boolean
  } = {},
): Promise<PackageRow> {
  if (!LABEL_EDITABLE_STATUSES.has(pkg.status)) {
    throw new Error(
      `Label details cannot be edited once a package is ${pkg.status.replace(/_/g, ' ')}`,
    )
  }

  const isUnidentified = pkg.status === 'unidentified'
  const updates: Partial<typeof packages.$inferInsert> = {}

  if (opts.actualWeightLbs != null) {
    const quote = calculateReceiveQuote(opts.actualWeightLbs)
    updates.actualWeightLbs = String(quote.actual_weight_lbs)
    updates.billableWeightLbs = quote.billable_weight_lbs
    updates.estimatedFreightJmd = String(quote.cost_jmd)
    updates.rateTierLabel = quote.tier_label
  }

  if (opts.shipper != null) {
    const normalizedShipper = opts.shipper.trim().toLowerCase()
    if (!normalizedShipper) throw new Error('shipper is required')
    if (!(SHIPPER_CODES as Set<string>).has(normalizedShipper)) throw new Error('Invalid shipper')
    updates.shipper = normalizedShipper
  }

  if (opts.carrierTrackingProvided) {
    let normalizedCarrier = opts.carrierTracking
      ? normalizeCarrierTracking(opts.carrierTracking)
      : null
    if (normalizedCarrier === '') normalizedCarrier = null
    if (!isUnidentified && !normalizedCarrier) {
      throw new Error('Carrier tracking is required for identified packages')
    }
    updates.carrierTracking = normalizedCarrier
  }

  if (opts.labelNameProvided || opts.labelBossIdProvided) {
    if (!isUnidentified) {
      throw new Error('Label name and BOSS ID only apply to unidentified packages')
    }
    if (opts.labelNameProvided) {
      updates.labelName = (opts.labelName ?? '').trim() || null
    }
    if (opts.labelBossIdProvided) {
      updates.labelBossId = (opts.labelBossId ?? '').trim().toUpperCase() || null
    }
  }

  const nextLabelName = opts.labelNameProvided
    ? ((opts.labelName ?? '').trim() || null)
    : pkg.labelName
  const nextLabelBossId = opts.labelBossIdProvided
    ? ((opts.labelBossId ?? '').trim().toUpperCase() || null)
    : pkg.labelBossId
  const nextCarrierTracking = opts.carrierTrackingProvided
    ? (() => {
        let v = opts.carrierTracking ? normalizeCarrierTracking(opts.carrierTracking) : null
        if (v === '') v = null
        return v
      })()
    : pkg.carrierTracking

  if (isUnidentified && !nextLabelName && !nextLabelBossId && !nextCarrierTracking) {
    throw new Error('Provide at least one of label name, BOSS ID, or carrier tracking')
  }

  if (opts.requeuePrint) {
    updates.labelPrintedAt = null
  }

  const [updated] = await db
    .update(packages)
    .set({
      ...updates,
      updatedAt: sql`now()`,
    })
    .where(eq(packages.id, pkg.id))
    .returning()

  return updated!
}

export async function unassignPackageFromCustomer(
  pkg: PackageRow,
  opts: { note?: string | null } = {},
): Promise<[PackageRow, UserRow]> {
  const [customer] = await db.select().from(users).where(eq(users.id, pkg.customerId)).limit(1)
  if (!customer || isUnidentifiedHolder(customer)) {
    throw new Error('Package is not assigned to a customer')
  }

  if (pkg.status === 'unidentified') {
    throw new Error('Package is already in the unidentified queue')
  }

  if (pkg.status === 'delivered') {
    throw new Error('Delivered packages cannot be unassigned from a customer')
  }

  if (pkg.billingStatus === 'paid') {
    throw new Error(
      'Paid packages cannot be unassigned. Contact support if this was recorded in error.',
    )
  }

  const proofLinks = await db
    .select({ link: bankTransferProofPackages, proof: bankTransferProofs })
    .from(bankTransferProofPackages)
    .innerJoin(bankTransferProofs, eq(bankTransferProofPackages.proofId, bankTransferProofs.id))
    .where(
      and(
        eq(bankTransferProofPackages.packageId, pkg.id),
        inArray(bankTransferProofs.status, [...BANK_TRANSFER_PROOF_OPEN_STATUSES]),
      ),
    )
    .limit(1)

  if (proofLinks.length) {
    throw new Error(
      'Package is on a pending bank transfer proof. Reject or confirm the proof before unassigning.',
    )
  }

  const deliveryLinks = await db
    .select({ link: deliveryRequestPackages, request: deliveryRequests })
    .from(deliveryRequestPackages)
    .innerJoin(deliveryRequests, eq(deliveryRequestPackages.deliveryRequestId, deliveryRequests.id))
    .where(
      and(
        eq(deliveryRequestPackages.packageId, pkg.id),
        inArray(deliveryRequests.status, [...DELIVERY_REQUEST_OPEN_STATUSES]),
      ),
    )
    .limit(1)

  if (deliveryLinks.length) {
    const request = deliveryLinks[0]!.request
    await db
      .delete(deliveryRequestPackages)
      .where(
        and(
          eq(deliveryRequestPackages.deliveryRequestId, request.id),
          eq(deliveryRequestPackages.packageId, pkg.id),
        ),
      )

    const remaining = await db
      .select({ value: count() })
      .from(deliveryRequestPackages)
      .where(eq(deliveryRequestPackages.deliveryRequestId, request.id))

    if (Number(remaining[0]?.value ?? 0) === 0) {
      await db
        .update(deliveryRequests)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(deliveryRequests.id, request.id))
    }
  }

  const packageUpdates: Partial<typeof packages.$inferInsert> = {
    shipmentId: null,
    deliveryAddressId: null,
  }

  if (pkg.billingStatus === 'ready') {
    packageUpdates.billingStatus = 'pending'
    packageUpdates.totalDueJmd = null
  }

  const [preAlert] = await db
    .select()
    .from(preAlerts)
    .where(eq(preAlerts.packageId, pkg.id))
    .limit(1)

  if (preAlert) {
    await db
      .update(preAlerts)
      .set({ packageId: null, status: 'pending', updatedAt: sql`now()` })
      .where(eq(preAlerts.id, preAlert.id))
  }

  const holder = await ensureUnidentifiedHolder()
  const previousShippingId = customer.shippingId
  const previousName = userFullName(customer)

  packageUpdates.customerId = holder.id

  await db.update(packages).set(packageUpdates).where(eq(packages.id, pkg.id))

  const eventNote =
    opts.note ??
    `Removed from ${previousShippingId} (${previousName}) — returned to unidentified queue`

  await db.insert(packageEvents).values({
    packageId: pkg.id,
    status: 'unidentified',
    note: eventNote,
  })

  const [updated] = await db
    .update(packages)
    .set({ status: 'unidentified', updatedAt: sql`now()` })
    .where(eq(packages.id, pkg.id))
    .returning()

  pkg.status = 'unidentified'
  return [updated!, customer]
}

export async function assignUnidentifiedPackage(
  pkg: PackageRow,
  customer: UserRow,
  note?: string | null,
): Promise<[PackageRow, PreAlertRow | null]> {
  if (pkg.status !== 'unidentified') {
    throw new Error('Only unidentified packages can be assigned to a customer')
  }

  await db
    .update(packages)
    .set({ customerId: customer.id, updatedAt: sql`now()` })
    .where(eq(packages.id, pkg.id))

  pkg.customerId = customer.id

  await addPackageEvent(
    pkg,
    'received',
    note ?? `Assigned to ${customer.shippingId} (${userFullName(customer)})`,
  )

  const matchedPreAlert = await matchPreAlertOnReceive(pkg)
  if (matchedPreAlert) {
    await db.insert(packageEvents).values({
      packageId: pkg.id,
      status: pkg.status,
      note: `Matched customer pre-alert (${matchedPreAlert.carrierTracking})`,
    })
  }

  const [fresh] = await db.select().from(packages).where(eq(packages.id, pkg.id)).limit(1)
  return [fresh!, matchedPreAlert]
}

async function loadWarehouseListRelations(packageRows: PackageRow[]) {
  const customerIds = [...new Set(packageRows.map((p) => p.customerId))]
  const shipmentIds = [
    ...new Set(packageRows.map((p) => p.shipmentId).filter((id): id is string => Boolean(id))),
  ]

  const customerRows =
    customerIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, customerIds))
      : []
  const shipmentRows =
    shipmentIds.length > 0
      ? await db.select().from(shipments).where(inArray(shipments.id, shipmentIds))
      : []

  const customersById = new Map(customerRows.map((u) => [u.id, u]))
  const shipmentsById = new Map(shipmentRows.map((s) => [s.id, s]))

  return packageRows.map((pkg) => ({
    pkg,
    customer: customersById.get(pkg.customerId) ?? null,
    shipment: pkg.shipmentId ? (shipmentsById.get(pkg.shipmentId) ?? null) : null,
  }))
}

export async function loadPackageRelations(
  pkg: PackageRow,
  opts: {
    includeEvents?: boolean
    includePhotos?: boolean
    includeDeliveryAddress?: boolean
  } = {},
): Promise<PackageRelations> {
  const includeEvents = opts.includeEvents ?? true
  const includePhotos = opts.includePhotos ?? true
  const includeDeliveryAddress = opts.includeDeliveryAddress ?? true

  const [customer] = await db.select().from(users).where(eq(users.id, pkg.customerId)).limit(1)

  let shipment: ShipmentRow | null = null
  if (pkg.shipmentId) {
    ;[shipment] = await db.select().from(shipments).where(eq(shipments.id, pkg.shipmentId)).limit(1)
  }

  let receiveBatch: ReceiveBatchRow | null = null
  if (pkg.receiveBatchId) {
    ;[receiveBatch] = await db
      .select()
      .from(receiveBatches)
      .where(eq(receiveBatches.id, pkg.receiveBatchId))
      .limit(1)
  }

  let deliveryAddress: DeliveryAddressRow | null = null
  if (includeDeliveryAddress && pkg.deliveryAddressId) {
    ;[deliveryAddress] = await db
      .select()
      .from(deliveryAddresses)
      .where(eq(deliveryAddresses.id, pkg.deliveryAddressId))
      .limit(1)
  }

  const events = includeEvents ? await getPackageEvents(pkg.id) : []
  const photos = includePhotos
    ? await db
        .select()
        .from(packagePhotos)
        .where(eq(packagePhotos.packageId, pkg.id))
        .orderBy(asc(packagePhotos.createdAt))
    : []

  return {
    customer: customer ?? null,
    shipment: shipment ?? null,
    receiveBatch: receiveBatch ?? null,
    deliveryAddress: deliveryAddress ?? null,
    events,
    photos,
  }
}

function parseDateBound(value: string, endOfDay = false): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = parseInt(match[1]!, 10)
  const month = parseInt(match[2]!, 10) - 1
  const day = parseInt(match[3]!, 10)
  const dt = new Date(Date.UTC(year, month, day))
  if (endOfDay) {
    dt.setUTCHours(23, 59, 59, 999)
  } else {
    dt.setUTCHours(0, 0, 0, 0)
  }
  return dt
}

export async function listUnidentifiedPackages(
  limit = 50,
  offset = 0,
): Promise<[PackageRow[], number]> {
  const where = eq(packages.status, 'unidentified')

  const [totalRow] = await db.select({ value: count() }).from(packages).where(where)
  const total = Number(totalRow?.value ?? 0)

  const rows = await db
    .select()
    .from(packages)
    .where(where)
    .orderBy(desc(packages.receivedAt))
    .limit(limit)
    .offset(offset)

  return [rows, total]
}

export async function listWarehousePackages(
  opts: {
    fromDate?: string | null
    toDate?: string | null
    status?: string | null
    limit?: number
    offset?: number
  } = {},
): Promise<[PackageRow[], number]> {
  const limit = opts.limit ?? 100
  const offset = opts.offset ?? 0

  const conditions = [ne(packages.status, 'unidentified')]

  if (opts.fromDate) {
    const start = parseDateBound(opts.fromDate)
    if (start) conditions.push(gte(packages.receivedAt, start))
  }

  if (opts.toDate) {
    const end = parseDateBound(opts.toDate, true)
    if (end) conditions.push(lte(packages.receivedAt, end))
  }

  if (opts.status) {
    conditions.push(eq(packages.status, opts.status))
  }

  const where = and(...conditions)

  const [totalRow] = await db.select({ value: count() }).from(packages).where(where)
  const total = Number(totalRow?.value ?? 0)

  const rows = await db
    .select()
    .from(packages)
    .where(where)
    .orderBy(desc(packages.receivedAt), desc(packages.trackingNumber))
    .limit(limit)
    .offset(offset)

  return [rows, total]
}

export async function listLabelLog(
  days = 7,
  limit = 100,
  offset = 0,
  pendingOnly = false,
): Promise<[PackageRow[], number]> {
  const clampedDays = Math.max(1, Math.min(days, 30))
  const cutoff = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000)

  const conditions = [gte(packages.receivedAt, cutoff)]
  if (pendingOnly) {
    conditions.push(isNull(packages.labelPrintedAt))
  }

  const where = and(...conditions)

  const [totalRow] = await db.select({ value: count() }).from(packages).where(where)
  const total = Number(totalRow?.value ?? 0)

  const rows = pendingOnly
    ? await db
        .select()
        .from(packages)
        .where(where)
        .orderBy(asc(packages.receivedAt), asc(packages.trackingNumber))
        .limit(limit)
        .offset(offset)
    : await db
        .select()
        .from(packages)
        .where(where)
        .orderBy(desc(packages.receivedAt), desc(packages.trackingNumber))
        .limit(limit)
        .offset(offset)

  return [rows, total]
}

export async function listClerkReceivesToday(
  clerkId: string,
  limit = 3,
): Promise<Array<Record<string, unknown>>> {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const clampedLimit = Math.max(1, Math.min(limit, 10))

  const logs = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, clerkId),
        inArray(auditLogs.action, [ACTION_PACKAGE_RECEIVED, ACTION_PACKAGE_RECEIVED_UNIDENTIFIED]),
        gte(auditLogs.createdAt, todayStart),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(clampedLimit)

  const results: Array<Record<string, unknown>> = []

  for (const entry of logs) {
    let pkg: PackageRow | null = null
    if (entry.entityId && isValidUuid(entry.entityId)) {
      ;[pkg] = await db.select().from(packages).where(eq(packages.id, entry.entityId)).limit(1)
    }

    const metadata = (entry.metadataJson ?? {}) as Record<string, unknown>
    const item: Record<string, unknown> = {
      received_at: utcIsoformat(entry.createdAt),
      action: entry.action,
      tracking_number: metadata.tracking_number ?? (pkg ? pkg.trackingNumber : null),
      shipping_id: metadata.shipping_id,
      billable_weight_lbs: metadata.billable_weight_lbs ?? (pkg ? pkg.billableWeightLbs : null),
      is_unidentified: entry.action === ACTION_PACKAGE_RECEIVED_UNIDENTIFIED,
      label_name: metadata.label_name,
      package_id: pkg ? pkg.id : entry.entityId,
    }

    if (pkg) {
      const [customer] = await db.select().from(users).where(eq(users.id, pkg.customerId)).limit(1)
      if (customer && customer.shippingId !== UNIDENTIFIED_HOLDER_SHIPPING_ID) {
        item.customer_name = userFullName(customer)
        item.shipping_id = item.shipping_id ?? customer.shippingId
      } else if (pkg.labelName) {
        item.customer_name = pkg.labelName
      } else {
        item.customer_name = 'Unidentified'
      }
    }

    results.push(item)
  }

  return results
}

export async function markLabelsPrinted(
  packageIds: string[],
): Promise<[PackageRow[], Array<{ id: string; error: string }>]> {
  const now = new Date()
  const marked: PackageRow[] = []
  const failed: Array<{ id: string; error: string }> = []

  for (const rawId of packageIds) {
    if (!isValidUuid(String(rawId))) {
      failed.push({ id: String(rawId), error: 'Invalid package ID' })
      continue
    }

    const [pkg] = await db.select().from(packages).where(eq(packages.id, String(rawId))).limit(1)
    if (!pkg) {
      failed.push({ id: String(rawId), error: 'Package not found' })
      continue
    }

    const [updated] = await db
      .update(packages)
      .set({ labelPrintedAt: now, updatedAt: now })
      .where(eq(packages.id, pkg.id))
      .returning()

    marked.push(updated!)
  }

  return [marked, failed]
}

export async function bulkUpdatePackageStatus(
  packageIds: string[],
  status: string,
  note?: string | null,
): Promise<[PackageRow[], Array<{ id: string; error: string; tracking_number?: string }>]> {
  if (!(UPDATABLE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Invalid status: ${status}`)
  }

  const updated: PackageRow[] = []
  const failed: Array<{ id: string; error: string; tracking_number?: string }> = []

  for (const rawId of packageIds) {
    if (!isValidUuid(String(rawId))) {
      failed.push({ id: String(rawId), error: 'Invalid package ID' })
      continue
    }

    const [pkg] = await db.select().from(packages).where(eq(packages.id, String(rawId))).limit(1)
    if (!pkg) {
      failed.push({ id: String(rawId), error: 'Package not found' })
      continue
    }

    if (pkg.status === 'unidentified') {
      failed.push({
        id: pkg.id,
        tracking_number: pkg.trackingNumber,
        error: 'Unidentified packages must be assigned first',
      })
      continue
    }

    try {
      await addPackageEvent(pkg, status, note)
      const [fresh] = await db.select().from(packages).where(eq(packages.id, pkg.id)).limit(1)
      if (fresh) updated.push(fresh)
    } catch (err) {
      failed.push({
        id: pkg.id,
        tracking_number: pkg.trackingNumber,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return [updated, failed]
}

export async function updatePackageStatus(
  pkg: PackageRow,
  status: string,
  note?: string | null,
): Promise<PackageRow> {
  if (!(UPDATABLE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Invalid status: ${status}`)
  }

  await addPackageEvent(pkg, status, note)
  const [fresh] = await db.select().from(packages).where(eq(packages.id, pkg.id)).limit(1)
  return fresh!
}

export async function getWarehouseSummary(): Promise<Record<string, unknown>> {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const printCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [printQueueRow] = await db
    .select({ value: count() })
    .from(packages)
    .where(and(isNull(packages.labelPrintedAt), gte(packages.receivedAt, printCutoff)))

  const statusCounts: Record<string, number> = {}
  for (const status of WORKFLOW_STATUSES) {
    const [row] = await db
      .select({ value: count() })
      .from(packages)
      .where(eq(packages.status, status))
    statusCounts[status] = Number(row?.value ?? 0)
  }

  const [unidentifiedRow] = await db
    .select({ value: count() })
    .from(packages)
    .where(eq(packages.status, 'unidentified'))

  const [packagesTodayRow] = await db
    .select({ value: count() })
    .from(packages)
    .where(gte(packages.receivedAt, todayStart))

  const [pendingPreAlertsRow] = await db
    .select({ value: count() })
    .from(preAlerts)
    .where(eq(preAlerts.status, 'pending'))

  const openDeliveryRequests = await countOpenDeliveryRequests()
  const openTransferProofs = await countOpenTransferProofs()
  const openLogisticsJobs = await countOpenLogisticsJobs()

  return {
    print_queue_pending: Number(printQueueRow?.value ?? 0),
    unidentified_count: Number(unidentifiedRow?.value ?? 0),
    received_count: statusCounts.received ?? 0,
    packages_today: Number(packagesTodayRow?.value ?? 0),
    pending_pre_alerts: Number(pendingPreAlertsRow?.value ?? 0),
    open_shipments: await countOpenShipments(),
    pending_delivery_requests: openDeliveryRequests,
    pending_transfer_proofs: openTransferProofs,
    pending_logistics_jobs: openLogisticsJobs,
    pending_customer_requests: openDeliveryRequests + openTransferProofs + openLogisticsJobs,
    status_counts: statusCounts,
  }
}

/** Batch-load customer and shipment for warehouse list serializers. */
export { loadWarehouseListRelations }

/** Re-export packageToDict for callers that need the base shape. */
export { packageToDict }
