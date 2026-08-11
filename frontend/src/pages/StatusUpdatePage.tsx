import { CalendarDays, ChevronDown, ChevronUp, Package as PackageIcon, Plane, RefreshCw, ScanLine, Search, Shield, ShoppingBag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { Package } from '../types'

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function defaultFromDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return formatDateInput(d)
}

interface QueuePreset {
  id: QueuePresetId
  label: string
  description: string
  from?: (today: string) => string
  to?: (today: string) => string
  status?: string
}

const QUEUE_PRESETS: QueuePreset[] = [
  {
    id: 'today',
    label: 'Received today',
    description: 'Packages received today',
    from: (today) => today,
    to: (today) => today,
  },
  {
    id: 'received',
    label: 'Received',
    description: 'Received — mark in transit when shipped',
    status: 'received',
  },
  {
    id: 'in-transit',
    label: 'In Transit',
    description: 'In transit — mark in customs on arrival',
    status: 'in_transit',
  },
  {
    id: 'customs',
    label: 'Customs',
    description: 'Request invoices or release & bill',
    status: 'customs',
  },
  {
    id: 'ready',
    label: 'Ready for Pickup',
    description: 'Ready for pickup — payment required before marking delivered',
    status: 'ready_for_pickup',
  },
]

const PRESET_ICONS: Record<QueuePresetId, LucideIcon> = {
  today: CalendarDays,
  received: PackageIcon,
  'in-transit': Plane,
  customs: Shield,
  ready: ShoppingBag,
  custom: Search,
}

