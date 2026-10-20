/**
 * Customer email notifications for package status changes (single or batched).
 * Mirrors Flask app.services.package_status_notification_service.
 */
import { eq, inArray } from 'drizzle-orm'

import { SHIPPER_LABELS, UNIDENTIFIED_HOLDER_SHIPPING_ID } from '../constants.js'
import { db } from '../db/index.js'
import { packages, users, type UserRow } from '../db/schema/index.js'
import { EmailServiceError, sendPackageStatusBatchEmail, sendPackageStatusEmail } from './emailService.js'

type PackageRow = typeof packages.$inferSelect

export type StatusNotifyEntry = [PackageRow, string | null]

/**
 * Defer batch emails so the HTTP response returns first (Flask uses a background thread).
 */
export function scheduleNotifyCustomersOfStatusBatch(
  entries: StatusNotifyEntry[],
  status: string,
): void {
  const snapshots: Array<[string, string | null]> = []
  const seen = new Set<string>()
  for (const [pkg, note] of entries) {
    if (seen.has(pkg.id)) continue
    if (pkg.status !== status || !pkg.customerId) continue
    seen.add(pkg.id)
    snapshots.push([pkg.id, note])
  }

  if (!snapshots.length) return

  setImmediate(() => {
    void (async () => {
      try {
        const ids = snapshots.map(([id]) => id)
        const rows = await db.select().from(packages).where(inArray(packages.id, ids))
        const byId = new Map(rows.map((row) => [row.id, row]))
        const rebuilt: StatusNotifyEntry[] = []
        for (const [packageId, note] of snapshots) {
          const pkg = byId.get(packageId)
          if (pkg?.customerId) rebuilt.push([pkg, note])
        }
        if (rebuilt.length) {
          await notifyCustomersOfStatusBatch(rebuilt, status, { verifyStatus: false })
        }
      } catch (err) {
        console.error(
          `Deferred status email failed for status=${status} (${snapshots.length} packages):`,
          err,
        )
      }
    })()
  })
}

/** Send one email per customer (per shared note) when multiple packages change together. */
export async function notifyCustomersOfStatusBatch(
  entries: StatusNotifyEntry[],
  status: string,
  opts: { verifyStatus?: boolean } = {},
): Promise<void> {
  const verifyStatus = opts.verifyStatus !== false
  const seenPackageIds = new Set<string>()
  const groups = new Map<string, { customerId: string; note: string | null; packages: PackageRow[] }>()

  for (const [pkg, note] of entries) {
    if (seenPackageIds.has(pkg.id)) continue
    if (!pkg.customerId) continue
    if (verifyStatus && pkg.status !== status) continue
    seenPackageIds.add(pkg.id)
    const key = `${pkg.customerId}\0${note ?? ''}`
    const existing = groups.get(key)
    if (existing) {
      existing.packages.push(pkg)
    } else {
      groups.set(key, { customerId: pkg.customerId, note: note ?? null, packages: [pkg] })
    }
  }

  for (const group of groups.values()) {
    const [customer] = await db
      .select()
      .from(users)
      .where(eq(users.id, group.customerId))
      .limit(1)
    if (!customer || customer.shippingId === UNIDENTIFIED_HOLDER_SHIPPING_ID) continue

    if (group.packages.length === 1) {
      await notifyPackageStatusEmail(group.packages[0]!, customer, status, group.note)
    } else {
      await notifyPackageStatusBatchEmail(customer, group.packages, status, group.note)
    }
  }
}

async function notifyPackageStatusEmail(
  pkg: PackageRow,
  customer: UserRow,
  status: string,
  note?: string | null,
): Promise<void> {
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

async function notifyPackageStatusBatchEmail(
  customer: UserRow,
  pkgs: PackageRow[],
  status: string,
  note?: string | null,
): Promise<void> {
  try {
    await sendPackageStatusBatchEmail(customer.email, customer.firstName, pkgs, status, {
      note: note ?? null,
    })
  } catch (err) {
    if (err instanceof EmailServiceError) {
      console.error(
        `Batch status email failed for ${pkgs.length} packages → ${customer.email}: ${err.message}`,
      )
    } else {
      console.warn(`Failed to send batch status email (${pkgs.length} packages): ${err}`)
    }
  }
}
