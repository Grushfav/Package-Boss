import type { Package } from '../types'

export function formatPackageBilling(pkg: Package): string {
  if (pkg.billing_status === 'ready' || pkg.billing_status === 'paid') {
    if (pkg.total_due_usd != null) {
      return `$${pkg.total_due_usd.toFixed(2)} USD due`
    }
  }
  if (pkg.estimated_freight_usd != null) {
    return `~$${pkg.estimated_freight_usd.toFixed(2)} freight est.`
  }
  return 'Bill pending'
}

/** Total cost after clerk publishes billing; null until then. */
export function formatPackageCost(pkg: Package): string | null {
  if (
    (pkg.billing_status === 'ready' || pkg.billing_status === 'paid') &&
    pkg.total_due_usd != null
  ) {
    return `$${pkg.total_due_usd.toFixed(2)}`
  }
  return null
}

export function packageNeedsInvoiceUpload(pkg: Package): boolean {
  return pkg.invoice_status === 'requested'
}

export function packageCanUploadInvoice(pkg: Package): boolean {
  return pkg.invoice_status === 'pending' || pkg.invoice_status === 'requested'
}
