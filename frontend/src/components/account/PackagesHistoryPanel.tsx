import { Link } from 'react-router-dom'
import { formatPackageCost, packageCanUploadInvoice, packageNeedsInvoiceUpload } from '../../lib/packageBilling'
import { useCustomerData } from '../../context/CustomerDataContext'

export function PackagesHistoryPanel() {
  const { packages, packagesLoading } = useCustomerData()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wide">Packages</h2>
          <p className="mt-2 text-sm text-muted">
            Shipments received at our Fort Lauderdale warehouse and their status in Jamaica.
          </p>
        </div>
        <Link to="/dashboard/track" className="text-sm text-boss-green hover:underline">
          Track by number →
        </Link>
      </div>

      {packagesLoading && packages.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
          Loading packages...
        </p>
      ) : packages.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
          No packages yet. Once your shipment is received at the Fort Lauderdale warehouse, it will appear
          here.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Sent by (tracking)</th>
                  <th className="px-4 py-3">Shipper</th>
                  <th className="px-4 py-3">PB tracking</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg, index) => {
                  const weightLbs = pkg.billable_weight_lbs ?? pkg.actual_weight_lbs
                  const cost = formatPackageCost(pkg, { customer: true })
                  return (
                  <tr
                    key={pkg.id}
                    className={index % 2 === 0 ? 'bg-card' : 'bg-background/40'}
                  >
                    <td className="border-t border-border px-4 py-3 font-mono text-foreground">
                      {pkg.carrier_tracking || '—'}
                    </td>
                    <td className="border-t border-border px-4 py-3 text-foreground">
                      {pkg.shipper_label || pkg.shipper || '—'}
                    </td>
                    <td className="border-t border-border px-4 py-3 font-mono font-bold text-boss-green">
                      {pkg.tracking_number}
                    </td>
                    <td className="border-t border-border px-4 py-3 text-foreground">
                      {weightLbs != null ? `${weightLbs} lbs` : '—'}
                    </td>
                    <td className="border-t border-border px-4 py-3 text-foreground">
                      {cost ? (
                        <span>
                          {cost}
                          {pkg.billing_status === 'paid' && (
                            <span className="ml-1.5 text-xs font-semibold text-boss-green">Paid</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="border-t border-border px-4 py-3">
                      <span className="inline-block rounded-full bg-boss-green/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-boss-green">
                        {pkg.status_label}
                      </span>
                    </td>
                    <td className="border-t border-border px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/dashboard/track?tracking=${pkg.tracking_number}`}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-boss-green/40 hover:text-boss-green"
                        >
                          Track
                        </Link>
                        {packageCanUploadInvoice(pkg) && (
                          <Link
                            to={`/packages/${pkg.id}/upload-invoice`}
                            className={
                              packageNeedsInvoiceUpload(pkg)
                                ? 'rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-500/25 dark:text-amber-300'
                                : 'rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-boss-green/40 hover:text-boss-green'
                            }
                          >
                            Upload invoice
                          </Link>
                        )}
                        {pkg.invoice_status === 'received' && pkg.invoice_url && (
                          <a
                            href={pkg.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-boss-green/40 hover:text-boss-green"
                          >
                            View invoice
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
