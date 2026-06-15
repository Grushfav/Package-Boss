import { Printer } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
    trn: '',
  }
}

export function PrintQueuePage() {
  const { refresh: refreshCounts } = useWarehouseCounts()
  const [packages, setPackages] = useState<Package[]>([])
  const [total, setTotal] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [printIds, setPrintIds] = useState<string[]>([])

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { packages: pkgs, total: count } = await fetchPrintQueue({ days: 7, limit: 200 })
      setPackages(pkgs)
      setTotal(count)
      setSelectedIds(new Set(pkgs.map((p) => p.id)))
    } catch (err) {
      setError(getErrorMessage(err))
      setPackages([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQueue()
    const interval = window.setInterval(loadQueue, 30_000)
    return () => window.clearInterval(interval)
  }, [loadQueue])

  const allSelected = packages.length > 0 && selectedIds.size === packages.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < packages.length

  const labelsToPrint = printIds.length
    ? packages.filter((p) => printIds.includes(p.id))
    : []

  useEffect(() => {
    if (printIds.length === 0 || labelsToPrint.length === 0) return

    const timer = window.setTimeout(() => {
      markPrintedAfterPrint(() => {
        handleMarkPrinted(printIds)
      })
    }, 150)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- print after labels mount
  }, [printIds, labelsToPrint.length])

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
      setPrintIds([])
      await loadQueue()
      refreshCounts()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  function handlePrintSelected() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setPrintIds(ids)
  }

  function handlePrintOne(pkg: Package) {
    setPrintIds([pkg.id])
  }

  function handlePrintNext10() {
    const ids = packages.slice(0, 10).map((p) => p.id)
    if (ids.length === 0) return
    setSelectedIds(new Set(ids))
    setPrintIds(ids)
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={Printer} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Print Queue</h1>
          <p className="text-sm text-muted">Labels waiting to be printed (last 7 days, auto-refreshes)</p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading queue...</p>
      ) : packages.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Printer className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-4 font-semibold">No labels in queue</p>
          <p className="mt-2 text-sm text-muted">
            Packages received without printing appear here.
          </p>
          <Link to="/warehouse/receive" className="mt-4 inline-block text-sm text-boss-green hover:underline">
            Receive packages →
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {total} label{total === 1 ? '' : 's'} pending · {selectedIds.size} selected
            </p>
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
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
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
                Select all
              </label>
            </div>
            <ul className="divide-y divide-border">
              {packages.map((pkg) => (
                <li key={pkg.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(pkg.id)}
                    onChange={() => togglePackage(pkg.id)}
                    className="h-4 w-4 rounded border-border accent-boss-green"
                  />
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
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => handlePrintOne(pkg)}
                    className="!text-xs inline-flex items-center gap-1"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {labelsToPrint.length > 0 && (
        <div aria-hidden className="pointer-events-none fixed left-[-9999px] top-0 opacity-0 print:pointer-events-auto print:static print:opacity-100">
          {labelsToPrint.map((pkg) => (
            <ShippingLabel key={pkg.id} pkg={pkg} customer={labelCustomer(pkg)} />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
