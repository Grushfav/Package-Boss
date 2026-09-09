import { Bike, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../api/client'
import {
  assignAdminLogisticsClerk,
  fetchAdminLogisticsJobs,
  fetchClerks,
  rejectAdminLogisticsJob,
} from '../api/admin'
import {
  completeStaffLogisticsJob,
  markStaffLogisticsInTransit,
  markStaffLogisticsPickedUp,
} from '../api/logisticsJobs'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { formatJmd } from '../lib/money'
import type { LogisticsJob, User } from '../types'

type StatusFilter = 'active' | 'pending' | 'all' | 'history' | 'rejected'

function formatWhen(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusTone(status: LogisticsJob['status'], job?: Pick<LogisticsJob, 'assigned_clerk_name' | 'driver_name'>) {
  if (status === 'pending' && (job?.assigned_clerk_name || job?.driver_name)) {
    return 'sky'
  }
  if (status === 'completed') return 'green'
  if (status === 'rejected') return 'red'
  if (status === 'cancelled') return 'muted'
  if (status === 'in_transit') return 'violet'
  if (status === 'picked_up') return 'sky'
  return 'amber'
}

function StatusPill({
  label,
  status,
  job,
}: {
  label: string
  status: LogisticsJob['status']
  job?: Pick<LogisticsJob, 'assigned_clerk_name' | 'driver_name'>
}) {
  const tone = statusTone(status, job)
  const classes = {
    green: 'bg-boss-green/15 text-boss-green',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    muted: 'bg-muted/25 text-muted',
    red: 'bg-red-500/15 text-red-700 dark:text-red-300',
    sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  }
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${classes[tone]}`}
    >
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
      {address.contact_number && (
        <p className="mt-0.5 text-muted">{address.contact_number}</p>
      )}
      {address.delivery_notes && (
        <p className="mt-1 text-muted italic">{address.delivery_notes}</p>
      )}
    </div>
  )
}

export function AdminLocalDeliveryPage() {
  const [jobs, setJobs] = useState<LogisticsJob[]>([])
  const [clerks, setClerks] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [search, setSearch] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [assignJobId, setAssignJobId] = useState<string | null>(null)
  const [selectedClerkId, setSelectedClerkId] = useState('')
  const [assignError, setAssignError] = useState('')
  const [rejectJobId, setRejectJobId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  const activeClerks = useMemo(
    () => clerks.filter((clerk) => clerk.is_active !== false && clerk.contact_number),
    [clerks],
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [jobList, clerkList] = await Promise.all([
        fetchAdminLogisticsJobs(statusFilter),
        fetchClerks(),
      ])
      setJobs(jobList)
      setClerks(clerkList)
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
    return jobs.filter((job) => {
      const pickup = job.pickup_address
      const dropoff = job.dropoff_address
      return [
        job.reference,
        job.customer_name,
        job.shipping_id,
        job.item_description,
        job.notes,
        job.assigned_clerk_name,
        job.driver_name,
        pickup?.label,
        pickup?.formatted,
        pickup?.parish,
        dropoff?.label,
        dropoff?.formatted,
        dropoff?.parish,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    })
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
    const isOpen = job.status === 'pending' || job.status === 'picked_up' || job.status === 'in_transit'

    if (job.status === 'pending') {
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            className="!px-2 !py-1 !text-[11px]"
            disabled={busy}
            onClick={() => {
              setAssignError('')
              setSelectedClerkId(job.assigned_clerk_id ?? '')
              setAssignJobId(job.id)
            }}
          >
            {job.assigned_clerk_id ? 'Reassign clerk' : 'Assign clerk'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="!px-2 !py-1 !text-[11px] !text-red-600"
            disabled={busy}
            onClick={() => {
              setRejectError('')
              setRejectReason('')
              setRejectJobId(job.id)
            }}
          >
            Reject
          </Button>
          {job.assigned_clerk_id && (
            <Button
              type="button"
              variant="outline"
              className="!px-2 !py-1 !text-[11px]"
              disabled={busy}
              onClick={() => runAction(job.id, () => markStaffLogisticsPickedUp(job.id))}
            >
              {busy ? '…' : 'Picked up'}
            </Button>
          )}
        </div>
      )
    }

    if (!isOpen) return <span className="text-xs text-muted">—</span>

    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        {job.status === 'picked_up' && (
          <Button
            type="button"
            variant="outline"
            className="!px-2 !py-1 !text-[11px]"
            disabled={busy}
            onClick={() => runAction(job.id, () => markStaffLogisticsInTransit(job.id))}
          >
            {busy ? '…' : 'In transit'}
          </Button>
        )}
        {job.status === 'in_transit' && (
          <Button
            type="button"
            variant="outline"
            className="!px-2 !py-1 !text-[11px]"
            disabled={busy}
            onClick={() => runAction(job.id, () => completeStaffLogisticsJob(job.id))}
          >
            {busy ? '…' : 'Delivered'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <IconBadge icon={Bike} />
          <div>
            <h1 className="text-2xl font-black uppercase">Local delivery requests</h1>
            <p className="mt-1 text-sm text-muted">
              Islandwide pickup and drop-off jobs — assign a clerk or reject pending requests.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference, customer, address, item…"
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
            <option value="pending">Pending only</option>
            <option value="all">All</option>
            <option value="history">Completed & closed</option>
            <option value="rejected">Rejected</option>
          </select>
          <span className="text-xs text-muted">
            {filteredJobs.length} request{filteredJobs.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="font-semibold">No local delivery requests</p>
          <p className="mt-2 text-sm text-muted">
            New customer bookings appear here for clerk assignment.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status / handler</th>
                <th className="px-4 py-3">Item & timing</th>
                <th className="px-4 py-3">Pickup</th>
                <th className="px-4 py-3">Drop-off</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id} className="border-b border-border align-top last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-boss-gold">{job.reference}</p>
                    {job.payment_method_label && (
                      <p className="mt-1 text-[11px] text-muted">{job.payment_method_label}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{job.customer_name ?? '—'}</p>
                    {job.shipping_id && (
                      <p className="mt-0.5 font-mono text-xs text-muted">{job.shipping_id}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill label={job.status_label} status={job.status} job={job} />
                    {(job.assigned_clerk_name || job.driver_name) && (
                      <div className="mt-2 text-xs">
                        <p className="font-semibold text-foreground">
                          {job.assigned_clerk_name || job.driver_name}
                        </p>
                        {job.driver_contact_number && (
                          <p className="mt-0.5 text-muted">{job.driver_contact_number}</p>
                        )}
                        {job.assigned_at && (
                          <p className="mt-1 text-muted">Assigned {formatWhen(job.assigned_at)}</p>
                        )}
                      </div>
                    )}
                    {job.status === 'rejected' && job.rejection_reason && (
                      <p className="mt-2 text-xs text-red-600">{job.rejection_reason}</p>
                    )}
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
                      {job.vehicle_weight_label ? ` · ${job.vehicle_weight_label}` : ''}
                    </p>
                    {job.delivery_speed_label && (
                      <p className="mt-0.5 text-xs text-muted">{job.delivery_speed_label}</p>
                    )}
                  </td>
                  <td className="max-w-[180px] px-4 py-3">
                    <AddressBlock address={job.pickup_address} />
                  </td>
                  <td className="max-w-[180px] px-4 py-3">
                    <AddressBlock address={job.dropoff_address} />
                  </td>
                  <td className="max-w-[160px] px-4 py-3 text-xs text-muted">
                    {job.notes || '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {job.fee_pending_quote
                      ? 'Quote pending'
                      : job.quoted_fee_jmd != null
                        ? formatJmd(job.quoted_fee_jmd)
                        : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatWhen(job.requested_at)}</td>
                  <td className="px-4 py-3">{renderActions(job)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-wide">Assign clerk</h2>
            <p className="mt-1 text-xs text-muted">
              The customer will see this clerk&apos;s name and contact number as their driver.
            </p>
            <div className="mt-4">
              <label htmlFor="assign-clerk" className="mb-1 block text-xs font-semibold text-muted">
                Clerk
              </label>
              <select
                id="assign-clerk"
                value={selectedClerkId}
                onChange={(event) => setSelectedClerkId(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a clerk…</option>
                {activeClerks.map((clerk) => (
                  <option key={clerk.id} value={clerk.id}>
                    {clerk.first_name} {clerk.last_name}
                    {clerk.contact_number ? ` · ${clerk.contact_number}` : ''}
                  </option>
                ))}
              </select>
              {activeClerks.length === 0 && (
                <p className="mt-2 text-xs text-muted">
                  No active clerks with contact numbers. Add one under Clerks first.
                </p>
              )}
              {assignError && <p className="mt-2 text-xs text-red-600">{assignError}</p>}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAssignJobId(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!selectedClerkId || actionId === assignJobId}
                onClick={async () => {
                  setAssignError('')
                  setActionId(assignJobId)
                  try {
                    await assignAdminLogisticsClerk(assignJobId, selectedClerkId)
                    setAssignJobId(null)
                    await loadAll()
                  } catch (err) {
                    setAssignError(getErrorMessage(err))
                  } finally {
                    setActionId(null)
                  }
                }}
              >
                {actionId === assignJobId ? 'Saving…' : 'Assign clerk'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {rejectJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-wide text-red-600">Reject request</h2>
            <p className="mt-1 text-xs text-muted">
              The customer will see this request as rejected. This cannot be undone.
            </p>
            <div className="mt-4">
              <label htmlFor="reject-reason" className="mb-1 block text-xs font-semibold text-muted">
                Reason (optional)
              </label>
              <Input
                id="reject-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Out of service area, unavailable today, etc."
              />
              {rejectError && <p className="mt-2 text-xs text-red-600">{rejectError}</p>}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRejectJobId(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={actionId === rejectJobId}
                onClick={async () => {
                  setRejectError('')
                  setActionId(rejectJobId)
                  try {
                    await rejectAdminLogisticsJob(rejectJobId, rejectReason)
                    setRejectJobId(null)
                    await loadAll()
                  } catch (err) {
                    setRejectError(getErrorMessage(err))
                  } finally {
                    setActionId(null)
                  }
                }}
              >
                {actionId === rejectJobId ? 'Rejecting…' : 'Reject request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
