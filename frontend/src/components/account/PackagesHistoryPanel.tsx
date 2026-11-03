import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelDeliveryRequest } from '../../api/deliveryRequests'
import {
  formatPackageCost,
  formatPackageWeight,
  packageCanUploadInvoice,
  packageEligibleForDeliveryRequest,
  packageNeedsInvoiceUpload,
} from '../../lib/packageBilling'
import { useCustomerData } from '../../context/CustomerDataContext'
import { formatJmd } from '../../lib/money'
import { isCustomerBillVisible } from '../../lib/packageStatuses'
import { PICKUP_HOURS_SHORT, PICKUP_LOCATION_LABEL, pendingFulfillmentBadge } from '../../lib/pickupLocation'
import { RequestDeliveryModal } from './RequestDeliveryModal'
import { ShippingHelpButton } from './ShippingHelpButton'
import { StatusBadge } from '../warehouse/StatusBadge'
import { Button } from '../ui/Button'
import type { Package } from '../../types'

const PAGE_SIZE = 15

function isCompletedPackage(pkg: Package) {
  return pkg.status === 'delivered'
}

function paginate<T>(items: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE
  return items.slice(start, start + PAGE_SIZE)
}

function totalPagesFor(count: number) {
  return Math.max(1, Math.ceil(count / PAGE_SIZE))
}

function packageTotalDisplay(pkg: Package): string | null {
  if (!isCustomerBillVisible(pkg.status)) return null
  if (pkg.billing_status !== 'ready' && pkg.billing_status !== 'paid') return null
  return formatPackageCost(pkg, { customer: true }) ?? formatJmd(pkg.total_due_jmd)
}

function PackageBillingBreakdown({ pkg }: { pkg: Package }) {
  if (!isCustomerBillVisible(pkg.status)) {
    return <p className="text-xs text-muted">Bill pending release</p>
  }

  if (pkg.billing_status !== 'ready' && pkg.billing_status !== 'paid') {
    return <p className="text-xs text-muted">Bill pending</p>
  }

  const rows: Array<{ label: string; value: number | null | undefined }> = [
    { label: 'Freight', value: pkg.estimated_freight_jmd },
    { label: 'Duties', value: pkg.duties_jmd },
    { label: 'Handling', value: pkg.handling_jmd },
    { label: 'Other fees', value: pkg.other_fees_jmd },
  ]

  const visibleRows = rows.filter((row) => row.value != null && row.value > 0)
  if (visibleRows.length === 0) return null

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
      {visibleRows.map((row) => (
        <p key={row.label} className="min-w-0">
          <span className="text-muted">{row.label}</span>{' '}
          <span className="font-semibold text-foreground">{formatJmd(row.value)}</span>
        </p>
      ))}
    </div>
  )
}

