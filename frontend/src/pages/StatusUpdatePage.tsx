import { ChevronDown, ChevronUp, RefreshCw, ScanLine } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import {
  bulkRequestPackageInvoices,
  bulkUpdatePackageStatus,
  fetchPackageByTracking,
  fetchWarehousePackages,
  updatePackageStatus,
  type BulkStatusResult,
} from '../api/staff'
import { PackageStaffModal } from '../components/warehouse/PackageStaffModal'
import {
  ReleaseFromCustomsModal,
  formatReleaseSummary,
} from '../components/warehouse/ReleaseFromCustomsModal'
import { StatusBadge } from '../components/warehouse/StatusBadge'
import { useWarehouseCounts } from '../context/WarehouseCountsContext'
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
    from: () => defaultFromDate(),
    to: (today) => today,
    status: 'received',
  },
  {
    id: 'in-transit',
    label: 'In Transit',
    description: 'In transit — mark in customs on arrival',
    from: () => defaultFromDate(),
    to: (today) => today,
    status: 'in_transit',
  },
  {
    id: 'customs',
    label: 'Customs',
    description: 'Request invoices or release & bill',
    from: () => defaultFromDate(),
    to: (today) => today,
    status: 'customs',
  },
  {
    id: 'ready',
    label: 'Ready for Pickup',
    description: 'Ready for pickup — payment required before marking delivered',
    from: () => defaultFromDate(),
    to: (today) => today,
    status: 'ready_for_pickup',
  },
]

export function StatusUpdatePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { counts, refresh: refreshCounts } = useWarehouseCounts()
  const today = formatDateInput(new Date())

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
  const [bulkNote, setBulkNote] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkStatusResult | null>(null)
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

  function presetLabel(preset: QueuePreset): string {
    const count = presetCount(preset)
    return count != null ? `${preset.label} (${count})` : preset.label
  }

  const selectedCustomsPackages = useMemo(
    () => packages.filter((pkg) => selectedIds.has(pkg.id) && pkg.status === 'customs'),
    [packages, selectedIds],
  )

  const applyPreset = useCallback(
    (preset: QueuePresetId) => {
      if (preset === 'custom') {
        setSearchParams({})
        return
      }
      const config = QUEUE_PRESETS.find((p) => p.id === preset)
      if (!config) return
      setFromDate(config.from ? config.from(today) : defaultFromDate())
      setToDate(config.to ? config.to(today) : today)
      setFilterStatus(config.status ?? '')
      setSearchParams({ preset })
    },
    [today, setSearchParams],
  )

  const handleLoad = useCallback(async () => {
    setError('')
    setBulkResult(null)
    setActionSuccess('')
    setLoadLoading(true)
    try {
      const { packages: pkgs, total: count } = await fetchWarehousePackages({
        from: fromDate,
        to: toDate,
        status: filterStatus || undefined,
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
  }, [fromDate, toDate, filterStatus])

  useEffect(() => {
    if (activePreset !== 'custom') {
      applyPreset(activePreset)
    }
  }, [activePreset, applyPreset])

  useEffect(() => {
    if (activePreset !== 'custom') {
      handleLoad()
    }
  }, [fromDate, toDate, filterStatus, activePreset, handleLoad])

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
    try {
      const result = await bulkUpdatePackageStatus({
        packageIds: ids,
        status: targetStatus,
        note: bulkNote || undefined,
      })
      setBulkResult(result)
      setReviewOpen(false)
      setBulkNote('')
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

  const primaryAdvance = selection.nextAdvance

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
              <p className="font-mono font-bold text-boss-green">{scanPackage.tracking_number}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={scanPackage.status} label={scanPackage.status_label} />
                {scanPackage.customer && (
                  <span className="text-xs text-muted">
                    {scanPackage.customer.full_name} · {scanPackage.customer.shipping_id}
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
                  onClick={() => {
                    setSelectedIds(new Set([scanPackage.id]))
                    setReleaseOpen(true)
                  }}
                >
                  Release &amp; bill
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setStaffPackage(scanPackage)}>
                Manage
              </Button>
            </div>
          </div>
        )}
        {scanSuccess && <p className="mt-3 text-sm text-boss-green">{scanSuccess}</p>}
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {QUEUE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activePreset === preset.id
                ? 'bg-boss-green text-black'
                : 'border border-border bg-card text-muted hover:border-boss-green/40'
            }`}
            title={preset.description}
          >
            {presetLabel(preset)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => applyPreset('custom')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            activePreset === 'custom'
              ? 'bg-boss-green text-black'
              : 'border border-border bg-card text-muted hover:border-boss-green/40'
          }`}
        >
          Custom
        </button>
      </div>

      {activeQueue && (
        <p className="mb-4 text-sm text-muted">{activeQueue.description}</p>
      )}

      <div className="rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <span className="text-sm font-bold uppercase tracking-wide text-boss-green">
            {activePreset === 'custom' ? 'Filter packages' : 'Adjust date range'}
          </span>
          {showFilters || activePreset === 'custom' ? (
            <ChevronUp className="h-5 w-5 text-muted" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted" />
          )}
        </button>
        {(showFilters || activePreset === 'custom') && (
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
                className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-green focus:outline-none focus:ring-1 focus:ring-boss-green"
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
        )}
      </div>

      {actionSuccess && (
        <p className="mt-4 rounded-lg border border-boss-green/30 bg-boss-green/10 px-4 py-3 text-sm text-boss-green">
          {actionSuccess}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {packages.length > 0 && (
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
                className="h-4 w-4 rounded border-border accent-boss-green"
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
                          className="h-4 w-4 rounded border-border accent-boss-green"
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
                          onClick={() => setStaffPackage(pkg)}
                          className="text-xs font-semibold text-boss-green hover:underline"
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

      {packages.length === 0 && !loadLoading && total === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          Choose a work queue or load packages for a date range.
        </p>
      )}

      {bulkResult && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="font-semibold text-boss-green">
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
        <div className="fixed bottom-16 left-0 right-0 z-20 border-t border-boss-green/30 bg-card/95 px-4 py-4 backdrop-blur md:bottom-0 md:left-52 lg:left-56">
          <div className="mx-auto max-w-5xl space-y-3">
            {reviewOpen && (selection.mode === 'advance' || selection.mode === 'payment_required') && primaryAdvance && (
              <div className="rounded-xl border border-boss-green/30 bg-boss-green/5 p-4">
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
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1">
                    <Input
                      label="Note (optional)"
                      placeholder="Flight departed, etc."
                      value={bulkNote}
                      onChange={(e) => setBulkNote(e.target.value)}
                    />
                  </div>
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
                    {bulkLoading ? 'Updating…' : 'Confirm'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>
                    Cancel
                  </Button>
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
                    disabled={invoiceLoading}
                    onClick={handleBulkInvoiceRequest}
                  >
                    {invoiceLoading ? 'Sending…' : `Request invoice (${selection.count})`}
                  </Button>
                  <Button type="button" onClick={() => setReleaseOpen(true)}>
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
        />
      )}
    </div>
  )
}
