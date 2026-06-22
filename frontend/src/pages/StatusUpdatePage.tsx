import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useSearchParams } from 'react-router-dom'

import { getErrorMessage } from '../api/client'

import {

  bulkUpdatePackageStatus,

  fetchWarehousePackages,

  updatePackageStatus,

  type BulkStatusResult,

} from '../api/staff'

import { PackageStaffModal } from '../components/warehouse/PackageStaffModal'

import { useWarehouseCounts } from '../context/WarehouseCountsContext'

import { PACKAGE_STATUSES } from '../lib/packageStatuses'

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



type QuickPreset = 'today' | 'ready-flight' | 'arrived-kingston' | 'custom'



const PRESETS: {

  id: QuickPreset

  label: string

  from?: (today: string) => string

  to?: (today: string) => string

  status?: string

  bulkStatus?: string

}[] = [

  {

    id: 'today',

    label: 'Received today',

    from: (today) => today,

    to: (today) => today,

  },

  {

    id: 'ready-flight',

    label: 'Ready for flight',

    from: () => defaultFromDate(),

    to: (today) => today,

    status: 'received_miami',

    bulkStatus: 'in_transit',

  },

  {

    id: 'arrived-kingston',

    label: 'Arrived Kingston',

    from: () => defaultFromDate(),

    to: (today) => today,

    status: 'arrived_kingston',

    bulkStatus: 'out_for_delivery',

  },

]