function PackageCard({
  pkg,
  showSelection,
  selected,
  canSelect,
  onToggle,
  onCancelDelivery,
  cancellingId,
}: {
  pkg: Package
  showSelection: boolean
  selected: boolean
  canSelect: boolean
  onToggle: (id: string) => void
  onCancelDelivery: (requestId: string) => void
  cancellingId: string | null
}) {
  const totalDue = packageTotalDisplay(pkg)

  const actions = (
    <>
      {packageCanUploadInvoice(pkg) && (
        <Link
          to={`/packages/${pkg.id}/upload-invoice`}
          className={
            packageNeedsInvoiceUpload(pkg)
              ? 'rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/25 dark:text-amber-300'
              : 'rounded-lg border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground hover:border-boss-gold/40 hover:text-boss-gold'
          }
        >
          Upload invoice
        </Link>
      )}
      {pkg.pending_delivery_request?.status === 'pending' && (
        <button
          type="button"
          onClick={() => onCancelDelivery(pkg.pending_delivery_request!.id)}
          disabled={cancellingId === pkg.pending_delivery_request.id}
          className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground hover:border-red-400/40 hover:text-red-600"
        >
          {cancellingId === pkg.pending_delivery_request.id ? 'Cancelling…' : 'Cancel request'}
        </button>
      )}
      {pkg.invoice_status === 'received' && pkg.invoice_url && (
        <a
          href={pkg.invoice_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground hover:border-boss-gold/40 hover:text-boss-gold"
        >
          View invoice
        </a>
      )}
    </>
  )

  return (
    <article className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        {showSelection && (
          <div className="pt-1">
            {canSelect ? (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(pkg.id)}
                aria-label={`Select ${pkg.tracking_number}`}
                className="rounded border-border"
              />
            ) : (
              <span className="inline-block w-4" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="font-mono text-sm font-bold text-boss-gold">{pkg.tracking_number}</p>
                <p className="truncate font-mono text-[11px] text-muted">
                  {pkg.carrier_tracking || '—'}
                </p>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                <p className="min-w-0 max-w-full sm:max-w-[14rem]">
                  <span className="text-muted">Item </span>
                  <span className="font-medium text-foreground">
                    {pkg.item_description ? (
                      <span className="line-clamp-1">{pkg.item_description}</span>
                    ) : (
                      '—'
                    )}
                  </span>
                </p>
                <p className="shrink-0">
                  <span className="text-muted">Shipper </span>
                  <span className="font-medium text-foreground">
                    {pkg.shipper_label || pkg.shipper || '—'}
                  </span>
                </p>
                <PackageBillingBreakdown pkg={pkg} />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <StatusBadge status={pkg.status} label={pkg.status_label} />
              {pkg.pending_delivery_request && (
                <span
                  className={`inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    pkg.pending_delivery_request.status === 'in_progress'
                      ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  }`}
                >
                  {pendingFulfillmentBadge(pkg.pending_delivery_request)}
                </span>
              )}
              <p className="pt-0.5 text-sm font-bold tabular-nums tracking-tight text-foreground">
                {formatPackageWeight(pkg)}
              </p>
              {totalDue && (
                <p className="text-sm font-black tabular-nums tracking-tight text-boss-gold">
                  {totalDue}
                  {pkg.billing_status === 'paid' && (
                    <span className="ml-1 text-[10px] font-semibold text-boss-green">Paid</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">{actions}</div>
        </div>
      </div>
    </article>
  )
}

function PackagePagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}) {
  if (totalItems <= PAGE_SIZE) return null

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        Page {page} of {totalPages} ({totalItems} packages)
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="!text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          className="!text-xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

type PackageCardsProps = {
  packages: Package[]
  page: number
  onPageChange: (page: number) => void
  showSelection: boolean
  selectedIds: string[]
  eligiblePackages: Package[]
  onTogglePackage: (id: string) => void
  onToggleAllEligible: () => void
  onCancelDelivery: (requestId: string) => void
  cancellingId: string | null
}

function PackageCards({
  packages,
  page,
  onPageChange,
  showSelection,
  selectedIds,
  eligiblePackages,
  onTogglePackage,
  onToggleAllEligible,
  onCancelDelivery,
  cancellingId,
}: PackageCardsProps) {
  const totalPages = totalPagesFor(packages.length)
  const safePage = Math.min(page, totalPages)
  const pagePackages = paginate(packages, safePage)
  const pageEligible = pagePackages.filter(packageEligibleForDeliveryRequest)
  const allPageEligibleSelected =
    pageEligible.length > 0 && pageEligible.every((pkg) => selectedIds.includes(pkg.id))

  return (
    <div>
      {showSelection && eligiblePackages.length > 0 && (
        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={allPageEligibleSelected}
            onChange={onToggleAllEligible}
            className="rounded border-border"
          />
          Select all eligible on this page
        </label>
      )}
      <div className="space-y-2">
        {pagePackages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            showSelection={showSelection}
            selected={selectedIds.includes(pkg.id)}
            canSelect={showSelection && packageEligibleForDeliveryRequest(pkg)}
            onToggle={onTogglePackage}
            onCancelDelivery={onCancelDelivery}
            cancellingId={cancellingId}
          />
        ))}
      </div>
      <PackagePagination
        page={safePage}
        totalPages={totalPages}
        totalItems={packages.length}
        onPageChange={onPageChange}
      />
    </div>
  )
}

export function PackagesHistoryPanel() {
  const { packages, packagesLoading, refreshPackages } = useCustomerData()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [activePage, setActivePage] = useState(1)
  const [completedPage, setCompletedPage] = useState(1)

  const activePackages = useMemo(
    () => packages.filter((pkg) => !isCompletedPackage(pkg)),
    [packages],
  )
  const completedPackages = useMemo(
    () => packages.filter(isCompletedPackage),
    [packages],
  )
  const readyForPickupPackages = useMemo(
    () => activePackages.filter((pkg) => pkg.status === 'ready_for_pickup'),
    [activePackages],
  )

  const eligiblePackages = activePackages.filter(packageEligibleForDeliveryRequest)
  const selectedPackages = activePackages.filter((pkg) => selectedIds.includes(pkg.id))

  useEffect(() => {
    setActivePage((page) => Math.min(page, totalPagesFor(activePackages.length)))
  }, [activePackages.length])

  useEffect(() => {
    setCompletedPage((page) => Math.min(page, totalPagesFor(completedPackages.length)))
  }, [completedPackages.length])

  function togglePackage(id: string) {
    if (!eligiblePackages.some((pkg) => pkg.id === id)) return
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }

  async function handleCancelDelivery(requestId: string) {
    if (!window.confirm('Cancel this pickup/delivery request?')) return
    setCancellingId(requestId)
    try {
      await cancelDeliveryRequest(requestId)
      await refreshPackages()
    } finally {
      setCancellingId(null)
    }
  }

  function toggleAllEligibleOnActivePage() {
    const pagePackages = paginate(activePackages, activePage)
    const pageEligible = pagePackages.filter(packageEligibleForDeliveryRequest)
    const allSelected =
      pageEligible.length > 0 && pageEligible.every((pkg) => selectedIds.includes(pkg.id))
    if (allSelected) {
      const pageIds = new Set(pageEligible.map((pkg) => pkg.id))
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)))
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const pkg of pageEligible) next.add(pkg.id)
      return [...next]
    })
  }

  const cardProps = {
    selectedIds,
    eligiblePackages,
    onTogglePackage: togglePackage,
    onToggleAllEligible: toggleAllEligibleOnActivePage,
    onCancelDelivery: handleCancelDelivery,
    cancellingId,
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold uppercase tracking-wide">Packages</h2>
        {packages.length > 0 && <ShippingHelpButton />}
      </div>

      {readyForPickupPackages.length > 0 && (
        <div className="mt-4 rounded-xl border border-boss-gold/35 bg-boss-gold/10 px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">Pickup or home delivery available</p>
          <p className="mt-1 text-muted">
            Packages marked{' '}
            <span className="font-semibold text-boss-gold">Ready for Pickup</span> can be collected
            free at {PICKUP_LOCATION_LABEL} ({PICKUP_HOURS_SHORT}), or delivered home in
            Kingston &amp; St.
            Andrew ($800 JMD) or Portmore ($1,000 JMD) per run. Select eligible packages below,
            then tap{' '}
            <span className="font-semibold text-foreground">Request pickup or delivery</span>.
          </p>
        </div>
      )}

      {eligiblePackages.length > 0 && selectedIds.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-boss-gold/15 px-3 py-1 text-xs font-semibold text-boss-gold">
            {selectedIds.length} selected
          </span>
          <Button type="button" className="!text-xs" onClick={() => setShowRequestModal(true)}>
            Request pickup or delivery
          </Button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="text-xs font-semibold text-muted hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      {packagesLoading && packages.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
          Loading packages...
        </p>
      ) : packages.length === 0 ? (
        <div className="relative mt-4 rounded-xl border border-border bg-card p-6 pr-16 text-sm text-muted">
          <div className="absolute right-3 top-3">
            <ShippingHelpButton />
          </div>
          No packages yet. Once your shipment is received at the Fort Lauderdale warehouse, it will appear
          here.
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Active</h3>
            <p className="mt-1 text-xs text-muted">
              Packages still moving through our warehouse and delivery process.
            </p>
            {activePackages.length === 0 ? (
              <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
                No active packages right now.
              </p>
            ) : (
              <div className="mt-4">
                <PackageCards
                  packages={activePackages}
                  page={activePage}
                  onPageChange={setActivePage}
                  showSelection
                  {...cardProps}
                />
              </div>
            )}
          </section>

          {completedPackages.length > 0 && (
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Completed</h3>
              <p className="mt-1 text-xs text-muted">Delivered packages.</p>
              <div className="mt-4">
                <PackageCards
                  packages={completedPackages}
                  page={completedPage}
                  onPageChange={setCompletedPage}
                  showSelection={false}
                  {...cardProps}
                />
              </div>
            </section>
          )}
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
