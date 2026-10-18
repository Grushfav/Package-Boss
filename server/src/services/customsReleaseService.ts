import { eq, sql } from 'drizzle-orm'
import { packages } from '../db/schema/index.js'

type PackageRow = typeof packages.$inferSelect
import { db } from '../db/index.js'
import { publishReadyForPickupBill } from './billingCalculations.js'
import { requestPackageInvoice } from './billingService.js'
import { addPackageEvent } from './packageService.js'

export async function releasePackageFromCustoms(
  pkg: PackageRow,
  opts: {
    estimatedFreightJmd?: number | null
    dutiesJmd?: number | null
    handlingJmd?: number | null
    otherFeesJmd?: number | null
    note?: string | null
  } = {},
): Promise<PackageRow> {
  if (pkg.status !== 'customs') {
    throw new Error(`${pkg.trackingNumber} is not in customs`)
  }

  const mutable: PackageRow = { ...pkg }
  publishReadyForPickupBill(mutable, {
    estimatedFreightJmd: opts.estimatedFreightJmd,
    dutiesJmd: opts.dutiesJmd,
    handlingJmd: opts.handlingJmd,
    otherFeesJmd: opts.otherFeesJmd,
  })

  await db
    .update(packages)
    .set({
      estimatedFreightJmd: mutable.estimatedFreightJmd,
      dutiesJmd: mutable.dutiesJmd,
      handlingJmd: mutable.handlingJmd,
      otherFeesJmd: mutable.otherFeesJmd,
      totalDueJmd: mutable.totalDueJmd,
      billingStatus: mutable.billingStatus,
      rateTierLabel: mutable.rateTierLabel,
      billableWeightLbs: mutable.billableWeightLbs,
      updatedAt: sql`now()`,
    })
    .where(eq(packages.id, pkg.id))

  await addPackageEvent(
    mutable,
    'ready_for_pickup',
    opts.note ?? 'Released from customs — bill published',
  )

  const [updated] = await db.select().from(packages).where(eq(packages.id, pkg.id)).limit(1)
  return updated!
}

export async function releasePackagesFromCustoms(
  items: Array<Record<string, unknown>>,
  opts: { note?: string | null } = {},
): Promise<[PackageRow[], Array<Record<string, unknown>>]> {
  const released: PackageRow[] = []
  const failed: Array<Record<string, unknown>> = []

  for (const item of items) {
    const rawId = item.package_id
    const [pkg] = await db
      .select()
      .from(packages)
      .where(eq(packages.id, String(rawId)))
      .limit(1)
    if (!pkg) {
      failed.push({ id: String(rawId), error: 'Package not found' })
      continue
    }
    try {
      const updated = await releasePackageFromCustoms(pkg, {
        estimatedFreightJmd: item.estimated_freight_jmd as number | null | undefined,
        dutiesJmd: item.duties_jmd as number | null | undefined,
        handlingJmd: item.handling_jmd as number | null | undefined,
        otherFeesJmd: item.other_fees_jmd as number | null | undefined,
        note: (item.note as string | null | undefined) ?? opts.note,
      })
      released.push(updated)
    } catch (err) {
      failed.push({
        id: pkg.id,
        tracking_number: pkg.trackingNumber,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return [released, failed]
}

export async function bulkRequestCustomsInvoices(
  packageIds: unknown[],
  channel: string,
  note?: string | null,
): Promise<[Array<Record<string, unknown>>, Array<Record<string, unknown>>]> {
  const sent: Array<Record<string, unknown>> = []
  const failed: Array<Record<string, unknown>> = []

  for (const rawId of packageIds) {
    const [pkg] = await db
      .select()
      .from(packages)
      .where(eq(packages.id, String(rawId)))
      .limit(1)
    if (!pkg) {
      failed.push({ id: String(rawId), error: 'Package not found' })
      continue
    }
    if (pkg.status !== 'customs') {
      failed.push({
        id: pkg.id,
        tracking_number: pkg.trackingNumber,
        error: 'Package is not in customs',
      })
      continue
    }
    try {
      const result = await requestPackageInvoice(pkg, channel, note)
      sent.push({
        package_id: pkg.id,
        tracking_number: pkg.trackingNumber,
        ...result,
      })
    } catch (err) {
      failed.push({
        id: pkg.id,
        tracking_number: pkg.trackingNumber,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return [sent, failed]
}
