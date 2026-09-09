import { ChevronDown, ChevronUp, MapPin, Plus, Truck, User } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../../api/client'
import {
  cancelLogisticsJob,
  confirmLogisticsJobReceipt,
  fetchMyLogisticsJobs,
  updateLogisticsJobNotes,
} from '../../api/logisticsJobs'
import { Button } from '../../components/ui/Button'
import { IconBadge } from '../../components/ui/IconBadge'
import { Input } from '../../components/ui/Input'
import { LogisticsStatusTracker } from '../../components/logistics/LogisticsStatusTracker'
import { formatJmd } from '../../lib/money'
import type { LogisticsJob } from '../../types'

function isActiveJob(job: LogisticsJob) {
  if (job.status === 'pending' || job.status === 'picked_up' || job.status === 'in_transit') {
    return true
  }
  return job.status === 'completed' && !job.customer_receipt_confirmed_at
}
function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusTone(
  status: LogisticsJob['status'],
  job?: Pick<LogisticsJob, 'assigned_clerk_name' | 'driver_name'>,
) {
  if (status === 'completed') return 'text-boss-green'
  if (status === 'cancelled' || status === 'rejected') return 'text-muted'
  if (status === 'in_transit') return 'text-violet-600 dark:text-violet-300'
  if (status === 'picked_up') return 'text-sky-600 dark:text-sky-300'
  if (status === 'pending' && (job?.assigned_clerk_name || job?.driver_name)) {
    return 'text-sky-600 dark:text-sky-300'
  }
  return 'text-amber-600 dark:text-amber-300'
}

