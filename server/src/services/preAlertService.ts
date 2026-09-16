import { and, eq, sql } from 'drizzle-orm'
import { SHIPPER_CODES } from '../constants.js'
import { db } from '../db/index.js'
import { packages, preAlerts, users, type UserRow } from '../db/schema/index.js'
import { isValidInvoiceReference } from './imageUploadService.js'

type PreAlertRow = typeof preAlerts.$inferSelect
type PackageRow = typeof packages.$inferSelect

const MIN_TRACKING_MATCH_LEN = 8
const TRACKING_ALNUM = /[^A-Z0-9]+/g

export function normalizeCarrierTracking(value: string): string {
  return value.trim().toUpperCase()
}

export function trackingCore(value: string | null | undefined): string {
  if (!value) return ''
  return normalizeCarrierTracking(value).replace(TRACKING_ALNUM, '')
}

export function trackingMatchScore(preAlertTracking: string, receivedTracking: string): number {
  const preCore = trackingCore(preAlertTracking)
  const recvCore = trackingCore(receivedTracking)
  if (!preCore || !recvCore) return 0
  if (preCore === recvCore) return 10_000 + preCore.length

  const [short, long] = preCore.length <= recvCore.length ? [preCore, recvCore] : [recvCore, preCore]
  if (short.length < MIN_TRACKING_MATCH_LEN) return 0
  if (!long.includes(short)) return 0
  return short.length
}

async function assertNoConflictingPendingPreAlert(
  customerId: string,
  tracking: string,
  excludeId?: string,
): Promise<void> {
  const pending = await db
    .select()
    .from(preAlerts)
    .where(and(eq(preAlerts.customerId, customerId), eq(preAlerts.status, 'pending')))

  for (const existing of pending) {
    if (excludeId && existing.id === excludeId) continue
    if (trackingMatchScore(existing.carrierTracking, tracking) >= 10_000) {
      throw new Error('A pending pre-alert already exists for this tracking number')
    }
    const recvCore = trackingCore(tracking)
    const existCore = trackingCore(existing.carrierTracking)
    const [short, long] = recvCore.length <= existCore.length ? [recvCore, existCore] : [existCore, recvCore]
    if (short.length >= MIN_TRACKING_MATCH_LEN && long.includes(short) && short.length / long.length >= 0.85) {
      throw new Error('A pending pre-alert already exists for this tracking number')
    }
  }
}

function validatePreAlertMerchant(merchant: string | null | undefined): string {
  const code = (merchant ?? '').trim()
  if (!code) throw new Error('merchant is required')
  if (!(SHIPPER_CODES as Set<string>).has(code)) throw new Error('Invalid merchant')
  return code
}

function validatePreAlertDescription(description: string | null | undefined): string {
  const text = (description ?? '').trim()
  if (!text) throw new Error('description is required')
  return text
}

function validatePreAlertDeclaredValue(declaredValueUsd: unknown): number {
  if (declaredValueUsd == null) throw new Error('declared_value_usd is required')
  const amount = parseFloat(String(declaredValueUsd))
  if (Number.isNaN(amount)) throw new Error('declared_value_usd must be a number')
  if (amount <= 0) throw new Error('declared_value_usd must be greater than zero')
  return amount
}

export async function createPreAlert(opts: {
  customer: UserRow
  carrierTracking: string
  invoiceObjectKey?: string | null
  merchant?: string | null
  description?: string | null
  declaredValueUsd?: number | null
}): Promise<PreAlertRow> {
  const tracking = normalizeCarrierTracking(opts.carrierTracking)
  if (!tracking) throw new Error('carrier_tracking is required')

  if (opts.invoiceObjectKey && !isValidInvoiceReference(opts.invoiceObjectKey, opts.customer.shippingId)) {
    throw new Error('Invalid invoice object key')
  }

  await assertNoConflictingPendingPreAlert(opts.customer.id, tracking)

  const [preAlert] = await db
    .insert(preAlerts)
    .values({
      customerId: opts.customer.id,
      carrierTracking: tracking,
      merchant: validatePreAlertMerchant(opts.merchant),
      description: validatePreAlertDescription(opts.description),
      declaredValueUsd: String(validatePreAlertDeclaredValue(opts.declaredValueUsd)),
      invoiceObjectKey: opts.invoiceObjectKey ?? null,
      status: 'pending',
    })
    .returning()
  return preAlert!
}

