import type { Package } from '../types'
import { formatJmd } from './money'
import { isCustomerBillVisible } from './packageStatuses'

export function formatPackageBilling(pkg: Package, options?: { customer?: boolean }): string {
  const customerView = options?.customer ?? false
  if (customerView && !isCustomerBillVisible(pkg.status)) {
    return 'Bill pending'
  }
  if (pkg.billing_status === 'ready' || pkg.billing_status === 'paid') {
    if (pkg.total_due_jmd != null) {
      return `${formatJmd(pkg.total_due_jmd)} due`
    }
  }
  if (!customerView && pkg.estimated_freight_jmd != null) {
    return `${formatJmd(pkg.estimated_freight_jmd)} shipping est.`
  }
  return 'Bill pending'
}

/** Total cost after clerk publishes billing; null until then (or before ready_for_pickup for customers). */
export function formatPackageCost(pkg: Package, options?: { customer?: boolean }): string | null {
  const customerView = options?.customer ?? false
  if (customerView && !isCustomerBillVisible(pkg.status)) {
    return null
  }
  if (
    (pkg.billing_status === 'ready' || pkg.billing_status === 'paid') &&
    pkg.total_due_jmd != null
  ) {
    return formatJmd(pkg.total_due_jmd)
  }
  return null
}

export function packageNeedsInvoiceUpload(pkg: Package): boolean {
  return pkg.invoice_status === 'requested'
}

export function packageCanUploadInvoice(pkg: Package): boolean {
  return pkg.invoice_status === 'pending' || pkg.invoice_status === 'requested'
}

export function packageHasAdditionalFees(pkg: Package): boolean {
  return (
    (pkg.duties_jmd != null && pkg.duties_jmd > 0) ||
    (pkg.handling_jmd != null && pkg.handling_jmd > 0) ||
    (pkg.other_fees_jmd != null && pkg.other_fees_jmd > 0)
  )
}

export function packageEligibleForPayment(pkg: Package): boolean {
  return pkg.status === 'ready_for_pickup' && pkg.billing_status === 'ready'
}

export function packageEligibleForDeliveryRequest(pkg: Package): boolean {
  return pkg.status === 'ready_for_pickup' && !pkg.pending_delivery_request
}

export function packageEligibleForDeliveryRelease(pkg: Package): boolean {
  return pkg.status === 'ready_for_pickup' && pkg.billing_status === 'paid'
}

/** @deprecated use packageEligibleForDeliveryRelease */
export function packageEligibleForDelivery(pkg: Package): boolean {
  return packageEligibleForDeliveryRelease(pkg)
}

export function packagePaymentConfirmed(pkg: Package): boolean {
  return pkg.billing_status === 'paid'
}