function QueuePresetCard({
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
      onClick={onClick}
      className={`group flex min-h-[7.5rem] flex-col rounded-2xl border p-4 text-left transition-all ${
        active
          ? 'border-boss-gold bg-boss-gold/10 shadow-sm ring-2 ring-boss-gold/25'
          : 'border-border bg-card hover:border-boss-gold/40 hover:bg-background/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex rounded-xl p-2 ${
            active ? 'bg-boss-gold/20 text-boss-gold' : 'bg-background/80 text-muted group-hover:text-boss-gold'
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        {count != null && (
          <span className="text-2xl font-black tabular-nums leading-none text-boss-green">{count}</span>
        )}
      </div>
      <p
        className={`mt-3 text-xs font-bold uppercase tracking-wide ${
          active ? 'text-boss-gold' : 'text-foreground'
        }`}
      >
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">{description}</p>
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [actionSuccess, setActionSuccess] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)

  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [scanTracking, setScanTracking] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanPackage, setScanPackage] = useState<Package | null>(null)
  const [scanSuccess, setScanSuccess] = useState('')
  const [staffPackage, setStaffPackage] = useState<Package | null>(null)

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

  const allSelected = packages.length > 0 && selectedIds.size === packages.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < packages.length

  const selection = useMemo(
    () => analyzeSelection(packages, selectedIds),
    [packages, selectedIds],
  )

  function presetCount(preset: QueuePreset): number | null {
    if (!counts) return null
    if (preset.id === 'today') return counts.packages_today
    if (preset.status && counts.status_counts) return counts.status_counts[preset.status] ?? 0
    return null
  }

  const selectedCustomsPackages = useMemo(
    () => packages.filter((pkg) => selectedIds.has(pkg.id) && pkg.status === 'customs'),
    [packages, selectedIds],
  )

  const loadPackages = useCallback(
    async (from: string, to: string, status: string) => {
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
          limit: 50,
        })
        setPackages(pkgs)
        setTotal(count)
        setSelectedIds(new Set())
        setReviewOpen(false)
      } catch (err) {
        setError(getErrorMessage(err))
        setPackages([])
        setTotal(0)
        setSelectedIds(new Set())
      } finally {
        setLoadLoading(false)
      }
    },
    [],
  )

  const handleLoad = useCallback(async () => {
    await loadPackages(fromDate, toDate, filterStatus)
  }, [fromDate, toDate, filterStatus, loadPackages])

  function selectPreset(preset: QueuePresetId) {
    if (preset === 'custom') {
      setSearchParams({})
      setPackages([])
      setTotal(0)
      setSelectedIds(new Set())
      return
    }
    setSearchParams({ preset })
  }

  useEffect(() => {
    if (activePreset === 'custom') return
    const config = QUEUE_PRESETS.find((p) => p.id === activePreset)
    if (!config) return

    // Status queues list every package in that stage; received-date filters would
    // hide older packages while badge counts still include them.
    const nextFrom = config.status ? '' : config.from ? config.from(today) : defaultFromDate()
    const nextTo = config.status ? '' : config.to ? config.to(today) : today
    const nextStatus = config.status ?? ''

    setFromDate(nextFrom)
    setToDate(nextTo)
    setFilterStatus(nextStatus)
    setShowFilters(false)
    void loadPackages(nextFrom, nextTo, nextStatus)
  }, [activePreset, today, loadPackages])

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(packages.map((p) => p.id)) : new Set())
    setReviewOpen(false)
  }

  function togglePackage(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

  async function executeBulkAdvance(targetStatus: string, packageIds?: string[]) {
    let ids = packageIds ?? Array.from(selectedIds)
    if (targetStatus === 'delivered') {
      const selected = packages.filter((pkg) => ids.includes(pkg.id))
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
        setDepartResult({
          updated: result.updated,
          reference: result.shipment.reference,
        })
        setReviewOpen(false)
        setBatchReference('')
        setBatchDepartureDate(today)
        await handleLoad()
        refreshCounts()
        return
      }

      const result = await bulkUpdatePackageStatus({
        packageIds: ids,
        status: targetStatus,
      })
      setBulkResult(result)
      setReviewOpen(false)
      await handleLoad()
      refreshCounts()
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
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={RefreshCw} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Update Status</h1>
          <p className="text-sm text-muted">Received → In Transit → Customs → Ready for Pickup → Delivered</p>
        </div>
      </div>

      <form
        onSubmit={handleScanLookup}
        className="mb-4 rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <ScanLine className="h-4 w-4" />
          Scan or enter tracking
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <Input
            label="Tracking number"
            placeholder="PB-2026-000001"
            value={scanTracking}
            onChange={(e) => setScanTracking(e.target.value.toUpperCase())}
            className="flex-1"
          />
          <Button type="submit" disabled={scanLoading || !scanTracking.trim()} className="sm:self-end">
            {scanLoading ? 'Looking up…' : 'Look up'}
          </Button>
        </div>
        {scanPackage && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-4">
            <div>
              <p className="font-mono font-bold text-boss-gold">{scanPackage.tracking_number}</p>
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
        {scanSuccess && <p className="mt-3 text-sm text-boss-gold">{scanSuccess}</p>}
      </form>

      <div className="mb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Work queues</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUEUE_PRESETS.map((preset) => (
            <QueuePresetCard
              key={preset.id}
              label={preset.label}
              description={preset.description}
              icon={PRESET_ICONS[preset.id]}
              count={presetCount(preset)}
              active={activePreset === preset.id}
              onClick={() => selectPreset(preset.id)}
            />
          ))}
          <QueuePresetCard
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {total} package{total === 1 ? '' : 's'}
              {total > packages.length && ` (showing ${packages.length})`}
              {packages.length > 0 && (
                <>
                  {' · '}
                  {selectedIds.size} selected
                </>
              )}
            </p>
            {packages.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-boss-gold"
                />
                Select all in queue
              </label>
            )}
          </div>

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
        </div>
      )}

      {activePreset === 'custom' && packages.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {total} package{total === 1 ? '' : 's'}
              {total > packages.length && ` (showing ${packages.length})`}
              {' · '}
              {selectedIds.size} selected
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected
                }}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-boss-gold"
              />
              Select all in queue
            </label>
          </div>

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
                            ? packages
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
