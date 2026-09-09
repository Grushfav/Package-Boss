import { Bike, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import {
  completeStaffLogisticsJob,
  fetchMyStaffLogisticsJobs,
  markStaffLogisticsInTransit,
  markStaffLogisticsPickedUp,
} from '../api/logisticsJobs'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { formatJmd } from '../lib/money'
import type { LogisticsJob } from '../types'

type StatusFilter = 'active' | 'pending' | 'all' | 'history'

function formatWhen(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
      {label}
    </span>
  )
}

function AddressBlock({ address }: { address?: LogisticsJob['pickup_address'] }) {
  if (!address) return <span className="text-xs text-muted">—</span>
  return (
    <div className="text-xs">
      <p className="font-semibold text-foreground">{address.label}</p>
      <p className="mt-0.5 text-muted">{address.formatted}</p>
      {address.contact_number && <p className="mt-0.5 text-muted">{address.contact_number}</p>}
    </div>
  )
}

export function ClerkLocalDeliveryPage() {
  const [jobs, setJobs] = useState<LogisticsJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [search, setSearch] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setJobs(await fetchMyStaffLogisticsJobs(statusFilter))
    } catch (err) {
      setError(getErrorMessage(err))
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((job) =>
      [
        job.reference,
        job.customer_name,
        job.shipping_id,
        job.item_description,
        job.notes,
        job.pickup_address?.formatted,
        job.dropoff_address?.formatted,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    )
  }, [jobs, search])

  async function runAction(jobId: string, action: () => Promise<LogisticsJob>) {
    setActionId(jobId)
    try {
      await action()
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionId(null)
    }
  }

  function renderActions(job: LogisticsJob) {
    const busy = actionId === job.id
    if (job.status === 'pending') {
      return (
        <Button
          type="button"
          variant="outline"
          className="!px-2 !py-1 !text-[11px]"
          disabled={busy}
          onClick={() => runAction(job.id, () => markStaffLogisticsPickedUp(job.id))}
        >
          {busy ? '…' : 'Picked up'}
        </Button>
      )
    }
    if (job.status === 'picked_up') {
      return (
        <Button
          type="button"
          variant="outline"
          className="!px-2 !py-1 !text-[11px]"
          disabled={busy}
          onClick={() => runAction(job.id, () => markStaffLogisticsInTransit(job.id))}
        >
          {busy ? '…' : 'In transit'}
        </Button>
      )
    }
    if (job.status === 'in_transit') {
      return (
        <Button
          type="button"
          variant="outline"
          className="!px-2 !py-1 !text-[11px]"
          disabled={busy}
          onClick={() => runAction(job.id, () => completeStaffLogisticsJob(job.id))}
        >
          {busy ? '…' : 'Delivered'}
        </Button>
      )
    }
    return <span className="text-xs text-muted">—</span>
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <IconBadge icon={Bike} />
          <div>
            <h1 className="text-2xl font-black uppercase">Delivery requests</h1>
            <p className="mt-1 text-sm text-muted">Local jobs assigned to you — pickup through delivery.</p>
          </div>
        </div>
        <Link to="/warehouse" className="text-sm font-semibold text-boss-gold hover:underline">
          ← Back to home
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference, customer, address…"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none ring-boss-gold/30 focus:ring-2"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="pending">Pending pickup</option>
            <option value="all">All assigned</option>
            <option value="history">Completed & closed</option>
          </select>
          <span className="text-xs text-muted">
            {filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="font-semibold">No delivery requests assigned to you</p>
          <p className="mt-2 text-sm text-muted">
            When an admin assigns a local delivery job to you, it will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Pickup</th>
                <th className="px-4 py-3">Drop-off</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id} className="border-b border-border align-top last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs text-boss-gold">{job.reference}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{job.customer_name ?? '—'}</p>
                    {job.shipping_id && (
                      <p className="mt-0.5 font-mono text-xs text-muted">{job.shipping_id}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill label={job.status_label} />
                    {job.status === 'completed' &&
                      (job.customer_receipt_confirmed_at ? (
                        <p className="mt-2 text-xs font-semibold text-boss-green">
                          Customer confirmed {formatWhen(job.customer_receipt_confirmed_at)}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                          Awaiting customer confirmation
                        </p>
                      ))}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{job.item_description}</p>
                    <p className="mt-1 text-xs text-muted">
                      {job.vehicle_type_label}
                      {job.delivery_speed_label ? ` · ${job.delivery_speed_label}` : ''}
                    </p>
                  </td>
                  <td className="max-w-[180px] px-4 py-3">
                    <AddressBlock address={job.pickup_address} />
                  </td>
                  <td className="max-w-[180px] px-4 py-3">
                    <AddressBlock address={job.dropoff_address} />
                  </td>
                  <td className="max-w-[160px] px-4 py-3 text-xs text-muted">{job.notes || '—'}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {job.fee_pending_quote
                      ? 'Quote pending'
                      : job.quoted_fee_jmd != null
                        ? formatJmd(job.quoted_fee_jmd)
                        : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{renderActions(job)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
