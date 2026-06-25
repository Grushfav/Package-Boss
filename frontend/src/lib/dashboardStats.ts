import type { Package } from '../types'

export interface DashboardPackageStats {
  totalDueUsd: number
  readyPickupDelivery: number
  receivedFortLauderdale: number
  inTransit: number
}

const FORT_LAUDERDALE_STATUSES = new Set(['received_miami', 'processing'])
const READY_PICKUP_DELIVERY_STATUSES = new Set(['arrived_kingston', 'out_for_delivery'])

export function computeDashboardPackageStats(packages: Package[]): DashboardPackageStats {
  let totalDueUsd = 0
  let readyPickupDelivery = 0
  let receivedFortLauderdale = 0
  let inTransit = 0

  for (const pkg of packages) {
    if (pkg.billing_status === 'ready' && pkg.total_due_usd != null) {
      totalDueUsd += pkg.total_due_usd
    }
    if (READY_PICKUP_DELIVERY_STATUSES.has(pkg.status)) {
      readyPickupDelivery += 1
    }
    if (FORT_LAUDERDALE_STATUSES.has(pkg.status)) {
      receivedFortLauderdale += 1
    }
    if (pkg.status === 'in_transit') {
      inTransit += 1
    }
  }

  return {
    totalDueUsd,
    readyPickupDelivery,
    receivedFortLauderdale,
    inTransit,
  }
}

export function formatDashboardTotalDue(amount: number): string {
  return `$${amount.toFixed(2)}`
}
