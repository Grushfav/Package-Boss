import { and, count, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { deliveryAddresses, packages, receiveBatches, shipments } from '../db/schema/index.js'
import { packageToDict } from '../lib/serializers/package.js'
import { pendingDeliverySummariesByPackage } from './deliveryRequestService.js'

export const PACKAGE_LIST_SCOPES = ['active', 'completed', 'payable'] as const
export type PackageListScope = (typeof PACKAGE_LIST_SCOPES)[number]

const DEFAULT_LIMITS: Record<PackageListScope, number> = {
  active: 10,
  completed: 5,
  payable: 50,
}
const MAX_LIMIT = 50

function uniqueIds(ids: Array<string | null>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))]
}

function scopeWhere(customerId: string, scope: PackageListScope) {
  const customer = eq(packages.customerId, customerId)
  if (scope === 'completed') return and(customer, eq(packages.status, 'delivered'))
  if (scope === 'payable') {
    return and(
      customer,
      eq(packages.status, 'ready_for_pickup'),
      eq(packages.billingStatus, 'ready'),
      isNotNull(packages.totalDueJmd),
    )
  }
  return and(customer, ne(packages.status, 'delivered'))
}

export async function listCustomerPackagePage(
  customerId: string,
  scope: PackageListScope,
  limit: number | null,
  offset: number | null,
) {
  const pageLimit = limit == null ? DEFAULT_LIMITS[scope] : Math.max(1, Math.min(limit, MAX_LIMIT))
  const pageOffset = offset == null ? 0 : Math.max(0, offset)
  const whereClause = scopeWhere(customerId, scope)

  const [totalRow] = await db.select({ value: count() }).from(packages).where(whereClause)
  const rows = await db
    .select()
    .from(packages)
    .where(whereClause)
    .orderBy(desc(packages.createdAt))
    .limit(pageLimit)
    .offset(pageOffset)

  const addressIds = uniqueIds(rows.map((pkg) => pkg.deliveryAddressId))
  const batchIds = uniqueIds(rows.map((pkg) => pkg.receiveBatchId))
  const shipmentIds = uniqueIds(rows.map((pkg) => pkg.shipmentId))

  const [addressRows, batchRows, shipmentRows, summaries, readyRow] = await Promise.all([
    addressIds.length
      ? db.select().from(deliveryAddresses).where(inArray(deliveryAddresses.id, addressIds))
      : Promise.resolve([]),
    batchIds.length
      ? db.select().from(receiveBatches).where(inArray(receiveBatches.id, batchIds))
      : Promise.resolve([]),
    shipmentIds.length
      ? db.select().from(shipments).where(inArray(shipments.id, shipmentIds))
      : Promise.resolve([]),
    pendingDeliverySummariesByPackage(rows.map((pkg) => pkg.id)),
    db
      .select({ value: count() })
      .from(packages)
      .where(and(eq(packages.customerId, customerId), eq(packages.status, 'ready_for_pickup'))),
  ])

  const addresses = new Map(addressRows.map((row) => [row.id, row]))
  const batches = new Map(batchRows.map((row) => [row.id, row]))
  const shipmentById = new Map(shipmentRows.map((row) => [row.id, row]))

  return {
    packages: rows.map((pkg) => ({
      ...packageToDict(pkg, {
        deliveryAddress: pkg.deliveryAddressId ? (addresses.get(pkg.deliveryAddressId) ?? null) : null,
        receiveBatch: pkg.receiveBatchId ? (batches.get(pkg.receiveBatchId) ?? null) : null,
        shipment: pkg.shipmentId ? (shipmentById.get(pkg.shipmentId) ?? null) : null,
      }),
      pending_delivery_request: summaries.get(pkg.id) ?? null,
    })),
    total: Number(totalRow?.value ?? 0),
    limit: pageLimit,
    offset: pageOffset,
    ready_for_pickup_count: Number(readyRow[0]?.value ?? 0),
  }
}
