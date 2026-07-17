import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelDeliveryRequest } from '../../api/deliveryRequests'
import {
  formatPackageCost,
  packageCanUploadInvoice,
  packageEligibleForDeliveryRequest,
  packageNeedsInvoiceUpload,
} from '../../lib/packageBilling'
import { useCustomerData } from '../../context/CustomerDataContext'
import { RequestDeliveryModal } from './RequestDeliveryModal'
import { Button } from '../ui/Button'

export function PackagesHistoryPanel() {
  const { packages, packagesLoading, refreshPackages } = useCustomerData()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showRequestModal, setShowRequestModal] = useState(false)

  const eligiblePackages = packages.filter(packageEligibleForDeliveryRequest)
  const selectedPackages = packages.filter((pkg) => selectedIds.includes(pkg.id))

  function togglePackage(id: string) {
    if (!eligiblePackages.some((pkg) => pkg.id === id)) return
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }

  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function handleCancelDelivery(requestId: string) {
    if (!window.confirm('Cancel this delivery request?')) return
    setCancellingId(requestId)
    try {
      await cancelDeliveryRequest(requestId)
      await refreshPackages()
    } finally {
      setCancellingId(null)
    }
  }

  function toggleAllEligible() {
    if (selectedIds.length === eligiblePackages.length) {
      setSelectedIds([])
      return
    }
    setSelectedIds(eligiblePackages.map((pkg) => pkg.id))
  }

  return (
    <div>
      <div>
        <h2 className="text-lg font-bold uppercase tracking-wide">Packages</h2>
        <p className="mt-2 text-sm text-muted">
          Shipments received at our Fort Lauderdale warehouse and their status in Jamaica.
        </p>
      </div>

      {eligiblePackages.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 ? (
            <>
              <span className="rounded-full bg-boss-gold/15 px-3 py-1 text-xs font-semibold text-boss-gold">
                {selectedIds.length} selected
              </span>
              <Button type="button" className="!text-xs" onClick={() => setShowRequestModal(true)}>
                Request delivery
              </Button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs font-semibold text-muted hover:text-foreground"
              >
                Clear selection
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">
              Select ready packages to request home delivery in Kingston &amp; Portmore (
              <Link to="/dashboard/profile" className="font-semibold text-boss-gold hover:underline">
                manage addresses
              </Link>
              ).
            </p>
          )}
        </div>
      )}

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
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">
                    {eligiblePackages.length > 0 && (
                      <input
                        type="checkbox"
                        checked={
                          eligiblePackages.length > 0 &&
                          selectedIds.length === eligiblePackages.length
                        }
                        onChange={toggleAllEligible}
                        aria-label="Select all eligible packages"
                      />
                    )}
                  </th>
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
                  const canSelect = packageEligibleForDeliveryRequest(pkg)
                  return (
                  <tr
                    key={pkg.id}
                    className={index % 2 === 0 ? 'bg-card' : 'bg-background/40'}
                  >
                    <td className="border-t border-border px-4 py-3">
                      {canSelect ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(pkg.id)}
                          onChange={() => togglePackage(pkg.id)}
                          aria-label={`Select ${pkg.tracking_number}`}
                        />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </td>
                    <td className="border-t border-border px-4 py-3 font-mono text-foreground">
                      {pkg.carrier_tracking || '—'}
                    </td>
                    <td className="border-t border-border px-4 py-3 text-foreground">
                      {pkg.shipper_label || pkg.shipper || '—'}
                    </td>
                    <td className="border-t border-border px-4 py-3 font-mono font-bold text-boss-gold">
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
                      <div className="flex flex-col gap-1">
                        <span className="inline-block w-fit rounded-full bg-boss-gold/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-boss-gold">
                          {pkg.status_label}
                        </span>
                        {pkg.pending_delivery_request && (
                          <span
                            className={`inline-block w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
                              pkg.pending_delivery_request.status === 'in_progress'
                                ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                                : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                            }`}
                          >
                            {pkg.pending_delivery_request.status === 'in_progress'
                              ? 'Delivery in progress'
                              : 'Delivery requested'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border-t border-border px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {packageCanUploadInvoice(pkg) && (
                          <Link
                            to={`/packages/${pkg.id}/upload-invoice`}
                            className={
                              packageNeedsInvoiceUpload(pkg)
                                ? 'rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-500/25 dark:text-amber-300'
                                : 'rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-boss-gold/40 hover:text-boss-gold'
                            }
                          >
                            Upload invoice
                          </Link>
                        )}
                        {pkg.pending_delivery_request?.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleCancelDelivery(pkg.pending_delivery_request!.id)}
                            disabled={cancellingId === pkg.pending_delivery_request.id}
                            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-red-400/40 hover:text-red-600"
                          >
                            {cancellingId === pkg.pending_delivery_request.id
                              ? 'Cancelling…'
                              : 'Cancel delivery'}
                          </button>
                        )}
                        {pkg.invoice_status === 'received' && pkg.invoice_url && (
                          <a
                            href={pkg.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:border-boss-gold/40 hover:text-boss-gold"
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

      {showRequestModal && selectedPackages.length > 0 && (
        <RequestDeliveryModal
          packages={selectedPackages}
          onClose={() => setShowRequestModal(false)}
          onSubmitted={async () => {
            setSelectedIds([])
            await refreshPackages()
          }}
        />
      )}
    </div>
  )
}
