import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Megaphone, Package as PackageIcon, Plane, RefreshCw, ScanLine, Search, Shield, ShoppingBag, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import {
  batchDepartPackages,
  bulkRequestPackageInvoices,
  bulkUpdatePackageStatus,
  fetchPackageByTracking,
  fetchShipments,
  fetchWarehousePackages,
  updatePackageStatus,
  type BulkStatusResult,
  type ShipmentSummary,
} from '../api/staff'
import { TargetedAnnouncementModal } from '../components/announcements/TargetedAnnouncementModal'
import { PackageStaffModal } from '../components/warehouse/PackageStaffModal'
import {
  ReleaseFromCustomsModal,
  formatReleaseSummary,
} from '../components/warehouse/ReleaseFromCustomsModal'
import { StatusBadge } from '../components/warehouse/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useWarehouseCounts } from '../context/WarehouseCountsContext'
import {
  clerkCanManagePackageActions,
  clerkHasPermission,
} from '../lib/clerkPermissions'
import { formatJmd } from '../lib/money'
import { packagePaymentConfirmed } from '../lib/packageBilling'
import { WORKFLOW_STATUSES } from '../lib/packageStatuses'
import {
  INVOICE_BADGE_CLASS,
  NEXT_STATUS,
  analyzeSelection,
  daysInCurrentStatus,
  type QueuePresetId,
} from '../lib/packageWorkflow'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { formatAppDateInput } from '../lib/datetime'
import type { Package } from '../types'

function formatDateInput(date: Date): string {
  return formatAppDateInput(date)
}

function defaultFromDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return formatDateInput(d)
}

interface QueuePreset {
  id: QueuePresetId
  label: string
  shortLabel: string
  description: string
  from?: (today: string) => string
  to?: (today: string) => string
  status?: string
}

const QUEUE_PRESETS: QueuePreset[] = [
  {
    id: 'today',
    label: 'Received today',
    shortLabel: 'Today',
    description: 'Packages received today',
    from: (today) => today,
    to: (today) => today,
  },
  {
    id: 'received',
    label: 'Received',
    shortLabel: 'Received',
    description: 'Received — mark in transit when shipped',
    status: 'received',
  },
  {
    id: 'in-transit',
    label: 'In Transit',
    shortLabel: 'Transit',
    description: 'In transit — mark in customs on arrival',
    status: 'in_transit',
  },
  {
    id: 'customs',
    label: 'Customs',
    shortLabel: 'Customs',
    description: 'Request invoices or release & bill',
    status: 'customs',
  },
  {
    id: 'ready',
    label: 'Ready for Pickup',
    shortLabel: 'Ready',
    description: 'Ready for pickup — payment required before marking delivered',
    status: 'ready_for_pickup',
  },
]

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const
type QueuePageSize = (typeof PAGE_SIZE_OPTIONS)[number]

function queueQueryForPreset(
  presetId: QueuePresetId,
  today: string,
): { from: string; to: string; status: string } | null {
  if (presetId === 'custom') return null
  const config = QUEUE_PRESETS.find((p) => p.id === presetId)
  if (!config) return null
  // Status queues list every package in that stage; received-date filters would
  // hide older packages while badge counts still include them.
  return {
    from: config.status ? '' : config.from ? config.from(today) : defaultFromDate(),
    to: config.status ? '' : config.to ? config.to(today) : today,
    status: config.status ?? '',
  }
}

const PRESET_ICONS: Record<QueuePresetId, LucideIcon> = {
  today: CalendarDays,
  received: PackageIcon,
  'in-transit': Plane,
  customs: Shield,
  ready: ShoppingBag,
  custom: Search,
}