export function StatusUpdatePage() {

  const [searchParams, setSearchParams] = useSearchParams()

  const { refresh: refreshCounts } = useWarehouseCounts()

  const today = formatDateInput(new Date())



  const presetParam = (searchParams.get('preset') || '') as QuickPreset

  const activePreset: QuickPreset = PRESETS.some((p) => p.id === presetParam)

    ? presetParam

    : 'custom'



  const [fromDate, setFromDate] = useState(defaultFromDate)

  const [toDate, setToDate] = useState(today)

  const [filterStatus, setFilterStatus] = useState('')

  const [packages, setPackages] = useState<Package[]>([])

  const [total, setTotal] = useState(0)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())



  const [loadLoading, setLoadLoading] = useState(false)

  const [bulkStatus, setBulkStatus] = useState('in_transit')

  const [bulkNote, setBulkNote] = useState('')

  const [bulkLoading, setBulkLoading] = useState(false)

  const [bulkResult, setBulkResult] = useState<BulkStatusResult | null>(null)



  const [error, setError] = useState('')

  const [showSingle, setShowSingle] = useState(false)

  const [singleTracking, setSingleTracking] = useState('')

  const [singleStatus, setSingleStatus] = useState('processing')

  const [singleNote, setSingleNote] = useState('')

  const [singleLoading, setSingleLoading] = useState(false)

  const [singleSuccess, setSingleSuccess] = useState('')

  const [staffPackage, setStaffPackage] = useState<Package | null>(null)



  const allSelected = packages.length > 0 && selectedIds.size === packages.length

  const someSelected = selectedIds.size > 0 && selectedIds.size < packages.length



  const statusLabel = useMemo(

    () => PACKAGE_STATUSES.find((s) => s.value === bulkStatus)?.label ?? bulkStatus,

    [bulkStatus],

  )



  const applyPreset = useCallback((preset: QuickPreset) => {

    if (preset === 'custom') {

      setSearchParams({})

      return

    }



    const config = PRESETS.find((p) => p.id === preset)

    if (!config) return



    setFromDate(config.from ? config.from(today) : defaultFromDate())

    setToDate(config.to ? config.to(today) : today)

    setFilterStatus(config.status ?? '')

    if (config.bulkStatus) setBulkStatus(config.bulkStatus)

    setSearchParams({ preset })

  }, [today, setSearchParams])



  const handleLoad = useCallback(async () => {

    setError('')

    setBulkResult(null)

    setLoadLoading(true)

    try {

      const { packages: pkgs, total: count } = await fetchWarehousePackages({

        from: fromDate,

        to: toDate,

        status: filterStatus || undefined,

      })

      setPackages(pkgs)

      setTotal(count)

      setSelectedIds(new Set(pkgs.map((p) => p.id)))

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

    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when preset filters applied

  }, [fromDate, toDate, filterStatus, activePreset])



  function toggleSelectAll(checked: boolean) {

    if (checked) {

      setSelectedIds(new Set(packages.map((p) => p.id)))

    } else {

      setSelectedIds(new Set())

    }

  }



  function togglePackage(id: string) {

    setSelectedIds((prev) => {

      const next = new Set(prev)

      if (next.has(id)) next.delete(id)

      else next.add(id)

      return next

    })

  }



  async function handleBulkUpdate() {

    if (selectedIds.size === 0) return



    const confirmed = window.confirm(

      `Update ${selectedIds.size} package${selectedIds.size === 1 ? '' : 's'} to "${statusLabel}"?`,

    )

    if (!confirmed) return



    setError('')

    setBulkResult(null)

    setBulkLoading(true)

    try {

      const result = await bulkUpdatePackageStatus({

        packageIds: Array.from(selectedIds),

        status: bulkStatus,

        note: bulkNote || undefined,

      })

      setBulkResult(result)

      await handleLoad()

      refreshCounts()

    } catch (err) {

      setError(getErrorMessage(err))

    } finally {

      setBulkLoading(false)

    }

  }



  async function handleSingleUpdate(e: React.FormEvent) {

    e.preventDefault()

    const tracking = singleTracking.trim().toUpperCase()

    if (!tracking) return



    setError('')

    setSingleSuccess('')

    setSingleLoading(true)

    try {

      const updated = await updatePackageStatus(tracking, singleStatus, singleNote || undefined)

      setSingleSuccess(`Updated ${updated.tracking_number} to ${updated.status_label}.`)

      setSingleNote('')

      if (packages.length > 0) await handleLoad()

      refreshCounts()

    } catch (err) {

      setError(getErrorMessage(err))

    } finally {

      setSingleLoading(false)

    }

  }



  return (

    <div className="px-4 py-8 pb-32">

      <div className="mb-6 flex items-center gap-2.5">

        <IconBadge icon={RefreshCw} size="sm" />

        <div>

          <h1 className="text-2xl font-black uppercase">Update Status</h1>

          <p className="text-sm text-muted">Bulk update packages by received date</p>

        </div>

      </div>



      <div className="mb-4 flex flex-wrap gap-2">

        {PRESETS.map((preset) => (

          <button

            key={preset.id}

            type="button"

            onClick={() => applyPreset(preset.id)}

            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${

              activePreset === preset.id

                ? 'bg-boss-green text-black'

                : 'border border-border bg-card text-muted hover:border-boss-green/40'

            }`}

          >

            {preset.label}

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

          Custom range

        </button>

      </div>



      <div className="rounded-2xl border border-border bg-card p-6">

        <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">Filter packages</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

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

              Current status (optional)

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

              {PACKAGE_STATUSES.map((s) => (

                <option key={s.value} value={s.value}>

                  {s.label}

                </option>

              ))}

            </select>

          </div>

          <div className="flex items-end">

            <Button type="button" fullWidth onClick={handleLoad} disabled={loadLoading}>

              {loadLoading ? 'Loading...' : 'Load packages'}

            </Button>

          </div>

        </div>

      </div>



      {packages.length > 0 && (

        <div className="mt-6 rounded-2xl border border-border bg-card p-6">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <p className="text-sm text-muted">

              {total} package{total === 1 ? '' : 's'} in period

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

              Select all

            </label>

          </div>



          <div className="mt-4 overflow-x-auto">

            <table className="w-full min-w-[640px] text-left text-sm">

              <thead>

                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">

                  <th className="pb-3 pr-3 w-10" />

                  <th className="pb-3 pr-3">Tracking</th>

                  <th className="pb-3 pr-3">Customer</th>

                  <th className="pb-3 pr-3">Status</th>

                  <th className="pb-3 pr-3">Received</th>

                  <th className="pb-3 pr-3">Weight</th>

                  <th className="pb-3">Actions</th>

                </tr>

              </thead>

              <tbody>

                {packages.map((pkg) => (

                  <tr key={pkg.id} className="border-b border-border/60 last:border-0">

                    <td className="py-3 pr-3">

                      <input

                        type="checkbox"

                        checked={selectedIds.has(pkg.id)}

                        onChange={() => togglePackage(pkg.id)}

                        className="h-4 w-4 rounded border-border accent-boss-green"

                      />

                    </td>

                    <td className="py-3 pr-3 font-mono font-semibold">{pkg.tracking_number}</td>

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

                    <td className="py-3 pr-3">{pkg.status_label}</td>

                    <td className="py-3 pr-3 text-muted">

                      {pkg.received_at

                        ? new Date(pkg.received_at).toLocaleDateString()

                        : '—'}

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

                ))}

              </tbody>

            </table>

          </div>

        </div>

      )}



      {packages.length === 0 && !loadLoading && total === 0 && (

        <p className="mt-6 text-center text-sm text-muted">

          Use a quick filter or load packages for a date range to begin bulk updates.

        </p>

      )}



      {bulkResult && (

        <div className="mt-6 rounded-lg border border-border bg-card p-4">

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



      <div className="mt-8 rounded-2xl border border-border bg-card">

        <button

          type="button"

          onClick={() => setShowSingle((v) => !v)}

          className="flex w-full items-center justify-between p-6 text-left"

        >

          <span className="text-sm font-bold uppercase tracking-wide">Update single package</span>

          {showSingle ? (

            <ChevronUp className="h-5 w-5 text-muted" />

          ) : (

            <ChevronDown className="h-5 w-5 text-muted" />

          )}

        </button>

        {showSingle && (

          <form onSubmit={handleSingleUpdate} className="space-y-4 border-t border-border px-6 pb-6 pt-4">

            <Input

              label="Tracking Number"

              placeholder="PB-2026-000001"

              value={singleTracking}

              onChange={(e) => setSingleTracking(e.target.value.toUpperCase())}

              required

            />

            <div className="space-y-1.5">

              <label className="block text-xs font-medium uppercase tracking-wider text-muted">

                Status

              </label>

              <select

                value={singleStatus}

                onChange={(e) => setSingleStatus(e.target.value)}

                className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-green focus:outline-none focus:ring-1 focus:ring-boss-green"

              >

                {PACKAGE_STATUSES.map((s) => (

                  <option key={s.value} value={s.value}>

                    {s.label}

                  </option>

                ))}

              </select>

            </div>

            <Input

              label="Note (optional)"

              value={singleNote}

              onChange={(e) => setSingleNote(e.target.value)}

            />

            <Button type="submit" disabled={singleLoading || !singleTracking.trim()}>

              {singleLoading ? 'Updating...' : 'Update Status'}

            </Button>

            {singleSuccess && (

              <p className="text-sm text-boss-green">{singleSuccess}</p>

            )}

          </form>

        )}

      </div>



      {error && (

        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>

      )}



      {packages.length > 0 && selectedIds.size > 0 && (

        <div className="fixed bottom-16 left-0 right-0 z-20 border-t border-boss-green/30 bg-card/95 px-4 py-4 backdrop-blur md:bottom-0 md:left-52 lg:left-56">

          <div className="mx-auto flex max-w-5xl flex-wrap items-end gap-4">

            <div className="min-w-[160px] flex-1 space-y-1.5">

              <label className="block text-[10px] font-medium uppercase tracking-wider text-muted">

                New status

              </label>

              <select

                value={bulkStatus}

                onChange={(e) => setBulkStatus(e.target.value)}

                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-boss-green focus:outline-none"

              >

                {PACKAGE_STATUSES.map((s) => (

                  <option key={s.value} value={s.value}>

                    {s.label}

                  </option>

                ))}

              </select>

            </div>

            <div className="min-w-[200px] flex-1">

              <Input

                label="Note (optional)"

                placeholder="Departed Miami hub, etc."

                value={bulkNote}

                onChange={(e) => setBulkNote(e.target.value)}

              />

            </div>

            <Button

              type="button"

              disabled={bulkLoading || selectedIds.size === 0}

              onClick={handleBulkUpdate}

              className="shrink-0"

            >

              {bulkLoading

                ? 'Updating...'

                : `Update ${selectedIds.size} package${selectedIds.size === 1 ? '' : 's'}`}

            </Button>

          </div>

        </div>

      )}

      {staffPackage && (
        <PackageStaffModal
          pkg={staffPackage}
          onClose={() => setStaffPackage(null)}
          onUpdated={(updated) => {
            setPackages((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
            setStaffPackage(updated)
          }}
        />
      )}

    </div>

  )

}


