import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { auditLogs, packageEvents, packages, shipments } from '../db/schema/index.js'
import type { packages as packagesTable, shipments as shipmentsTable } from '../db/schema/index.js'
import type { UserRow } from '../db/schema/index.js'
import { userFullName } from '../lib/user.js'
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
      await addPackageEvent(pkg, 'in_transit', eventNote, { skipStatusEmail: true })
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

  const { scheduleNotifyCustomersOfStatusBatch } = await import(
    './packageStatusNotificationService.js'
  )
  scheduleNotifyCustomersOfStatusBatch(
    updated.map((pkg) => [pkg, eventNote] as [PackageRow, string | null]),
    'in_transit',
  )

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

  const uniqueIds = [...new Set(packageIds.map((id) => String(id)))]
  const actor = options?.actor ?? null
  const noteTrimmed = options?.note?.trim() || null

  const result = await db.transaction(async (tx) => {
    let shipment: ShipmentRow

    if (options?.shipmentId) {
      const [found] = await tx
        .select()
        .from(shipments)
        .where(eq(shipments.id, options.shipmentId))
        .limit(1)
      if (!found) throw new Error('Departure not found')
      assertOpen(found)
      shipment = found
    } else {
      const reference = (options?.reference ?? '').trim()
      if (!reference) throw new Error('Departure reference is required')
      if (!options?.departureDate) throw new Error('departure_date is required')
      const [created] = await tx
        .insert(shipments)
        .values({
          id: crypto.randomUUID(),
          reference,
          departureDate: options.departureDate,
          note: noteTrimmed,
          status: 'open',
          createdById: actor?.id ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
      shipment = created!
      if (actor) {
        await tx.insert(auditLogs).values({
          actorId: actor.id,
          actorName: userFullName(actor),
          actorRole: actor.role,
          action: ACTION_SHIPMENT_CREATED,
          entityType: 'shipment',
          entityId: shipment.id,
          summary: `Created departure ${reference}`,
          metadataJson: {
            reference,
            departure_date: options.departureDate,
            batch_depart: true,
          },
        })
      }
    }

    const rows = await tx.select().from(packages).where(inArray(packages.id, uniqueIds))
    const byId = new Map(rows.map((pkg) => [pkg.id, pkg]))
    const ordered: PackageRow[] = []
    for (const id of uniqueIds) {
      const pkg = byId.get(id)
      if (!pkg) throw new Error(`Package not found: ${id}`)
      ordered.push(pkg)
    }

    const notReceived = ordered.filter((pkg) => pkg.status !== 'received')
    if (notReceived.length) {
      const sample = notReceived
        .slice(0, 5)
        .map((pkg) => `${pkg.trackingNumber} (${pkg.status})`)
        .join(', ')
      const more = notReceived.length > 5 ? ` (+${notReceived.length - 5} more)` : ''
      throw new Error(
        `${notReceived.length} package(s) are not in received status: ${sample}${more}`,
      )
    }

    const otherShipmentIds = [
      ...new Set(
        ordered
          .map((pkg) => pkg.shipmentId)
          .filter((id): id is string => Boolean(id) && id !== shipment.id),
      ),
    ]
    if (otherShipmentIds.length) {
      const openOthers = await tx
        .select()
        .from(shipments)
        .where(and(inArray(shipments.id, otherShipmentIds), eq(shipments.status, 'open')))
      if (openOthers.length) {
        const openById = new Map(openOthers.map((row) => [row.id, row]))
        const conflict = ordered.find((pkg) => pkg.shipmentId && openById.has(pkg.shipmentId))
        if (conflict) {
          const other = openById.get(conflict.shipmentId!)!
          throw new Error(
            `${conflict.trackingNumber} is already on departure ${other.reference}`,
          )
        }
      }
    }

    const now = new Date()
    const eventNote =
      noteTrimmed || `Departure ${shipment.reference} — ${shipment.departureDate}`
    const ids = ordered.map((pkg) => pkg.id)

    await tx
      .update(packages)
      .set({
        shipmentId: shipment.id,
        status: 'in_transit',
        updatedAt: now,
      })
      .where(inArray(packages.id, ids))

    await tx.insert(packageEvents).values(
      ordered.map((pkg) => ({
        id: crypto.randomUUID(),
        packageId: pkg.id,
        status: 'in_transit',
        note: eventNote,
        createdAt: now,
      })),
    )

    const [departedShipment] = await tx
      .update(shipments)
      .set({
        status: 'departed',
        departedAt: now,
        updatedAt: now,
      })
      .where(eq(shipments.id, shipment.id))
      .returning()

    const updated: PackageRow[] = ordered.map((pkg) => ({
      ...pkg,
      shipmentId: shipment.id,
      status: 'in_transit',
      updatedAt: now,
    }))

    if (actor) {
      if (actor.role !== 'clerk' && actor.role !== 'admin') {
        throw new Error('Only clerk or admin actions are logged here')
      }
      await tx.insert(auditLogs).values([
        {
          actorId: actor.id,
          actorName: userFullName(actor),
          actorRole: actor.role,
          action: ACTION_SHIPMENT_PACKAGE_ADDED,
          entityType: 'shipment',
          entityId: shipment.id,
          summary: `Added ${updated.length} package(s) to ${shipment.reference}`,
          metadataJson: {
            reference: shipment.reference,
            package_ids: ids,
            tracking_numbers: updated.map((pkg) => pkg.trackingNumber),
            batch_depart: true,
          },
        },
        {
          actorId: actor.id,
          actorName: userFullName(actor),
          actorRole: actor.role,
          action: ACTION_SHIPMENT_DEPARTED,
          entityType: 'shipment',
          entityId: shipment.id,
          summary: `Departed ${shipment.reference} with ${updated.length} package(s)`,
          metadataJson: {
            reference: shipment.reference,
            departure_date: shipment.departureDate,
            package_ids: ids,
            batch_depart: true,
          },
        },
        ...updated.map((pkg) => ({
          actorId: actor.id,
          actorName: userFullName(actor),
          actorRole: actor.role,
          action: ACTION_PACKAGE_STATUS_UPDATED,
          entityType: 'package' as const,
          entityId: pkg.id,
          summary: `${pkg.trackingNumber}: received → in transit (${shipment.reference})`,
          metadataJson: {
            tracking_number: pkg.trackingNumber,
            from_status: 'received',
            to_status: 'in_transit',
            shipment_id: shipment.id,
            shipment_reference: shipment.reference,
            batch_depart: true,
          },
        })),
      ])
    }

    return [departedShipment!, updated, eventNote] as const
  })

  const [finalShipment, updated, eventNote] = result

  const { scheduleNotifyCustomersOfStatusBatch } = await import(
    './packageStatusNotificationService.js'
  )
  scheduleNotifyCustomersOfStatusBatch(
    updated.map((pkg) => [pkg, eventNote] as [PackageRow, string | null]),
    'in_transit',
  )

  return [finalShipment, updated]
}