function QueuePresetChip({
  label,
  description,
  icon: Icon,
  count,
  active,
  onClick,
}: {
  label: string
  description: string
  icon: LucideIcon
  count?: number | null
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={description}
      onClick={onClick}
      className={`inline-flex h-11 shrink-0 snap-start items-center gap-2 rounded-xl border px-3 transition-colors ${
        active
          ? 'border-boss-gold bg-boss-gold/15 text-boss-gold shadow-sm'
          : 'border-border bg-card text-foreground hover:border-boss-gold/40 hover:bg-background/40'
      }`}
    >
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-boss-gold' : 'text-muted'}`}
        strokeWidth={2.25}
        aria-hidden
      />
      <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap">{label}</span>
      {count != null && (
        <span
          className={`min-w-[1.25rem] text-right text-sm font-black tabular-nums leading-none ${
            active ? 'text-boss-green' : 'text-boss-green/90'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

export function StatusUpdatePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { counts, refresh: refreshCounts } = useWarehouseCounts()
  const today = formatDateInput(new Date())
  const perms = user?.permissions || user?.clerk_permissions
  const role = user?.role
  const canManagePackages = clerkCanManagePackageActions(perms, role)
  const canRequestInvoice = clerkHasPermission(perms, 'invoice_request', role)
  const canManageBilling = clerkHasPermission(perms, 'billing', role)
  const canNotifyCustomers = clerkHasPermission(perms, 'status_customs', role)

  const presetParam = (searchParams.get('preset') || '') as QueuePresetId
  const activePreset: QueuePresetId = QUEUE_PRESETS.some((p) => p.id === presetParam)
    ? presetParam
    : 'custom'
  const activeQueue = QUEUE_PRESETS.find((p) => p.id === activePreset)

  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(today)
  const [filterStatus, setFilterStatus] = useState('')
  const [packages, setPackages] = useState<Package[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState<QueuePageSize>(50)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** When set, bulk actions use this full-queue set instead of only the current page. */
  const [selectionPool, setSelectionPool] = useState<Package[]>([])
  const [selectAllLoading, setSelectAllLoading] = useState(false)
  const [queueLoaded, setQueueLoaded] = useState(false)

  const [loadLoading, setLoadLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkStatusResult | null>(null)
  const [departResult, setDepartResult] = useState<{ updated: number; reference: string } | null>(
    null,
  )
  const [openShipments, setOpenShipments] = useState<ShipmentSummary[]>([])
  const [openShipmentsLoading, setOpenShipmentsLoading] = useState(false)
  const [batchMode, setBatchMode] = useState<'new' | 'existing'>('new')
  const [batchShipmentId, setBatchShipmentId] = useState('')
  const [batchReference, setBatchReference] = useState('')
  const [batchDepartureDate, setBatchDepartureDate] = useState(today)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [actionSuccess, setActionSuccess] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [scanTracking, setScanTracking] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanPackage, setScanPackage] = useState<Package | null>(null)
  const [scanSuccess, setScanSuccess] = useState('')
  const [staffPackage, setStaffPackage] = useState<Package | null>(null)
  const loadSeqRef = useRef(0)

  const scanParam = searchParams.get('scan')

  useEffect(() => {
    if (!scanParam) return
    const tracking = scanParam.trim().toUpperCase()
    if (!tracking) return

    setScanTracking(tracking)
    setScanLoading(true)
    setScanSuccess('')
    setError('')
    setScanPackage(null)

    fetchPackageByTracking(tracking)
      .then(setScanPackage)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setScanLoading(false))

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('scan')
        return next
      },
      { replace: true },
    )
  }, [scanParam, setSearchParams])

  const pageAllSelected =
    packages.length > 0 && packages.every((pkg) => selectedIds.has(pkg.id))
  const pageSomeSelected =
    packages.some((pkg) => selectedIds.has(pkg.id)) && !pageAllSelected
  const entireQueueSelected =
    total > 0 && selectionPool.length > 0 && selectedIds.size === total

  const selectionSource = selectionPool.length > 0 ? selectionPool : packages
  const selection = useMemo(
    () => analyzeSelection(selectionSource, selectedIds),
    [selectionSource, selectedIds],
  )

  function presetCount(preset: QueuePreset): number | null {
    if (!counts) return null
    if (preset.id === 'today') return counts.packages_today
    if (preset.status && counts.status_counts) return counts.status_counts[preset.status] ?? 0
    return null
  }

  const selectedCustomsPackages = useMemo(
    () => selectionSource.filter((pkg) => selectedIds.has(pkg.id) && pkg.status === 'customs'),
    [selectionSource, selectedIds],
  )

  const selectedNotifyPackages = useMemo(
    () => selectionSource.filter((pkg) => selectedIds.has(pkg.id)),
    [selectionSource, selectedIds],
  )

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, total)

  const loadPackages = useCallback(
    async (
      from: string,
      to: string,
      status: string,
      options?: { page?: number; pageSize?: QueuePageSize },
    ) => {
      const nextPageSize = options?.pageSize ?? pageSize
      const nextPage = options?.page ?? page
      const offset = (nextPage - 1) * nextPageSize
      const seq = ++loadSeqRef.current
      setError('')
      setBulkResult(null)
      setDepartResult(null)
      setActionSuccess('')
      setLoadLoading(true)
      try {
        const { packages: pkgs, total: count } = await fetchWarehousePackages({
          from,
          to,
          status: status || undefined,
          limit: nextPageSize,
          offset,
        })
        // Ignore outdated responses when the user switches queues quickly.
        if (seq !== loadSeqRef.current) return
        setPackages(pkgs)
        setTotal(count)
        setSelectedIds(new Set())
        setSelectionPool([])
        setReviewOpen(false)
        setQueueLoaded(true)
        const maxPage = Math.max(1, Math.ceil(count / nextPageSize))
        if (nextPage > maxPage) {
          setPage(maxPage)
        }
      } catch (err) {
        if (seq !== loadSeqRef.current) return
        setError(getErrorMessage(err))
        setPackages([])
        setTotal(0)
        setSelectedIds(new Set())
        setSelectionPool([])
        setQueueLoaded(false)
      } finally {
        if (seq === loadSeqRef.current) {
          setLoadLoading(false)
        }
      }
    },
    [page, pageSize],
  )

  const handleLoad = useCallback(async () => {
    setPage(1)
    await loadPackages(fromDate, toDate, filterStatus, { page: 1 })
  }, [fromDate, toDate, filterStatus, loadPackages])

  function selectPreset(preset: QueuePresetId) {
    if (preset === 'custom') {
      loadSeqRef.current += 1
      setSearchParams({})
      setPackages([])
      setTotal(0)
      setPage(1)
      setQueueLoaded(false)
      setLoadLoading(false)
      setSelectedIds(new Set())
      setSelectionPool([])
      return
    }
    // Clear the previous queue immediately so we never flash Today results under Received.
    loadSeqRef.current += 1
    setPackages([])
    setTotal(0)
    setSelectedIds(new Set())
    setSelectionPool([])
    setLoadLoading(true)
    setPage(1)
    setSearchParams({ preset })
  }

  // Work-queue presets: derive filters from the preset and load in one place
  // (avoids a race where Today params briefly load under the Received tab).
  useEffect(() => {
    if (activePreset === 'custom') return
    const query = queueQueryForPreset(activePreset, today)
    if (!query) return

    setFromDate(query.from)
    setToDate(query.to)
    setFilterStatus(query.status)
    setShowFilters(false)
    setQueueLoaded(true)
    void loadPackages(query.from, query.to, query.status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreset, today, page, pageSize])

  // Custom search: only reload after the user has clicked Load (queueLoaded).
  useEffect(() => {
    if (activePreset !== 'custom' || !queueLoaded) return
    void loadPackages(fromDate, toDate, filterStatus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreset, fromDate, toDate, filterStatus, page, pageSize, queueLoaded])

  function changePageSize(nextSize: QueuePageSize) {
    setPageSize(nextSize)
    setPage(1)
  }

  function renderSelectionControls() {
    if (packages.length === 0) return null
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {total} package{total === 1 ? '' : 's'}
            {total > 0 && ` · showing ${rangeStart}–${rangeEnd}`}
            {selectedIds.size > 0 && (
              <>
                {' · '}
                {entireQueueSelected
                  ? `${selectedIds.size} selected (entire queue)`
                  : `${selectedIds.size} selected`}
              </>
            )}
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pageAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = pageSomeSelected
              }}
              onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-boss-gold"
            />
            Select all on this page
          </label>
        </div>
        {total > packages.length && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-boss-gold/25 bg-boss-gold/5 px-3 py-2 text-sm">
            {entireQueueSelected ? (
              <>
                <span className="text-foreground">
                  All <span className="font-semibold">{total}</span> packages in this queue are
                  selected.
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="font-semibold text-boss-gold hover:underline"
                >
                  Clear selection
                </button>
              </>
            ) : (
              <>
                <span className="text-muted">
                  {pageAllSelected
                    ? `All ${packages.length} on this page are selected.`
                    : `Only this page is selectable with the checkbox.`}
                </span>
                <button
                  type="button"
                  disabled={selectAllLoading}
                  onClick={() => void selectEntireQueue()}
                  className="font-semibold text-boss-gold hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {selectAllLoading
                    ? 'Selecting…'
                    : `Select all ${total} packages in this queue`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderQueuePager() {
    if (total === 0) return null
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Showing {rangeStart}–{rangeEnd} of {total}
          {totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            Per page
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value) as QueuePageSize)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          {totalPages > 1 && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={currentPage <= 1 || loadLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="!py-2 !text-xs"
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={currentPage >= totalPages || loadLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="!py-2 !text-xs"
              >
                Next
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setSelectionPool([])
    setReviewOpen(false)
  }

  function toggleSelectAllOnPage(checked: boolean) {
    if (!checked) {
      clearSelection()
      return
    }
    setSelectionPool([])
    setSelectedIds(new Set(packages.map((p) => p.id)))
    setReviewOpen(false)
  }

  async function selectEntireQueue() {
    if (total === 0 || selectAllLoading) return
    setSelectAllLoading(true)
    setError('')
    try {
      const pageLimit = 200
      const all: Package[] = []
      let offset = 0
      while (offset < total) {
        const { packages: batch, total: latestTotal } = await fetchWarehousePackages({
          from: fromDate || undefined,
          to: toDate || undefined,
          status: filterStatus || undefined,
          limit: pageLimit,
          offset,
        })
        all.push(...batch)
        offset += pageLimit
        if (batch.length === 0) break
        if (all.length >= latestTotal) break
      }
      setSelectionPool(all)
      setSelectedIds(new Set(all.map((pkg) => pkg.id)))
      setReviewOpen(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSelectAllLoading(false)
    }
  }

  function togglePackage(id: string) {
    const wasSelected = selectedIds.has(id)
    const nextIds = new Set(selectedIds)
    if (wasSelected) nextIds.delete(id)
    else nextIds.add(id)
    setSelectedIds(nextIds)

    // Keep full-queue mode in sync when the user tweaks a row after "Select all N".
    // Clearing the pool while leaving off-page IDs in selectedIds made the count look
    // correct but bulk actions (Delivered / customs / notify) only saw the current page.
    if (selectionPool.length > 0) {
      if (wasSelected) {
        setSelectionPool((prev) => prev.filter((pkg) => pkg.id !== id))
      } else {
        const onPage = packages.find((pkg) => pkg.id === id)
        if (onPage && !selectionPool.some((pkg) => pkg.id === id)) {
          setSelectionPool((prev) => [...prev, onPage])
        }
      }
    }

    setReviewOpen(false)
  }

  const primaryAdvance = selection.nextAdvance
  const isTransitAdvance = primaryAdvance?.value === 'in_transit'

  useEffect(() => {
    if (!reviewOpen || !isTransitAdvance) return

    setOpenShipmentsLoading(true)
    fetchShipments({ status: 'open', limit: 50 })
      .then(({ shipments }) => {
        setOpenShipments(shipments)
        if (shipments.length > 0) {
          setBatchMode('existing')
          setBatchShipmentId(shipments[0].id)
        } else {
          setBatchMode('new')
          setBatchShipmentId('')
        }
      })
      .catch(() => {
        setOpenShipments([])
        setBatchMode('new')
        setBatchShipmentId('')
      })
      .finally(() => setOpenShipmentsLoading(false))
  }, [reviewOpen, isTransitAdvance])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function executeBulkAdvance(targetStatus: string, packageIds?: string[]) {
    let ids = packageIds ?? Array.from(selectedIds)
    if (targetStatus === 'delivered') {
      const selected = selectionSource.filter((pkg) => ids.includes(pkg.id))
      const deliverable = selected.filter((pkg) => packagePaymentConfirmed(pkg))
      if (deliverable.length === 0) {
        setError('Record payment before marking packages delivered.')
        setReviewOpen(false)
        return
      }
      ids = deliverable.map((pkg) => pkg.id)
    }

    setBulkLoading(true)
    setError('')
    setBulkResult(null)
    setDepartResult(null)
    try {
      if (targetStatus === 'in_transit') {
        if (batchMode === 'existing') {
          if (!batchShipmentId) {
            setError('Select an open departure batch.')
            setBulkLoading(false)
            return
          }
        } else if (!batchReference.trim()) {
          setError('Enter a departure reference (flight, vessel, or batch name).')
          setBulkLoading(false)
          return
        }

        const result = await batchDepartPackages({
          packageIds: ids,
          shipmentId: batchMode === 'existing' ? batchShipmentId : undefined,
          reference: batchMode === 'new' ? batchReference.trim() : undefined,
          departureDate: batchMode === 'new' ? batchDepartureDate : undefined,
        })
        const departed = new Set(ids)
        setDepartResult({
          updated: result.updated,
          reference: result.shipment.reference,
        })
        setToast(
          `${result.updated} package${result.updated === 1 ? '' : 's'} removed from this queue · departed on ${result.shipment.reference}`,
        )
        setReviewOpen(false)
        setBatchReference('')
        setBatchDepartureDate(today)
        setSelectedIds(new Set())
        setSelectionPool((prev) => prev.filter((pkg) => !departed.has(pkg.id)))
        setPackages((prev) => prev.filter((pkg) => !departed.has(pkg.id)))
        setTotal((prev) => Math.max(0, prev - result.updated))
        // Don't block the spinner on queue reload — depart already succeeded.
        void handleLoad().finally(() => refreshCounts())
        return
      }

      const result = await bulkUpdatePackageStatus({
        packageIds: ids,
        status: targetStatus,
      })
      const removed = new Set(ids)
      const nextLabel =
        WORKFLOW_STATUSES.find((s) => s.value === targetStatus)?.label ?? targetStatus
      setBulkResult(result)
      setToast(
        `${result.updated} package${result.updated === 1 ? '' : 's'} removed from this queue · now ${nextLabel}`,
      )
      setReviewOpen(false)
      setSelectedIds(new Set())
      setSelectionPool((prev) => prev.filter((pkg) => !removed.has(pkg.id)))
      setPackages((prev) => prev.filter((pkg) => !removed.has(pkg.id)))
      setTotal((prev) => Math.max(0, prev - result.updated))
      void handleLoad().finally(() => refreshCounts())
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBulkLoading(false)
    }
  }

  async function handleBulkInvoiceRequest() {
    if (selectedCustomsPackages.length === 0) return
    setInvoiceLoading(true)
    setError('')
    setActionSuccess('')
    try {
      const result = await bulkRequestPackageInvoices({
        packageIds: selectedCustomsPackages.map((pkg) => pkg.id),
        channel: 'email',
      })
      setActionSuccess(
        result.sent > 0
          ? `Invoice requested for ${result.sent} package${result.sent === 1 ? '' : 's'}.`
          : 'No invoice requests were sent.',
      )
      await handleLoad()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setInvoiceLoading(false)
    }
  }

  async function handleScanLookup(e: React.FormEvent) {
    e.preventDefault()
    const tracking = scanTracking.trim().toUpperCase()
    if (!tracking) return

    setScanLoading(true)
    setScanSuccess('')
    setError('')
    setScanPackage(null)
    try {
      const pkg = await fetchPackageByTracking(tracking)
      setScanPackage(pkg)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setScanLoading(false)
    }
  }

  async function handleScanAdvance() {
    if (!scanPackage) return
    const next = NEXT_STATUS[scanPackage.status]
    if (!next) return

    if (next.value === 'delivered' && !packagePaymentConfirmed(scanPackage)) {
      setError(`${scanPackage.tracking_number} cannot be delivered until payment is confirmed.`)
      return
    }

    setScanLoading(true)
    setError('')
    try {
      const updated = await updatePackageStatus(scanPackage.tracking_number, next.value)
      setScanPackage(updated)
      setScanSuccess(`${updated.tracking_number} → ${updated.status_label}`)
      if (packages.some((p) => p.id === updated.id)) {
        setPackages((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
      }
      refreshCounts()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setScanLoading(false)
    }
  }

  return (
    <div className="px-4 py-8 pb-40">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-4 right-4 z-40 mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-boss-green/40 bg-card px-4 py-3 shadow-lg md:bottom-6 md:left-auto md:right-6"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-boss-green" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{toast}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="shrink-0 rounded-md p-1 text-muted hover:bg-background/60 hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={RefreshCw} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Update Status</h1>
          <p className="text-sm text-muted">Received → In Transit → Customs → Ready for Pickup → Delivered</p>
        </div>
      </div>

      <form
        onSubmit={handleScanLookup}
        className="mb-4 rounded-2xl border border-border bg-card px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <Input
              aria-label="Tracking number"
              placeholder="Scan or enter tracking"
              value={scanTracking}
              onChange={(e) => setScanTracking(e.target.value.toUpperCase())}
              className="!py-2"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          <Button
            type="submit"
            disabled={scanLoading || !scanTracking.trim()}
            className="shrink-0 px-3 py-2"
          >
            {scanLoading ? '…' : 'Look up'}
          </Button>
        </div>
        {scanPackage && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold text-boss-gold">{scanPackage.tracking_number}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={scanPackage.status} label={scanPackage.status_label} />
                {scanPackage.customer && (
                  <span className="text-xs text-muted">
                    {scanPackage.customer.full_name} · {scanPackage.customer.shipping_id}
                  </span>
                )}
                {scanPackage.shipment && (
                  <span className="text-xs text-muted">
                    Departure {scanPackage.shipment.reference} (
                    {scanPackage.shipment.departure_date})
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {NEXT_STATUS[scanPackage.status] &&
                (scanPackage.status !== 'ready_for_pickup' ||
                  packagePaymentConfirmed(scanPackage)) && (
                  <Button type="button" disabled={scanLoading} onClick={handleScanAdvance}>
                    {NEXT_STATUS[scanPackage.status]!.actionLabel}
                  </Button>
                )}
              {scanPackage.status === 'ready_for_pickup' &&
                !packagePaymentConfirmed(scanPackage) && (
                  <span className="self-center text-xs font-semibold text-amber-400">
                    Payment required before delivery
                  </span>
                )}
              {scanPackage.status === 'customs' && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canManageBilling}
                  title={
                    canManageBilling
                      ? undefined
                      : 'Requires billing permission'
                  }
                  onClick={() => {
                    setSelectedIds(new Set([scanPackage.id]))
                    setReleaseOpen(true)
                  }}
                >
                  Release &amp; bill
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={!canManagePackages}
                title={
                  canManagePackages
                    ? undefined
                    : 'Requires billing or invoice request permission'
                }
                onClick={() => setStaffPackage(scanPackage)}
              >
                Manage
              </Button>
            </div>
          </div>
        )}
        {scanSuccess && <p className="mt-2 text-sm text-boss-gold">{scanSuccess}</p>}
      </form>

      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Work queues</p>
        <div
          role="tablist"
          aria-label="Work queues"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 md:snap-none"
        >
          {QUEUE_PRESETS.map((preset) => (
            <QueuePresetChip
              key={preset.id}
              label={preset.shortLabel}
              description={preset.description}
              icon={PRESET_ICONS[preset.id]}
              count={presetCount(preset)}
              active={activePreset === preset.id}
              onClick={() => selectPreset(preset.id)}
            />
          ))}
          <QueuePresetChip
            label="Search"
            description="Filter by date range and any status"
            icon={PRESET_ICONS.custom}
            active={activePreset === 'custom'}
            onClick={() => selectPreset('custom')}
          />
        </div>
      </div>

      {activePreset === 'custom' && (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <span className="text-sm font-bold uppercase tracking-wide text-boss-gold">
              Filter packages
            </span>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Received from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <Input
              label="Received to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                Status filter
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-gold focus:outline-none focus:ring-1 focus:ring-boss-gold"
              >
                <option value="">All statuses</option>
                {WORKFLOW_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="button" fullWidth onClick={handleLoad} disabled={loadLoading}>
                {loadLoading ? 'Loading…' : 'Load packages'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {activePreset !== 'custom' && (
        <div className="rounded-2xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-boss-gold">
                {activeQueue?.label ?? 'Queue'}
              </p>
              {activeQueue && (
                <p className="mt-0.5 text-xs text-muted">{activeQueue.description}</p>
              )}
            </div>
            {showFilters ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-muted" />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-muted" />
            )}
          </button>
          {showFilters && (
            <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Received from"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setSearchParams({})
                  setFromDate(e.target.value)
                }}
              />
              <Input
                label="Received to"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setSearchParams({})
                  setToDate(e.target.value)
                }}
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                  Status filter
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setSearchParams({})
                    setFilterStatus(e.target.value)
                  }}
                  className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-gold focus:outline-none focus:ring-1 focus:ring-boss-gold"
                >
                  <option value="">All statuses</option>
                  {WORKFLOW_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="button" fullWidth onClick={handleLoad} disabled={loadLoading}>
                  {loadLoading ? 'Loading…' : 'Reload queue'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {actionSuccess && (
        <p className="mt-4 rounded-lg border border-boss-green/30 bg-boss-green/10 px-4 py-3 text-sm text-boss-green">
          {actionSuccess}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {activePreset !== 'custom' && loadLoading && (
        <p className="mt-6 text-center text-sm text-muted">Loading queue…</p>
      )}

      {activePreset !== 'custom' && !loadLoading && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          {renderSelectionControls()}

          {packages.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted">No packages in this queue.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <th className="pb-3 pr-3 w-10" />
                  <th className="pb-3 pr-3">Tracking</th>
                  <th className="pb-3 pr-3">Customer</th>
                  <th className="pb-3 pr-3">Departure</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 pr-3">Invoice</th>
                  <th className="pb-3 pr-3">Billing</th>
                  <th className="pb-3 pr-3">Age</th>
                  <th className="pb-3 pr-3">Weight</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => {
                  const days = daysInCurrentStatus(pkg)
                  return (
                    <tr key={pkg.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(pkg.id)}
                          onChange={() => togglePackage(pkg.id)}
                          className="h-4 w-4 rounded border-border accent-boss-gold"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-mono font-semibold">{pkg.tracking_number}</p>
                        {pkg.carrier_tracking && (
                          <p className="text-xs text-muted">{pkg.carrier_tracking}</p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {pkg.customer ? (
                          <>
                            <p className="font-medium">{pkg.customer.full_name}</p>
                            <p className="text-xs text-muted">{pkg.customer.shipping_id}</p>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        {pkg.shipment ? (
                          <span title={pkg.shipment.departure_date}>{pkg.shipment.reference}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={pkg.status} label={pkg.status_label} />
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`text-xs ${
                            INVOICE_BADGE_CLASS[pkg.invoice_status ?? 'pending'] ?? 'text-muted'
                          }`}
                        >
                          {pkg.invoice_status_label ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="text-xs">{pkg.billing_status_label ?? '—'}</span>
                        {pkg.total_due_jmd != null && pkg.billing_status !== 'pending' && (
                          <p className="text-xs font-semibold">{formatJmd(pkg.total_due_jmd)}</p>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-muted">
                        {days != null ? `${days}d` : '—'}
                      </td>
                      <td className="py-3 pr-3">{pkg.billable_weight_lbs ?? '—'} lbs</td>
                      <td className="py-3">
                        <button
                          type="button"
                          disabled={!canManagePackages}
                          title={
                            canManagePackages
                              ? undefined
                              : 'Requires billing or invoice request permission'
                          }
                          onClick={() => setStaffPackage(pkg)}
                          className="text-xs font-semibold text-boss-gold hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
          {renderQueuePager()}
        </div>
      )}

      {activePreset === 'custom' && packages.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          {renderSelectionControls()}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <th className="pb-3 pr-3 w-10" />
                  <th className="pb-3 pr-3">Tracking</th>
                  <th className="pb-3 pr-3">Customer</th>
                  <th className="pb-3 pr-3">Departure</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 pr-3">Invoice</th>
                  <th className="pb-3 pr-3">Billing</th>
                  <th className="pb-3 pr-3">Age</th>
                  <th className="pb-3 pr-3">Weight</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => {
                  const days = daysInCurrentStatus(pkg)
                  return (
                    <tr key={pkg.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(pkg.id)}
                          onChange={() => togglePackage(pkg.id)}
                          className="h-4 w-4 rounded border-border accent-boss-gold"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-mono font-semibold">{pkg.tracking_number}</p>
                        {pkg.carrier_tracking && (
                          <p className="text-xs text-muted">{pkg.carrier_tracking}</p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {pkg.customer ? (
                          <>
                            <p className="font-medium">{pkg.customer.full_name}</p>
                            <p className="text-xs text-muted">{pkg.customer.shipping_id}</p>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        {pkg.shipment ? (
                          <span title={pkg.shipment.departure_date}>{pkg.shipment.reference}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={pkg.status} label={pkg.status_label} />
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`text-xs ${
                            INVOICE_BADGE_CLASS[pkg.invoice_status ?? 'pending'] ?? 'text-muted'
                          }`}
                        >
                          {pkg.invoice_status_label ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="text-xs">{pkg.billing_status_label ?? '—'}</span>
                        {pkg.total_due_jmd != null && pkg.billing_status !== 'pending' && (
                          <p className="text-xs font-semibold">{formatJmd(pkg.total_due_jmd)}</p>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-muted">
                        {days != null ? `${days}d` : '—'}
                      </td>
                      <td className="py-3 pr-3">{pkg.billable_weight_lbs ?? '—'} lbs</td>
                      <td className="py-3">
                        <button
                          type="button"
                          disabled={!canManagePackages}
                          title={
                            canManagePackages
                              ? undefined
                              : 'Requires billing or invoice request permission'
                          }
                          onClick={() => setStaffPackage(pkg)}
                          className="text-xs font-semibold text-boss-gold hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {renderQueuePager()}
        </div>
      )}

      {activePreset === 'custom' && packages.length === 0 && !loadLoading && total === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          Choose a work queue or load packages for a date range.
        </p>
      )}

      {departResult && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="font-semibold text-boss-gold">
            {departResult.updated} package{departResult.updated === 1 ? '' : 's'} departed on{' '}
            <span className="font-bold">{departResult.reference}</span>
          </p>
        </div>
      )}

      {bulkResult && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="font-semibold text-boss-gold">
            {bulkResult.updated} package{bulkResult.updated === 1 ? '' : 's'} updated
          </p>
          {bulkResult.failed.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-red-400">
              {bulkResult.failed.map((f) => (
                <li key={f.id}>
                  {f.tracking_number ?? f.id}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {packages.length > 0 && selectedIds.size > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-20 border-t border-boss-gold/30 bg-card/95 px-4 py-4 backdrop-blur md:bottom-0 md:left-52 lg:left-56">
          <div className="mx-auto max-w-5xl space-y-3">
            {reviewOpen && (selection.mode === 'advance' || selection.mode === 'payment_required') && primaryAdvance && (
              <div className="rounded-xl border border-boss-gold/30 bg-boss-gold/5 p-4">
                <p className="text-sm font-semibold">
                  {selection.mode === 'payment_required' ? selection.paidCount : selection.count}{' '}
                  package
                  {(selection.mode === 'payment_required' ? selection.paidCount : selection.count) === 1
                    ? ''
                    : 's'}{' '}
                  · {selection.statusLabel} → {primaryAdvance.label}
                </p>
                {selection.mode === 'payment_required' && (
                  <p className="mt-1 text-xs text-muted">Only paid packages will be marked delivered.</p>
                )}
                {isTransitAdvance && (
                  <p className="mt-1 text-xs text-muted">
                    Group selected packages into a departure batch, then mark them in transit.
                  </p>
                )}
                <div className="mt-3 space-y-3">
                  {isTransitAdvance && (
                    <>
                      {openShipments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setBatchMode('new')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              batchMode === 'new'
                                ? 'bg-boss-gold/20 text-boss-gold'
                                : 'bg-background text-muted hover:text-foreground'
                            }`}
                          >
                            New departure
                          </button>
                          <button
                            type="button"
                            onClick={() => setBatchMode('existing')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              batchMode === 'existing'
                                ? 'bg-boss-gold/20 text-boss-gold'
                                : 'bg-background text-muted hover:text-foreground'
                            }`}
                          >
                            Add to open batch
                          </button>
                        </div>
                      )}
                      {openShipmentsLoading ? (
                        <p className="text-xs text-muted">Loading open departures…</p>
                      ) : batchMode === 'existing' && openShipments.length > 0 ? (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Open departure
                          </label>
                          <select
                            value={batchShipmentId}
                            onChange={(e) => setBatchShipmentId(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          >
                            {openShipments.map((shipment) => (
                              <option key={shipment.id} value={shipment.id}>
                                {shipment.reference} · {shipment.departure_date} ·{' '}
                                {shipment.package_count} pkg
                                {shipment.package_count === 1 ? '' : 's'}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            label="Departure reference"
                            placeholder="Flight, vessel, or batch name"
                            value={batchReference}
                            onChange={(e) => setBatchReference(e.target.value)}
                          />
                          <Input
                            label="Departure date"
                            type="date"
                            value={batchDepartureDate}
                            onChange={(e) => setBatchDepartureDate(e.target.value)}
                          />
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      disabled={bulkLoading}
                      onClick={() =>
                        executeBulkAdvance(
                          primaryAdvance.value,
                          selection.mode === 'payment_required'
                            ? selectionSource
                                .filter(
                                  (pkg) =>
                                    selectedIds.has(pkg.id) && packagePaymentConfirmed(pkg),
                                )
                                .map((pkg) => pkg.id)
                            : undefined,
                        )
                      }
                    >
                      {bulkLoading
                        ? 'Updating…'
                        : isTransitAdvance
                          ? 'Depart batch'
                          : 'Confirm'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {selection.mode === 'mixed' && (
                <p className="text-sm text-amber-400">
                  Select packages in the same stage to bulk advance.
                </p>
              )}

              {selection.mode === 'terminal' && selection.count > 0 && (
                <p className="text-sm text-muted">
                  {selection.statusLabel} packages have no bulk next step here.
                </p>
              )}

              {selection.mode === 'payment_required' && (
                <>
                  <p className="text-sm text-amber-400">
                    {selection.unpaidCount} of {selection.count} still unpaid — record payment
                    before delivery.
                  </p>
                  {selection.paidCount > 0 && primaryAdvance && (
                    <Button type="button" onClick={() => setReviewOpen(true)}>
                      {primaryAdvance.actionLabel} ({selection.paidCount} paid)
                    </Button>
                  )}
                </>
              )}

              {selection.mode === 'advance' && primaryAdvance && !reviewOpen && (
                <Button type="button" onClick={() => setReviewOpen(true)}>
                  {primaryAdvance.actionLabel} ({selection.count})
                </Button>
              )}

              {selection.mode === 'customs' && (
                <>
                  {canNotifyCustomers && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNotifyOpen(true)}
                    >
                      <Megaphone className="mr-1 h-4 w-4" />
                      Notify customers ({selection.count})
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={invoiceLoading || !canRequestInvoice}
                    title={
                      canRequestInvoice ? undefined : 'Requires invoice request permission'
                    }
                    onClick={handleBulkInvoiceRequest}
                  >
                    {invoiceLoading ? 'Sending…' : `Request invoice (${selection.count})`}
                  </Button>
                  <Button
                    type="button"
                    disabled={!canManageBilling}
                    title={canManageBilling ? undefined : 'Requires billing permission'}
                    onClick={() => setReleaseOpen(true)}
                  >
                    Release &amp; bill ({selection.count})
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {notifyOpen && (
        <TargetedAnnouncementModal
          packageIds={selectedNotifyPackages.map((pkg) => pkg.id)}
          packages={selectedNotifyPackages}
          onClose={() => setNotifyOpen(false)}
          onCompleted={(summary) => {
            setNotifyOpen(false)
            setActionSuccess(summary)
            setSelectedIds(new Set())
          }}
        />
      )}

      {releaseOpen && (
        <ReleaseFromCustomsModal
          packages={selectedCustomsPackages}
          onClose={() => setReleaseOpen(false)}
          onPackageUpdated={(updated) => {
            setPackages((prev) =>
              prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
            )
          }}
          onCompleted={(result) => {
            setReleaseOpen(false)
            setActionSuccess(formatReleaseSummary(result))
            handleLoad()
            refreshCounts()
          }}
        />
      )}

      {staffPackage && (
        <PackageStaffModal
          pkg={staffPackage}
          onClose={() => setStaffPackage(null)}
          onUpdated={(updated) => {
            setPackages((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
            setStaffPackage(updated)
            if (scanPackage?.id === updated.id) setScanPackage(updated)
          }}
          onUnassigned={() => {
            const removedId = staffPackage.id
            setStaffPackage(null)
            setPackages((prev) => prev.filter((p) => p.id !== removedId))
            if (scanPackage?.id === removedId) setScanPackage(null)
            refreshCounts()
          }}
        />
      )}
    </div>
  )
}
