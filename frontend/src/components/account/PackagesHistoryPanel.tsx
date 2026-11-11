import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelDeliveryRequest } from '../../api/deliveryRequests'
import { getErrorMessage } from '../../api/client'
import { fetchMyPackagePage } from '../../api/packages'
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
import { LoadErrorBanner } from '../ui/LoadErrorBanner'
import type { Package } from '../../types'

const ACTIVE_PAGE_SIZE = 10
const COMPLETED_PAGE_SIZE = 5

function totalPagesFor(count: number, pageSize: number) {
  return Math.max(1, Math.ceil(count / pageSize))
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
  pageSize,
  totalPages,
  totalItems,
  loading,
  onPageChange,
}: {
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  loading?: boolean
  onPageChange: (page: number) => void
}) {
  if (totalItems <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        {from}–{to} of {totalItems}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="!text-xs"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          className="!text-xs"
          disabled={loading || page >= totalPages}
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
  pageSize: number
  totalItems: number
  loading?: boolean
  onPageChange: (page: number) => void
  showSelection: boolean
  selectedIds: string[]
  onTogglePackage: (pkg: Package) => void
  onToggleAllEligible: () => void
  onCancelDelivery: (requestId: string) => void
  cancellingId: string | null
}

function PackageCards({
  packages,
  page,
  pageSize,
  totalItems,
  loading,
  onPageChange,
  showSelection,
  selectedIds,
  onTogglePackage,
  onToggleAllEligible,
  onCancelDelivery,
  cancellingId,
}: PackageCardsProps) {
  const totalPages = totalPagesFor(totalItems, pageSize)
  const pageEligible = packages.filter(packageEligibleForDeliveryRequest)
  const allPageEligibleSelected =
    pageEligible.length > 0 && pageEligible.every((pkg) => selectedIds.includes(pkg.id))

  return (
    <div>
      {showSelection && pageEligible.length > 0 && (
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
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            showSelection={showSelection}
            selected={selectedIds.includes(pkg.id)}
            canSelect={showSelection && packageEligibleForDeliveryRequest(pkg)}
            onToggle={() => onTogglePackage(pkg)}
            onCancelDelivery={onCancelDelivery}
            cancellingId={cancellingId}
          />
        ))}
      </div>
      <PackagePagination
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalItems={totalItems}
        loading={loading}
        onPageChange={onPageChange}
      />
    </div>
  )
}

