import { MULTI_PACKAGE_HANDLING_FEE_JMD } from './checkoutHandling'
import type { Package } from '../types'

export interface DashboardPackageStats {
  readyPickupDelivery: number
  receivedFortLauderdale: number
  inTransit: number
  customs: number
  payablePackageCount: number
  handlingFeeJmd: number
  totalDueJmd: number
}

const FORT_LAUDERDALE_STATUSES = new Set(['received'])
const READY_PICKUP_DELIVERY_STATUSES = new Set(['ready_for_pickup'])

export function computeDashboardPackageStats(packages: Package[]): DashboardPackageStats {
  let totalDueJmd = 0
  let readyPickupDelivery = 0
  let receivedFortLauderdale = 0
  let inTransit = 0
  let customs = 0
  let payablePackageCount = 0

  for (const pkg of packages) {
    if (
      pkg.billing_status === 'ready' &&
      pkg.total_due_jmd != null &&
      READY_PICKUP_DELIVERY_STATUSES.has(pkg.status)
    ) {
      totalDueJmd += pkg.total_due_jmd
      payablePackageCount += 1
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
    if (pkg.status === 'customs') {
      customs += 1
    }
  }

  const handlingFeeJmd =
    payablePackageCount > 1 ? MULTI_PACKAGE_HANDLING_FEE_JMD : 0

  return {
    totalDueJmd: totalDueJmd + handlingFeeJmd,
    handlingFeeJmd,
    payablePackageCount,
    readyPickupDelivery,
    receivedFortLauderdale,
    inTransit,
    customs,
  }
}

export function formatDashboardTotalDue(amount: number): string {
  if (amount === Math.trunc(amount)) {
    return `J$${amount.toLocaleString('en-JM')}`
  }
  return `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
