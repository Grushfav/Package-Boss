import { MAX_AUTO_RATE_LBS, QUOTE_MESSAGE } from '../data/revisedRateTable.js'
import type { packages } from '../db/schema/index.js'
import { billableWeightLbs, calculateShippingCost } from './shippingService.js'

type PackageRow = typeof packages.$inferSelect

function decimal(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(n)) return null
  return Math.round(n * 100) / 100
}

export function computeTotalDue(
  freight: number | null,
  duties: number | null,
  handling: number | null,
  other: number | null,
): number | null {
  if ([freight, duties, handling, other].every((p) => p == null)) return null
  let total = 0
  for (const part of [freight, duties, handling, other]) {
    if (part != null) total += part
  }
  return Math.round(total * 100) / 100
}

export function ensureFreightJmd(pkg: PackageRow): void {
  if (pkg.billableWeightLbs == null && pkg.actualWeightLbs == null) {
    throw new Error(`${pkg.trackingNumber} has no weight on file`)
  }

  const existingFreight = pkg.estimatedFreightJmd != null ? parseFloat(pkg.estimatedFreightJmd) : null
  if (existingFreight != null && existingFreight > 0) return

  const weight =
    pkg.actualWeightLbs != null
      ? parseFloat(pkg.actualWeightLbs)
      : pkg.billableWeightLbs ?? 0
  const billable = billableWeightLbs(weight)
  if (billable > MAX_AUTO_RATE_LBS) {
    throw new Error(`${pkg.trackingNumber}: ${QUOTE_MESSAGE}`)
  }

  const quote = calculateShippingCost(weight)
  ;(pkg as { estimatedFreightJmd?: string | null }).estimatedFreightJmd = String(quote.cost_jmd)
  ;(pkg as { rateTierLabel?: string | null }).rateTierLabel = quote.tier_label
  if (pkg.billableWeightLbs == null) {
    ;(pkg as { billableWeightLbs?: number | null }).billableWeightLbs = quote.billable_weight_lbs
  }
}

export function publishReadyForPickupBill(
  pkg: PackageRow,
  options?: {
    estimatedFreightJmd?: number | null
    dutiesJmd?: number | null
    handlingJmd?: number | null
    otherFeesJmd?: number | null
  },
): void {
  if (options?.estimatedFreightJmd != null) {
    ;(pkg as { estimatedFreightJmd?: string | null }).estimatedFreightJmd = String(
      decimal(options.estimatedFreightJmd),
    )
  }
  ensureFreightJmd(pkg)

  if (options?.dutiesJmd != null) {
    ;(pkg as { dutiesJmd?: string | null }).dutiesJmd = String(decimal(options.dutiesJmd))
  }
  if (options?.handlingJmd != null) {
    ;(pkg as { handlingJmd?: string | null }).handlingJmd = String(decimal(options.handlingJmd))
  }
  if (options?.otherFeesJmd != null) {
    ;(pkg as { otherFeesJmd?: string | null }).otherFeesJmd = String(decimal(options.otherFeesJmd))
  }

  const freight = pkg.estimatedFreightJmd != null ? parseFloat(pkg.estimatedFreightJmd) : null
  const duties = pkg.dutiesJmd != null ? parseFloat(pkg.dutiesJmd) : null
  const handling = pkg.handlingJmd != null ? parseFloat(pkg.handlingJmd) : null
  const other = pkg.otherFeesJmd != null ? parseFloat(pkg.otherFeesJmd) : null
  const total = computeTotalDue(freight, duties, handling, other)

  if (total == null || total <= 0) {
    throw new Error(`Could not calculate bill for ${pkg.trackingNumber}`)
  }

  ;(pkg as { totalDueJmd?: string | null }).totalDueJmd = String(total)
  ;(pkg as { billingStatus?: string }).billingStatus = 'ready'
}