export function PackagesHistoryPanel() {
  const { dashboardStats, packagesRevision, refreshPackages } = useCustomerData()
  const [selectedPackages, setSelectedPackages] = useState<Map<string, Package>>(new Map())
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [activePage, setActivePage] = useState(1)
  const [activePendingPage, setActivePendingPage] = useState<number | null>(null)
  const [completedPage, setCompletedPage] = useState(1)
  const [completedPendingPage, setCompletedPendingPage] = useState<number | null>(null)
  const [activePackages, setActivePackages] = useState<Package[]>([])
  const [activeTotal, setActiveTotal] = useState(0)
  const [completedPackages, setCompletedPackages] = useState<Package[]>([])
  const [completedTotal, setCompletedTotal] = useState(0)
  const [readyCount, setReadyCount] = useState<number | null>(null)
  const [activeLoading, setActiveLoading] = useState(true)
  const [completedLoading, setCompletedLoading] = useState(true)
  const [activeError, setActiveError] = useState('')
  const [completedError, setCompletedError] = useState('')

  const selectedIds = [...selectedPackages.keys()]
  const selectedList = [...selectedPackages.values()]
  const readyForPickupCount = readyCount ?? dashboardStats?.readyPickupDelivery ?? 0
  const hasPackages = activeTotal > 0 || completedTotal > 0
  const activePageToLoad = activePendingPage ?? activePage
  const completedPageToLoad = completedPendingPage ?? completedPage

  useEffect(() => {
    setSelectedPackages(new Map())
    setActivePage(1)
    setActivePendingPage(null)
    setCompletedPage(1)
    setCompletedPendingPage(null)
  }, [packagesRevision])

  useEffect(() => {
    let cancelled = false
    let keepLoading = false
    setActiveLoading(true)
    setActiveError('')
    fetchMyPackagePage('active', ACTIVE_PAGE_SIZE, (activePageToLoad - 1) * ACTIVE_PAGE_SIZE)
      .then((page) => {
        if (cancelled) return
        const pages = totalPagesFor(page.total, ACTIVE_PAGE_SIZE)
        const committedPage = Math.min(activePageToLoad, pages)
        setActiveTotal(page.total)
        setReadyCount(page.readyForPickupCount)
        if (committedPage !== activePageToLoad) {
          // Keep prior packages visible while re-fetching the clamped page.
          keepLoading = true
          setActivePage(committedPage)
          setActivePendingPage(committedPage)
          return
        }
        setActivePackages(page.packages)
        setActivePage(committedPage)
        setActivePendingPage(null)
        setSelectedPackages((current) => {
          if (current.size === 0) return current
          const next = new Map(current)
          for (const pkg of page.packages) {
            if (!next.has(pkg.id)) continue
            if (packageEligibleForDeliveryRequest(pkg)) next.set(pkg.id, pkg)
            else next.delete(pkg.id)
          }
          return next
        })
      })
      .catch((err) => {
        if (cancelled) return
        setActiveError(getErrorMessage(err))
        setActivePendingPage(null)
      })
      .finally(() => {
        if (!cancelled && !keepLoading) setActiveLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activePageToLoad, packagesRevision])

  useEffect(() => {
    let cancelled = false
    let keepLoading = false
    setCompletedLoading(true)
    setCompletedError('')
    fetchMyPackagePage('completed', COMPLETED_PAGE_SIZE, (completedPageToLoad - 1) * COMPLETED_PAGE_SIZE)
      .then((page) => {
        if (cancelled) return
        const pages = totalPagesFor(page.total, COMPLETED_PAGE_SIZE)
        const committedPage = Math.min(completedPageToLoad, pages)
        setCompletedTotal(page.total)
        if (committedPage !== completedPageToLoad) {
          keepLoading = true
          setCompletedPage(committedPage)
          setCompletedPendingPage(committedPage)
          return
        }
        setCompletedPackages(page.packages)
        setCompletedPage(committedPage)
        setCompletedPendingPage(null)
      })
      .catch((err) => {
        if (cancelled) return
        setCompletedError(getErrorMessage(err))
        setCompletedPendingPage(null)
      })
      .finally(() => {
        if (!cancelled && !keepLoading) setCompletedLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [completedPageToLoad, packagesRevision])

  function togglePackage(pkg: Package) {
    if (!packageEligibleForDeliveryRequest(pkg)) return
    setSelectedPackages((prev) => {
      const next = new Map(prev)
      if (next.has(pkg.id)) next.delete(pkg.id)
      else next.set(pkg.id, pkg)
      return next
    })
  }

  async function handleCancelDelivery(requestId: string) {
    if (!window.confirm('Cancel this pickup/delivery request?')) return
    setCancellingId(requestId)
    try {
      await cancelDeliveryRequest(requestId)
      setSelectedPackages(new Map())
      await refreshPackages()
    } finally {
      setCancellingId(null)
    }
  }

  function toggleAllEligibleOnActivePage() {
    const pageEligible = activePackages.filter(packageEligibleForDeliveryRequest)
    const allSelected =
      pageEligible.length > 0 && pageEligible.every((pkg) => selectedPackages.has(pkg.id))
    setSelectedPackages((prev) => {
      const next = new Map(prev)
      if (allSelected) {
        for (const pkg of pageEligible) next.delete(pkg.id)
      } else {
        for (const pkg of pageEligible) next.set(pkg.id, pkg)
      }
      return next
    })
  }

  const cardProps = {
    selectedIds,
    onTogglePackage: togglePackage,
    onToggleAllEligible: toggleAllEligibleOnActivePage,
    onCancelDelivery: handleCancelDelivery,
    cancellingId,
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold uppercase tracking-wide">Packages</h2>
        {hasPackages && <ShippingHelpButton />}
      </div>

      {readyForPickupCount > 0 && (
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

      {selectedList.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-boss-gold/15 px-3 py-1 text-xs font-semibold text-boss-gold">
            {selectedList.length} selected
          </span>
          <Button type="button" className="!text-xs" onClick={() => setShowRequestModal(true)}>
            Request pickup or delivery
          </Button>
          <button
            type="button"
            onClick={() => setSelectedPackages(new Map())}
            className="text-xs font-semibold text-muted hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      {(activeError || completedError) && (
        <div className="mt-4 space-y-2">
          {activeError && (
            <LoadErrorBanner message={activeError} onRetry={() => void refreshPackages()} />
          )}
          {completedError && (
            <LoadErrorBanner message={completedError} onRetry={() => void refreshPackages()} />
          )}
        </div>
      )}

      {activeLoading && completedLoading && !hasPackages ? (
        <p className="mt-4 text-sm text-muted">Loading packages...</p>
      ) : !activeLoading && !completedLoading && !hasPackages && !activeError && !completedError ? (
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
            {activeLoading && activePackages.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Loading active packages...</p>
            ) : activeTotal === 0 && !activeError ? (
              <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
                No active packages right now.
              </p>
            ) : activePackages.length > 0 ? (
              <div className="mt-4">
                <PackageCards
                  packages={activePackages}
                  page={activePage}
                  pageSize={ACTIVE_PAGE_SIZE}
                  totalItems={activeTotal}
                  loading={activeLoading || activePendingPage != null}
                  onPageChange={setActivePendingPage}
                  showSelection
                  {...cardProps}
                />
              </div>
            ) : null}
          </section>

          {(completedLoading || completedTotal > 0 || completedError) && (
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Completed</h3>
              <p className="mt-1 text-xs text-muted">Delivered packages.</p>
              {completedLoading && completedPackages.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Loading completed packages...</p>
              ) : completedPackages.length > 0 ? (
                <div className="mt-4">
                  <PackageCards
                    packages={completedPackages}
                    page={completedPage}
                    pageSize={COMPLETED_PAGE_SIZE}
                    totalItems={completedTotal}
                    loading={completedLoading || completedPendingPage != null}
                    onPageChange={setCompletedPendingPage}
                    showSelection={false}
                    {...cardProps}
                  />
                </div>
              ) : completedError ? null : (
                <p className="mt-4 text-sm text-muted">No completed packages yet.</p>
              )}
            </section>
          )}
        </div>
      )}

      {showRequestModal && selectedList.length > 0 && (
        <RequestDeliveryModal
          packages={selectedList}
          onClose={() => setShowRequestModal(false)}
          onSubmitted={async () => {
            setSelectedPackages(new Map())
            await refreshPackages()
          }}
        />
      )}
    </div>
  )
}