export async function updatePreAlert(preAlert: PreAlertRow, fields: Record<string, unknown>): Promise<PreAlertRow> {
  if (preAlert.status !== 'pending') throw new Error('Only pending pre-alerts can be updated')

  const updates: Partial<typeof preAlerts.$inferInsert> = { updatedAt: new Date() }

  if ('carrier_tracking' in fields) {
    const tracking = normalizeCarrierTracking(String(fields.carrier_tracking ?? ''))
    if (!tracking) throw new Error('carrier_tracking is required')
    await assertNoConflictingPendingPreAlert(preAlert.customerId, tracking, preAlert.id)
    updates.carrierTracking = tracking
  }
  if ('merchant' in fields) updates.merchant = validatePreAlertMerchant(fields.merchant as string)
  if ('description' in fields) updates.description = validatePreAlertDescription(fields.description as string)
  if ('declared_value_usd' in fields) {
    updates.declaredValueUsd = String(validatePreAlertDeclaredValue(fields.declared_value_usd))
  }
  if ('invoice_object_key' in fields) {
    const invoiceKey = (fields.invoice_object_key as string | null) ?? null
    if (invoiceKey) {
      const [customer] = await db.select().from(users).where(eq(users.id, preAlert.customerId)).limit(1)
      if (!customer || !isValidInvoiceReference(invoiceKey, customer.shippingId)) {
        throw new Error('Invalid invoice object key')
      }
    }
    updates.invoiceObjectKey = invoiceKey || null
  }

  const [updated] = await db.update(preAlerts).set(updates).where(eq(preAlerts.id, preAlert.id)).returning()
  return updated!
}

export async function cancelPreAlert(preAlert: PreAlertRow): Promise<PreAlertRow> {
  if (preAlert.status !== 'pending') throw new Error('Only pending pre-alerts can be cancelled')
  const [updated] = await db
    .update(preAlerts)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(preAlerts.id, preAlert.id))
    .returning()
  return updated!
}

export async function findMatchingPreAlert(
  customerId: string,
  carrierTracking: string | null | undefined,
): Promise<PreAlertRow | null> {
  const recvCore = trackingCore(carrierTracking)
  if (recvCore.length < MIN_TRACKING_MATCH_LEN) return null

  const candidates = await db
    .select()
    .from(preAlerts)
    .where(and(eq(preAlerts.customerId, customerId), eq(preAlerts.status, 'pending')))

  let best: PreAlertRow | null = null
  let bestScore = 0

  for (const preAlert of candidates) {
    const score = trackingMatchScore(preAlert.carrierTracking, carrierTracking ?? '')
    if (score > bestScore) {
      bestScore = score
      best = preAlert
    } else if (score === bestScore && score > 0 && best != null) {
      const preTime = preAlert.createdAt?.getTime() ?? 0
      const bestTime = best.createdAt?.getTime() ?? 0
      if (preTime > bestTime) best = preAlert
    }
  }

  return best
}

export async function findPendingPreAlertsByTracking(
  carrierTracking: string | null | undefined,
): Promise<Array<[PreAlertRow, number]>> {
  const recvCore = trackingCore(carrierTracking)
  if (recvCore.length < MIN_TRACKING_MATCH_LEN) return []

  const candidates = await db.select().from(preAlerts).where(eq(preAlerts.status, 'pending'))
  const scored: Array<[PreAlertRow, number]> = []

  for (const preAlert of candidates) {
    const score = trackingMatchScore(preAlert.carrierTracking, carrierTracking ?? '')
    if (score > 0) scored.push([preAlert, score])
  }

  scored.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    const aTime = a[0].createdAt?.getTime() ?? 0
    const bTime = b[0].createdAt?.getTime() ?? 0
    return bTime - aTime
  })
  return scored
}

async function applyPreAlertInvoice(pkg: PackageRow, preAlert: PreAlertRow): Promise<void> {
  if (!preAlert.invoiceObjectKey || pkg.invoiceObjectKey) return

  const [customer] = await db.select().from(users).where(eq(users.id, pkg.customerId)).limit(1)
  if (!customer || !isValidInvoiceReference(preAlert.invoiceObjectKey, customer.shippingId)) return

  await db
    .update(packages)
    .set({
      invoiceObjectKey: preAlert.invoiceObjectKey,
      invoiceStatus: 'received',
      invoiceReceivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(packages.id, pkg.id))
}

export async function applyPreAlertToPackage(preAlert: PreAlertRow, pkg: PackageRow): Promise<void> {
  await db
    .update(preAlerts)
    .set({
      status: 'received',
      packageId: pkg.id,
      updatedAt: new Date(),
    })
    .where(eq(preAlerts.id, preAlert.id))

  const packageUpdates: Partial<typeof packages.$inferInsert> = { updatedAt: new Date() }
  if (preAlert.declaredValueUsd != null && pkg.declaredValueUsd == null) {
    packageUpdates.declaredValueUsd = preAlert.declaredValueUsd
  }
  if (preAlert.description && !(pkg.itemDescription ?? '').trim()) {
    packageUpdates.itemDescription = preAlert.description.trim()
  }
  if (Object.keys(packageUpdates).length > 1) {
    await db.update(packages).set(packageUpdates).where(eq(packages.id, pkg.id))
  }

  await applyPreAlertInvoice(pkg, preAlert)
}

export async function matchPreAlertOnReceive(pkg: PackageRow): Promise<PreAlertRow | null> {
  const carrierTracking = (pkg.carrierTracking ?? '').trim()
  if (!carrierTracking) return null

  const preAlert = await findMatchingPreAlert(pkg.customerId, carrierTracking)
  if (!preAlert) return null

  await applyPreAlertToPackage(preAlert, pkg)
  return preAlert
}
