import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { packages, shipments } from '../db/schema/index.js'
import type { packages as packagesTable, shipments as shipmentsTable } from '../db/schema/index.js'
import type { UserRow } from '../db/schema/index.js'
import {
  ACTION_PACKAGE_STATUS_UPDATED,
  ACTION_SHIPMENT_CREATED,
  ACTION_SHIPMENT_DEPARTED,
  ACTION_SHIPMENT_PACKAGE_ADDED,
  ACTION_SHIPMENT_PACKAGE_REMOVED,
  logEntityAction,
  logPackageAction,
} from './auditService.js'
import { addPackageEvent } from './packageService.js'

type ShipmentRow = typeof shipmentsTable.$inferSelect
type PackageRow = typeof packagesTable.$inferSelect

export async function createShipment(options: {
  reference: string
  departureDate: string
  note?: string | null
  createdBy?: UserRow | null
}): Promise<ShipmentRow> {
  const reference = options.reference.trim()
  if (!reference) throw new Error('Reference is required')

  const [shipment] = await db
    .insert(shipments)
    .values({
      id: crypto.randomUUID(),
      reference,
      departureDate: options.departureDate,
      note: options.note?.trim() || null,
      status: 'open',
      createdById: options.createdBy?.id ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  if (options.createdBy) {
    await logEntityAction(
      options.createdBy,
      ACTION_SHIPMENT_CREATED,
      'shipment',
      shipment.id,
      `Created departure ${reference}`,
      {
        reference,
        departure_date: options.departureDate,
      },
    )
  }

  return shipment
}

export async function listShipments(options?: {
  status?: string | null
  limit?: number
  offset?: number
}): Promise<[ShipmentRow[], number]> {
  let rows = await db.select().from(shipments).orderBy(desc(shipments.departureDate), desc(shipments.createdAt))
  if (options?.status) rows = rows.filter((s) => s.status === options.status)
  const total = rows.length
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  return [rows.slice(offset, offset + limit), total]
}

export async function getShipment(shipmentId: string): Promise<ShipmentRow | null> {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1)
  return shipment ?? null
}

function assertOpen(shipment: ShipmentRow): void {
  if (shipment.status !== 'open') {
    throw new Error(`Departure ${shipment.reference} has already departed`)
  }
}

async function findOtherOpenShipment(pkg: PackageRow, current: ShipmentRow): Promise<ShipmentRow | null> {
  if (!pkg.shipmentId || pkg.shipmentId === current.id) return null
  const other = await getShipment(pkg.shipmentId)
  if (other && other.status === 'open' && other.id !== current.id) return other
  return null
}

export async function addPackageToShipment(
  shipment: ShipmentRow,
  pkg: PackageRow,
  options?: { actor?: UserRow | null },
): Promise<PackageRow> {
  assertOpen(shipment)
  if (pkg.status !== 'received') {
    throw new Error(`${pkg.trackingNumber} is not in received status`)
  }

  const other = await findOtherOpenShipment(pkg, shipment)
  if (other) {
    throw new Error(`${pkg.trackingNumber} is already on departure ${other.reference}`)
  }

  const [updated] = await db
    .update(packages)
    .set({ shipmentId: shipment.id, updatedAt: new Date() })
    .where(eq(packages.id, pkg.id))
    .returning()

  if (options?.actor) {
    await logEntityAction(
      options.actor,
      ACTION_SHIPMENT_PACKAGE_ADDED,
      'shipment',
      shipment.id,
      `Added ${pkg.trackingNumber} to ${shipment.reference}`,
      {
        reference: shipment.reference,
        package_id: pkg.id,
        tracking_number: pkg.trackingNumber,
      },
    )
  }

  return updated
}

export async function addPackagesToShipment(
  shipment: ShipmentRow,
  packageIds: string[],
  options?: { actor?: UserRow | null },
): Promise<[PackageRow[], Array<{ id: string; error: string; tracking_number?: string | null }>]> {
  const added: PackageRow[] = []
  const failed: Array<{ id: string; error: string; tracking_number?: string | null }> = []

  for (const rawId of packageIds) {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, String(rawId))).limit(1)
    if (!pkg) {
      failed.push({ id: String(rawId), error: 'Package not found' })
      continue
    }

    try {
      assertOpen(shipment)
      if (pkg.status !== 'received') {
        throw new Error(`${pkg.trackingNumber} is not in received status`)
      }
      const other = await findOtherOpenShipment(pkg, shipment)
      if (other) {
        throw new Error(`${pkg.trackingNumber} is already on departure ${other.reference}`)
      }
      const [updated] = await db
        .update(packages)
        .set({ shipmentId: shipment.id, updatedAt: new Date() })
        .where(eq(packages.id, pkg.id))
        .returning()
      added.push(updated)
    } catch (err) {
      failed.push({
        id: pkg.id,
        tracking_number: pkg.trackingNumber,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (added.length && options?.actor) {
    for (const pkg of added) {
      await logEntityAction(
        options.actor,
        ACTION_SHIPMENT_PACKAGE_ADDED,
        'shipment',
        shipment.id,
        `Added ${pkg.trackingNumber} to ${shipment.reference}`,
        {
          reference: shipment.reference,
          package_id: pkg.id,
          tracking_number: pkg.trackingNumber,
        },
      )
    }
  }

  return [added, failed]
}

export async function addPackageByTracking(
  shipment: ShipmentRow,
  tracking: string,
  options?: { actor?: UserRow | null },
): Promise<PackageRow> {
  const trimmed = tracking.trim()
  if (!trimmed) throw new Error('Tracking number is required')

  let [pkg] = await db
    .select()
    .from(packages)
    .where(sql`lower(${packages.trackingNumber}) = lower(${trimmed})`)
    .limit(1)

  if (!pkg && !trimmed.toUpperCase().startsWith('PB-')) {
    ;[pkg] = await db
      .select()
      .from(packages)
      .where(sql`lower(${packages.carrierTracking}) = lower(${trimmed})`)
      .limit(1)
  }

  if (!pkg) throw new Error(`Package ${tracking} not found`)
  return addPackageToShipment(shipment, pkg, options)
}

export async function removePackageFromShipment(
  shipment: ShipmentRow,
  pkg: PackageRow,
  options?: { actor?: UserRow | null },
): Promise<PackageRow> {
  assertOpen(shipment)
  if (pkg.shipmentId !== shipment.id) {
    throw new Error(`${pkg.trackingNumber} is not on this departure`)
  }

  const [updated] = await db
    .update(packages)
    .set({ shipmentId: null, updatedAt: new Date() })
    .where(eq(packages.id, pkg.id))
    .returning()

  if (options?.actor) {
    await logEntityAction(
      options.actor,
      ACTION_SHIPMENT_PACKAGE_REMOVED,
      'shipment',
      shipment.id,
      `Removed ${pkg.trackingNumber} from ${shipment.reference}`,
      {
        reference: shipment.reference,
        package_id: pkg.id,
        tracking_number: pkg.trackingNumber,
      },
    )
  }

  return updated
}

export async function departShipment(
  shipment: ShipmentRow,
  options?: { actor?: UserRow | null; note?: string | null },
): Promise<[PackageRow[], Array<{ id: string; error: string; tracking_number?: string }>]> {
  assertOpen(shipment)

  const shipmentPackages = await db.select().from(packages).where(eq(packages.shipmentId, shipment.id))
  if (!shipmentPackages.length) throw new Error('Add at least one package before departing')

  const eventNote =
    options?.note?.trim() ||
    `Departure ${shipment.reference} — ${shipment.departureDate}`

  const updated: PackageRow[] = []
  const failed: Array<{ id: string; error: string; tracking_number?: string }> = []

  for (const pkg of shipmentPackages) {
    if (pkg.status !== 'received') {
      failed.push({
        id: pkg.id,
        tracking_number: pkg.trackingNumber,
        error: `Package is ${pkg.status}, expected received`,
      })
      continue
    }
    try {
      await addPackageEvent(pkg, 'in_transit', eventNote)
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

  if (failed.length) {
    throw new Error(
      `Could not depart: ${failed.length} package(s) failed. Fix issues and try again.`,
    )
  }

  if (!updated.length) throw new Error('No packages could be marked in transit')

  const now = new Date()
  await db
    .update(shipments)
    .set({ status: 'departed', departedAt: now, updatedAt: now })
    .where(eq(shipments.id, shipment.id))

  if (options?.actor) {
    await logEntityAction(
      options.actor,
      ACTION_SHIPMENT_DEPARTED,
      'shipment',
      shipment.id,
      `Departed ${shipment.reference} with ${updated.length} package(s)`,
      {
        reference: shipment.reference,
        departure_date: shipment.departureDate,
        package_ids: updated.map((p) => p.id),
        failed_count: failed.length,
      },
    )
    for (const pkg of updated) {
      await logPackageAction(
        options.actor,
        ACTION_PACKAGE_STATUS_UPDATED,
        pkg.id,
        `${pkg.trackingNumber}: received → in transit (${shipment.reference})`,
        {
          tracking_number: pkg.trackingNumber,
          from_status: 'received',
          to_status: 'in_transit',
          shipment_id: shipment.id,
          shipment_reference: shipment.reference,
        },
      )
    }
  }

  return [updated, failed]
}

export async function countOpenShipments(): Promise<number> {
  const rows = await db.select({ value: count() }).from(shipments).where(eq(shipments.status, 'open'))
  return Number(rows[0]?.value ?? 0)
}

export async function batchDepartPackages(
  packageIds: string[],
  options?: {
    shipmentId?: string | null
    reference?: string | null
    departureDate?: string | null
    note?: string | null
    actor?: UserRow | null
  },
): Promise<[ShipmentRow, PackageRow[]]> {
  if (!packageIds.length) throw new Error('package_ids must be a non-empty array')
  if (packageIds.length > 500) throw new Error('Cannot depart more than 500 packages at once')

  let shipment: ShipmentRow

  if (options?.shipmentId) {
    const found = await getShipment(options.shipmentId)
    if (!found) throw new Error('Departure not found')
    assertOpen(found)
    shipment = found
  } else {
    const reference = (options?.reference ?? '').trim()
    if (!reference) throw new Error('Departure reference is required')
    if (!options?.departureDate) throw new Error('departure_date is required')
    shipment = await createShipment({
      reference,
      departureDate: options.departureDate,
      note: options.note,
      createdBy: options.actor ?? null,
    })
    if (options?.actor) {
      await logEntityAction(
        options.actor,
        ACTION_SHIPMENT_CREATED,
        'shipment',
        shipment.id,
        `Created departure ${reference}`,
        {
          reference,
          departure_date: options.departureDate,
          batch_depart: true,
        },
      )
    }
  }

  const assigned: PackageRow[] = []
  for (const rawId of packageIds) {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, String(rawId))).limit(1)
    if (!pkg) throw new Error(`Package not found: ${rawId}`)
    if (pkg.status !== 'received') {
      throw new Error(`${pkg.trackingNumber} is not in received status`)
    }
    const other = await findOtherOpenShipment(pkg, shipment)
    if (other) {
      throw new Error(`${pkg.trackingNumber} is already on departure ${other.reference}`)
    }
    const [updated] = await db
      .update(packages)
      .set({ shipmentId: shipment.id, updatedAt: new Date() })
      .where(eq(packages.id, pkg.id))
      .returning()
    assigned.push(updated)
  }

  if (!assigned.length) throw new Error('No packages to depart')

  const eventNote =
    options?.note?.trim() ||
    `Departure ${shipment.reference} — ${shipment.departureDate}`

  const updated: PackageRow[] = []
  for (const pkg of assigned) {
    await addPackageEvent(pkg, 'in_transit', eventNote)
    const [fresh] = await db.select().from(packages).where(eq(packages.id, pkg.id)).limit(1)
    if (fresh) updated.push(fresh)
  }

  const now = new Date()
  await db
    .update(shipments)
    .set({ status: 'departed', departedAt: now, updatedAt: now })
    .where(eq(shipments.id, shipment.id))

  if (options?.actor) {
    for (const pkg of assigned) {
      await logEntityAction(
        options.actor,
        ACTION_SHIPMENT_PACKAGE_ADDED,
        'shipment',
        shipment.id,
        `Added ${pkg.trackingNumber} to ${shipment.reference}`,
        {
          reference: shipment.reference,
          package_id: pkg.id,
          tracking_number: pkg.trackingNumber,
          batch_depart: true,
        },
      )
    }
    await logEntityAction(
      options.actor,
      ACTION_SHIPMENT_DEPARTED,
      'shipment',
      shipment.id,
      `Departed ${shipment.reference} with ${updated.length} package(s)`,
      {
        reference: shipment.reference,
        departure_date: shipment.departureDate,
        package_ids: updated.map((p) => p.id),
        batch_depart: true,
      },
    )
    for (const pkg of updated) {
      await logPackageAction(
        options.actor,
        ACTION_PACKAGE_STATUS_UPDATED,
        pkg.id,
        `${pkg.trackingNumber}: received → in transit (${shipment.reference})`,
        {
          tracking_number: pkg.trackingNumber,
          from_status: 'received',
          to_status: 'in_transit',
          shipment_id: shipment.id,
          shipment_reference: shipment.reference,
          batch_depart: true,
        },
      )
    }
  }

  const [finalShipment] = await db.select().from(shipments).where(eq(shipments.id, shipment.id)).limit(1)
  return [finalShipment!, updated]
}