function JobCard({
  job,
  onCancel,
  onUpdated,
  busy,
}: {
  job: LogisticsJob
  onCancel: (id: string) => void
  onUpdated: (job: LogisticsJob) => void
  busy: boolean
}) {
  const pickup = job.pickup_address
  const dropoff = job.dropoff_address
  const active = isActiveJob(job)
  const awaitingReceipt =
    job.status === 'completed' && !job.customer_receipt_confirmed_at
  const [noteDraft, setNoteDraft] = useState(job.notes ?? '')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [receiptConfirming, setReceiptConfirming] = useState(false)
  const [receiptError, setReceiptError] = useState('')

  useEffect(() => {
    setNoteDraft(job.notes ?? '')
  }, [job.id, job.notes])

  async function handleSaveNote() {
    setNoteError('')
    setNoteSaving(true)
    try {
      const updated = await updateLogisticsJobNotes(job.id, noteDraft.trim())
      onUpdated(updated)
      setNoteOpen(false)
    } catch (err) {
      setNoteError(getErrorMessage(err))
    } finally {
      setNoteSaving(false)
    }
  }

  async function handleConfirmReceipt() {
    setReceiptError('')
    setReceiptConfirming(true)
    try {
      const updated = await confirmLogisticsJobReceipt(job.id)
      onUpdated(updated)
    } catch (err) {
      setReceiptError(getErrorMessage(err))
    } finally {
      setReceiptConfirming(false)
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-boss-gold">{job.reference}</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">{job.item_description}</h3>
          {(job.vehicle_type_label || job.vehicle_weight_label) && (
            <p className="mt-1 text-xs text-muted">
              {job.vehicle_type_label}
              {job.vehicle_weight_label ? ` · ${job.vehicle_weight_label}` : ''}
              {job.delivery_speed_label ? ` · ${job.delivery_speed_label}` : ''}
            </p>
          )}
          <p className={`mt-2 text-xs font-semibold uppercase tracking-wide ${statusTone(job.status, job)}`}>
            {job.status_label}
          </p>
        </div>
        <div className="text-right text-sm">
          {job.fee_pending_quote ? (
            <p className="text-muted">Fee pending quote</p>
          ) : job.quoted_fee_jmd != null ? (
            <p className="font-bold tabular-nums text-boss-green">{formatJmd(job.quoted_fee_jmd)}</p>
          ) : null}
          {job.payment_method_label && (
            <p className="mt-1 text-xs text-muted">{job.payment_method_label}</p>
          )}
          <p className="mt-1 text-xs text-muted">Requested {formatWhen(job.requested_at)}</p>
        </div>
      </div>

      <LogisticsStatusTracker status={job.status} driverName={job.driver_name} />

      {job.driver_name && (
        <div className="mt-4 rounded-lg border border-boss-gold/30 bg-boss-gold/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-boss-gold">Your driver</p>
          <div className="mt-2 flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-boss-gold" />
            <div>
              <p className="text-sm font-semibold text-foreground">{job.driver_name}</p>
              {job.driver_contact_number && (
                <a
                  href={`tel:${job.driver_contact_number}`}
                  className="mt-0.5 block text-sm text-boss-gold hover:underline"
                >
                  {job.driver_contact_number}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">        <div className="rounded-lg bg-background/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Pickup</p>
          <p className="mt-1 font-semibold">{pickup?.label ?? '—'}</p>
          <p className="mt-0.5 text-xs text-muted">{pickup?.formatted ?? '—'}</p>
        </div>
        <div className="rounded-lg bg-background/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Drop-off</p>
          <p className="mt-1 font-semibold">{dropoff?.label ?? '—'}</p>
          <p className="mt-0.5 text-xs text-muted">{dropoff?.formatted ?? '—'}</p>
        </div>
      </div>

      {active && (
        <div className="mt-4 rounded-lg border border-border bg-background/40">
          <button
            type="button"
            onClick={() => setNoteOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 p-3 text-left"
          >
            <span className="min-w-0 text-xs font-semibold text-muted">
              {job.notes ? (
                <>
                  <span className="text-foreground">Note</span>
                  <span className="ml-1 truncate text-muted">· {job.notes}</span>
                </>
              ) : (
                'Add a note'
              )}
            </span>
            {noteOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
            )}
          </button>
          {noteOpen && (
            <div className="border-t border-border px-3 pb-3 pt-2">
              <label htmlFor={`note-${job.id}`} className="mb-1 block text-xs font-semibold text-muted">
                {job.notes ? 'Update your note' : 'Add a note'}
              </label>
              <Input
                id={`note-${job.id}`}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Gate code, call on arrival, updated instructions…"
              />
              {noteError && <p className="mt-2 text-xs text-red-600">{noteError}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="!text-xs"
                  disabled={noteSaving || !noteDraft.trim() || noteDraft.trim() === (job.notes ?? '').trim()}
                  onClick={handleSaveNote}
                >
                  {noteSaving ? 'Saving…' : job.notes ? 'Save note' : 'Add note'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!active && job.notes && <p className="mt-3 text-xs text-muted">Notes: {job.notes}</p>}

      {job.status === 'rejected' && job.rejection_reason && (
        <p className="mt-3 text-xs text-red-600">Reason: {job.rejection_reason}</p>
      )}

      {job.picked_up_at && (
        <p className="mt-3 text-xs text-muted">
          Picked up {formatWhen(job.picked_up_at)}
          {job.picked_up_by_name ? ` by ${job.picked_up_by_name}` : ''}
        </p>
      )}
      {job.in_transit_at && (
        <p className="mt-3 text-xs text-muted">
          In transit since {formatWhen(job.in_transit_at)}
          {job.in_transit_by_name ? ` · ${job.in_transit_by_name}` : ''}
        </p>
      )}
      {job.status === 'completed' && job.completed_at && (
        <p className="mt-3 text-xs text-muted">
          Delivered {formatWhen(job.completed_at)}
          {job.completed_by_name ? ` by ${job.completed_by_name}` : ''}
        </p>
      )}

      {awaitingReceipt && (
        <div className="mt-4 rounded-lg border border-boss-green/40 bg-boss-green/5 p-4">
          <p className="text-sm font-semibold text-foreground">Did you receive your package?</p>
          <p className="mt-1 text-xs text-muted">
            Confirm receipt so your driver and our team know the delivery was successful.
          </p>
          {receiptError && <p className="mt-2 text-xs text-red-600">{receiptError}</p>}
          <div className="mt-3">
            <Button
              type="button"
              className="!text-xs"
              disabled={receiptConfirming}
              onClick={handleConfirmReceipt}
            >
              {receiptConfirming ? 'Confirming…' : 'Yes, I received it'}
            </Button>
          </div>
        </div>
      )}

      {job.status === 'completed' && job.customer_receipt_confirmed_at && (
        <p className="mt-3 text-xs font-semibold text-boss-green">
          You confirmed receipt on {formatWhen(job.customer_receipt_confirmed_at)}.
        </p>
      )}

      {job.status === 'pending' && (
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            className="!text-xs"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Cancel this local delivery request?')) return
              onCancel(job.id)
            }}
          >
            {busy ? 'Cancelling…' : 'Cancel request'}
          </Button>
        </div>
      )}
    </article>
  )
}

export function DashboardLogisticsPage() {
  const [jobs, setJobs] = useState<LogisticsJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setJobs(await fetchMyLogisticsJobs())
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { activeJobs, historyJobs } = useMemo(() => {
    const active = jobs.filter(isActiveJob)
    const history = jobs.filter((job) => !isActiveJob(job))
    return { activeJobs: active, historyJobs: history }
  }, [jobs])

  async function handleCancel(id: string) {
    setActionId(id)
    try {
      await cancelLogisticsJob(id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionId(null)
    }
  }

  function handleJobUpdated(updated: LogisticsJob) {
    setJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)))
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <IconBadge icon={Truck} size="sm" />
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wide">Local delivery</h2>
            <p className="mt-1 text-sm text-muted">
              Request and track islandwide pickup and delivery across Jamaica.
            </p>
          </div>
        </div>
        <Link
          to="/dashboard/logistics/book"
          className="inline-flex items-center gap-2 rounded-lg bg-boss-gold px-4 py-2 text-sm font-semibold text-black"
        >
          <Plus className="h-4 w-4" />
          Book delivery
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-4 text-sm text-muted">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-boss-gold" />
          <span>
            <strong className="text-foreground">Local delivery</strong> moves items between addresses in
            Jamaica. For US packages cleared at our warehouse, use{' '}
            <Link to="/dashboard/packages" className="font-semibold text-boss-gold hover:underline">
              Packages → Request delivery
            </Link>{' '}
            instead.
          </span>
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Active requests</h3>
            {activeJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted">No active local delivery requests.</p>
                <Link
                  to="/dashboard/logistics/book"
                  className="mt-3 inline-block text-sm font-semibold text-boss-gold hover:underline"
                >
                  Book your first delivery →
                </Link>
              </div>
            ) : (
              activeJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCancel={handleCancel}
                  onUpdated={handleJobUpdated}
                  busy={actionId === job.id}
                />
              ))
            )}
          </section>

          {historyJobs.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">History</h3>
              {historyJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCancel={handleCancel}
                  onUpdated={handleJobUpdated}
                  busy={false}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
