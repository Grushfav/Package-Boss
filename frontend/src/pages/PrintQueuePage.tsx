import { Eye, Printer, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { fetchPrintQueue, markLabelsPrinted } from '../api/staff'
import {
  markPrintedAfterPrint,
  ShippingLabel,
} from '../components/warehouse/ShippingLabel'
import { useWarehouseCounts } from '../context/WarehouseCountsContext'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { useVisibleInterval } from '../hooks/useVisibleInterval'
import type { Package, StaffCustomer } from '../types'

function labelCustomer(pkg: Package): StaffCustomer | null {
  if (!pkg.customer) return null
  return {
    id: pkg.customer.id,
    full_name: pkg.customer.full_name,
    shipping_id: pkg.customer.shipping_id,
    parish: pkg.customer.parish ?? '',
    email: '',
    contact_number: '',
  }
}

type QueueView = 'pending' | 'all'

export function PrintQueuePage() {
  const { refresh: refreshCounts } = useWarehouseCounts()
  const [view, setView] = useState<QueueView>('pending')
  const [packages, setPackages] = useState<Package[]>([])
  const [total, setTotal] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [printQueue, setPrintQueue] = useState<Package[]>([])
  const [previewPackage, setPreviewPackage] = useState<Package | null>(null)
  const printStartedRef = useRef(false)

  const loadQueue = useCallback(async (options: { silent?: boolean } = {}) => {
    const { silent = false } = options
    if (!silent) {
      setLoading(true)
    }
    setError('')
    try {
      const { packages: pkgs, total: count } = await fetchPrintQueue({
        days: 7,
        limit: 100,
        pending_only: view === 'pending',
      })
      setPackages(pkgs)
      setTotal(count)
      setSelectedIds(new Set(view === 'pending' ? pkgs.map((p) => p.id) : []))
    } catch (err) {
      setError(getErrorMessage(err))
      setPackages([])
      setTotal(0)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [view])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  useVisibleInterval(() => {
    void loadQueue({ silent: true })
  }, 60_000)

  const allSelected = packages.length > 0 && selectedIds.size === packages.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < packages.length

  useEffect(() => {
    if (printQueue.length === 0 || printStartedRef.current) return

    printStartedRef.current = true
    const ids = printQueue.map((pkg) => pkg.id)

    const timer = window.setTimeout(() => {
      markPrintedAfterPrint(() => {
        printStartedRef.current = false
        setPrintQueue([])
        void handleMarkPrinted(ids)
      })
    }, 200)

    return () => {
      window.clearTimeout(timer)
      printStartedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- print once when queue is set
  }, [printQueue])

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(packages.map((p) => p.id)) : new Set())
  }

  function togglePackage(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleMarkPrinted(ids: string[]) {
    if (ids.length === 0) return
    setActionLoading(true)
    setError('')
    try {
      const result = await markLabelsPrinted(ids)
      if (result.failed.length > 0) {
        setError(`${result.marked} marked printed; ${result.failed.length} failed.`)
      }
      await loadQueue()
      refreshCounts()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  function queuePrint(pkgs: Package[]) {
    if (pkgs.length === 0) return
    printStartedRef.current = false
    setPrintQueue(pkgs)
  }

  function handlePrintSelected() {
    queuePrint(packages.filter((pkg) => selectedIds.has(pkg.id)))
  }

  function handlePrintOne(pkg: Package) {
    queuePrint([pkg])
  }

  function handlePrintNext10() {
    const pkgs = packages.slice(0, 10)
    if (pkgs.length === 0) return
    setSelectedIds(new Set(pkgs.map((p) => p.id)))
    queuePrint(pkgs)
  }

  return (
    <div className="px-4 py-8 print:p-0">
      <div className="no-print mb-6 flex items-center gap-2.5">
        <IconBadge icon={Printer} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Print Queue</h1>
          <p className="text-sm text-muted">
            {view === 'pending'
              ? 'Labels waiting to be printed (last 7 days)'
              : 'All labels received in the last 7 days — reprint anytime'}
          </p>
        </div>
      </div>

      <div className="no-print mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setView('pending')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === 'pending'
              ? 'border-boss-gold bg-boss-gold/15 text-boss-gold'
              : 'border-border text-muted hover:border-boss-gold/40'
          }`}
        >
          Pending print
        </button>
        <button
          type="button"
          onClick={() => setView('all')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === 'all'
              ? 'border-boss-gold bg-boss-gold/15 text-boss-gold'
              : 'border-border text-muted hover:border-boss-gold/40'
          }`}
        >
          Label log
        </button>
      </div>

      {loading ? (
        <p className="no-print text-muted">Loading queue...</p>
      ) : packages.length === 0 ? (
        <div className="no-print rounded-2xl border border-border bg-card p-8 text-center">
          <Printer className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-4 font-semibold">
            {view === 'pending' ? 'No labels in queue' : 'No labels in the last 7 days'}
          </p>
          <p className="mt-2 text-sm text-muted">
            {view === 'pending'
              ? 'Packages received without printing appear here.'
              : 'Received packages will appear here once clerks confirm receival.'}
          </p>
          <Link to="/warehouse/receive" className="mt-4 inline-block text-sm text-boss-gold hover:underline">
            Receive packages →
          </Link>
        </div>
      ) : (
        <>
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {total} label{total === 1 ? '' : 's'}
              {view === 'pending' ? ' pending' : ' in log'}
              {view === 'pending' ? ` · ${selectedIds.size} selected` : ''}
            </p>
            {view === 'pending' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={actionLoading || packages.length === 0}
                  onClick={handlePrintNext10}
                  className="inline-flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print next {Math.min(10, packages.length)}
                </Button>
                <Button
                  type="button"
                  disabled={actionLoading || selectedIds.size === 0}
                  onClick={handlePrintSelected}
                  className="inline-flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print selected ({selectedIds.size})
                </Button>
              </div>
            )}
          </div>

          <div className="no-print rounded-2xl border border-border bg-card overflow-hidden">
            {view === 'pending' && (
              <div className="border-b border-border px-4 py-3">
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
                  Select all
                </label>
              </div>
            )}
            <ul className="divide-y divide-border">
              {packages.map((pkg) => (
                <li key={pkg.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  {view === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(pkg.id)}
                      onChange={() => togglePackage(pkg.id)}
                      className="h-4 w-4 rounded border-border accent-boss-gold"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-semibold">{pkg.tracking_number}</p>
                    <p className="text-sm text-muted">
                      {pkg.customer
                        ? `${pkg.customer.full_name} · ${pkg.customer.shipping_id}`
                        : pkg.label_name || pkg.label_boss_id || 'Unidentified'}
                      {' · '}
                      {pkg.billable_weight_lbs} lbs
                      {' · '}
                      {new Date(pkg.received_at || pkg.created_at).toLocaleString()}
                      {pkg.label_printed_at && (
                        <>
                          {' · '}
                          <span className="text-boss-gold">Printed</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => setPreviewPackage(pkg)}
                      className="!text-xs inline-flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => handlePrintOne(pkg)}
                      className="!text-xs inline-flex items-center gap-1"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {pkg.label_printed_at ? 'Reprint' : 'Print'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {printQueue.length > 0 && (
        <div className="print-labels-root pointer-events-none fixed left-[-9999px] top-0 opacity-0 print:pointer-events-auto print:static print:opacity-100">
          {printQueue.map((pkg) => (
            <ShippingLabel key={pkg.id} pkg={pkg} customer={labelCustomer(pkg)} />
          ))}
        </div>
      )}

      {error && (
        <p className="no-print mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {previewPackage && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreviewPackage(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide">Label preview</p>
                <p className="font-mono text-xs text-muted">{previewPackage.tracking_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPackage(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="shipping-label-screen-scale">
              <ShippingLabel pkg={previewPackage} customer={labelCustomer(previewPackage)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-2"
                disabled={actionLoading}
                onClick={() => {
                  handlePrintOne(previewPackage)
                  setPreviewPackage(null)
                }}
              >
                <Printer className="h-4 w-4" />
                {previewPackage.label_printed_at ? 'Reprint' : 'Print'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPreviewPackage(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
