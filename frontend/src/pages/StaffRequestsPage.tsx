import { Inbox, Search, Truck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import {
  cancelStaffDeliveryRequest,
  completeStaffDeliveryRequest,
  fetchStaffDeliveryRequests,
  markStaffDeliveryInProgress,
} from '../api/deliveryRequests'
import {
  confirmStaffBankTransferProof,
  fetchStaffBankTransferProofs,
  markStaffTransferInProgress,
  rejectStaffBankTransferProof,
} from '../api/staff'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { useWarehouseCounts } from '../context/WarehouseCountsContext'
import { formatJmd } from '../lib/money'
import type { BankTransferProof, DeliveryRequest } from '../types'

type RequestKind = 'delivery' | 'transfer'
type TypeFilter = 'all' | RequestKind
type StatusFilter =
  | 'all'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'confirmed'
  | 'cancelled'
  | 'rejected'

interface RequestRow {
  id: string
  kind: RequestKind
  status: string
  statusLabel: string
  customerName?: string | null
  shippingId?: string | null
  amountJmd?: number | null
  submittedAt: string
  reviewedAt?: string | null
  reviewedByName?: string | null
  packageSummary: string
  detail?: string
  proofUrl?: string | null
  transferReference?: string | null
  senderBankLabel?: string | null
  allPaid?: boolean
  deliveryRequest?: DeliveryRequest
  transferProof?: BankTransferProof
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusTone(
  status: string,
): 'green' | 'amber' | 'muted' | 'red' | 'sky' | 'violet' {
  if (status === 'completed' || status === 'confirmed') return 'green'
  if (status === 'cancelled') return 'muted'
  if (status === 'rejected') return 'red'
  if (status === 'in_progress') return 'violet'
  return 'amber'
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'green' | 'amber' | 'muted' | 'red' | 'sky' | 'violet'
}) {
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

function deliveryToRow(request: DeliveryRequest): RequestRow {
  const packageList = (request.packages ?? [])
    .map((pkg) => pkg.tracking_number)
    .filter(Boolean)
    .join(', ')
  const allPaid = (request.packages ?? []).every((pkg) => pkg.billing_status === 'paid')
  const address = request.delivery_address
  const detail = address
    ? `${address.label}${address.contact_number ? ` · ${address.contact_number}` : ''} — ${address.formatted}`
    : request.notes || undefined

  return {
    id: request.id,
    kind: 'delivery',
    status: request.status,
    statusLabel: request.status_label,
    customerName: request.customer_name,
    shippingId: request.shipping_id,
    amountJmd: request.delivery_fee_jmd,
    submittedAt: request.requested_at,
    reviewedAt:
      request.in_progress_at || request.completed_at || request.cancelled_at,
    reviewedByName:
      request.in_progress_by_name || request.completed_by_name,
    packageSummary: packageList,
    detail,
    allPaid,
    deliveryRequest: request,
  }
}

function transferToRow(proof: BankTransferProof): RequestRow {
  const packageList = (proof.packages ?? [])
    .map((pkg) => pkg.tracking_number)
    .filter(Boolean)
    .join(', ')

  return {
    id: proof.id,
    kind: 'transfer',
    status: proof.status,
    statusLabel: proof.status_label,
    customerName: proof.customer_name,
    shippingId: proof.shipping_id,
    amountJmd: proof.amount_jmd,
    submittedAt: proof.submitted_at,
    reviewedAt: proof.reviewed_at,
    reviewedByName: proof.reviewed_by_name,
    packageSummary: packageList,
    detail: proof.notes || undefined,
    proofUrl: proof.proof_url,
    transferReference: proof.transfer_reference,
    senderBankLabel: proof.sender_bank_label,
    transferProof: proof,
  }
}

function matchesSearch(row: RequestRow, query: string) {
  const haystack = [
    row.customerName,
    row.shippingId,
    row.packageSummary,
    row.transferReference,
    row.detail,
    row.statusLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function apiStatusForFilter(filter: StatusFilter): string {
  if (
    filter === 'completed' ||
    filter === 'confirmed' ||
    filter === 'cancelled' ||
    filter === 'rejected'
  ) {
    return 'history'
  }
  if (filter === 'pending' || filter === 'in_progress') {
    return filter
  }
  return 'active'
}

function matchesStatusFilter(row: RequestRow, statusFilter: StatusFilter) {
  if (statusFilter === 'all') return true
  if (statusFilter === 'completed') return row.kind === 'delivery' && row.status === 'completed'
  if (statusFilter === 'confirmed') return row.kind === 'transfer' && row.status === 'confirmed'
  return row.status === statusFilter
}

export function StaffRequestsPage() {
  const { counts } = useWarehouseCounts()
  const [openCount, setOpenCount] = useState(0)
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([])
  const [transferProofs, setTransferProofs] = useState<BankTransferProof[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    const errors: string[] = []
    const status = apiStatusForFilter(statusFilter)

    const [deliveryResult, transferResult] = await Promise.allSettled([
      fetchStaffDeliveryRequests(status),
      fetchStaffBankTransferProofs(status),
    ])

    if (deliveryResult.status === 'fulfilled') {
      setDeliveryRequests(deliveryResult.value ?? [])
    } else {
      setDeliveryRequests([])
      errors.push(getErrorMessage(deliveryResult.reason))
    }

    if (transferResult.status === 'fulfilled') {
      setTransferProofs(transferResult.value ?? [])
    } else {
      setTransferProofs([])
      errors.push(getErrorMessage(transferResult.reason))
    }

    if (errors.length > 0) {
      setError(errors.join(' · '))
    }

    setLoading(false)
  }, [statusFilter])

  useEffect(() => {
    setOpenCount(counts?.pending_customer_requests ?? 0)
  }, [counts?.pending_customer_requests])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const rows = useMemo(() => {
    const merged = [
      ...deliveryRequests.map(deliveryToRow),
      ...transferProofs.map(transferToRow),
    ]
    merged.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    )
    return merged
  }, [deliveryRequests, transferProofs])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (typeFilter !== 'all' && row.kind !== typeFilter) return false
      if (!matchesStatusFilter(row, statusFilter)) return false
      if (query && !matchesSearch(row, query)) return false
      return true
    })
  }, [rows, typeFilter, statusFilter, search])

  async function runAction(id: string, action: () => Promise<unknown>) {
    setActionId(id)
    setError('')
    try {
      await action()
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionId(null)
    }
  }

  function renderActions(row: RequestRow) {
    const busy = actionId === row.id
    const isOpen = row.status === 'pending' || row.status === 'in_progress'

    if (row.kind === 'delivery' && isOpen) {
      const allPaid = row.allPaid ?? false
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          {row.status === 'pending' && (
            <Button
              type="button"
              variant="outline"
              className="!px-2 !py-1 !text-[11px]"
              disabled={busy}
              onClick={() =>
                runAction(row.id, () => markStaffDeliveryInProgress(row.id))
              }
            >
              {busy ? '…' : 'In progress'}
            </Button>
          )}
          <Button
            type="button"
            className="!px-2 !py-1 !text-[11px]"
            disabled={!allPaid || busy}
            title={allPaid ? undefined : 'All packages must be paid first'}
            onClick={() => runAction(row.id, () => completeStaffDeliveryRequest(row.id))}
          >
            {busy ? '…' : 'Complete'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="!px-2 !py-1 !text-[11px]"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Cancel this delivery request?')) return
              runAction(row.id, () => cancelStaffDeliveryRequest(row.id))
            }}
          >
            Cancel
          </Button>
        </div>
      )
    }

    if (row.kind === 'transfer' && isOpen) {
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          {row.status === 'pending' && (
            <Button
              type="button"
              variant="outline"
              className="!px-2 !py-1 !text-[11px]"
              disabled={busy}
              onClick={() =>
                runAction(row.id, () => markStaffTransferInProgress(row.id))
              }
            >
              {busy ? '…' : 'In progress'}
            </Button>
          )}
          <Button
            type="button"
            className="!px-2 !py-1 !text-[11px]"
            disabled={busy}
            onClick={() => runAction(row.id, () => confirmStaffBankTransferProof(row.id))}
          >
            {busy ? '…' : 'Confirm'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="!px-2 !py-1 !text-[11px]"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Reject this transfer proof?')) return
              runAction(row.id, () => rejectStaffBankTransferProof(row.id))
            }}
          >
            Reject
          </Button>
        </div>
      )
    }

    return <span className="text-xs text-muted">—</span>
  }

  return (
    <div className="px-4 py-6 sm:py-8">
      <div className="mb-5 flex items-center gap-2.5">
        <IconBadge icon={Inbox} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Requests</h1>
          <p className="text-sm text-muted">
            Delivery runs and bank transfer proofs
            {openCount > 0 && (
              <span className="ml-2 rounded-full bg-boss-gold/15 px-2 py-0.5 text-xs font-semibold text-boss-gold">
                {openCount} open
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, BOSS ID, tracking, reference…"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none ring-boss-gold/30 focus:ring-2"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All types</option>
            <option value="delivery">Delivery</option>
            <option value="transfer">Bank transfer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Delivered</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>

          <span className="inline-flex items-center gap-1 text-xs text-muted sm:ml-auto">
            <Truck className="h-3.5 w-3.5" />
            J$800 / delivery run
          </span>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <p className="mb-3 text-sm text-muted">
        {loading
          ? 'Loading…'
          : `${filteredRows.length} request${filteredRows.length === 1 ? '' : 's'}${
              filteredRows.length !== rows.length ? ` (of ${rows.length})` : ''
            }`}
      </p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <p className="px-5 py-8 text-sm text-muted">Loading requests…</p>
        ) : filteredRows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Inbox className="mx-auto h-9 w-9 text-muted" />
            <p className="mt-3 font-semibold">No requests match your filters</p>
            <p className="mt-1 text-sm text-muted">
              Try clearing filters or search — new customer submissions appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border bg-muted/10 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Packages / details</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {row.kind === 'delivery' ? 'Delivery' : 'Transfer'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.shippingId ? (
                        <Link
                          to={`/warehouse/customers/${row.shippingId}`}
                          className="group block"
                        >
                          <span className="font-semibold group-hover:text-boss-gold">
                            {row.customerName || 'Customer'}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-boss-gold">
                            {row.shippingId}
                          </span>
                        </Link>
                      ) : (
                        <span className="font-semibold">{row.customerName || 'Customer'}</span>
                      )}
                      {row.senderBankLabel && (
                        <p className="mt-1 text-xs text-muted">From: {row.senderBankLabel}</p>
                      )}
                      {row.transferReference && (
                        <p className="mt-1 font-mono text-xs text-muted">
                          Ref: {row.transferReference}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill label={row.statusLabel} tone={statusTone(row.status)} />
                        {row.kind === 'delivery' &&
                          (row.status === 'pending' || row.status === 'in_progress') && (
                            <StatusPill
                              label={row.allPaid ? 'Paid' : 'Unpaid'}
                              tone={row.allPaid ? 'green' : 'amber'}
                            />
                          )}
                      </div>
                      {row.reviewedAt && (
                        <p className="mt-1 text-xs text-muted">
                          {row.status === 'in_progress'
                            ? `Started ${formatWhen(row.reviewedAt)}`
                            : `Updated ${formatWhen(row.reviewedAt)}`}
                          {row.reviewedByName ? ` · ${row.reviewedByName}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatWhen(row.submittedAt)}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {row.packageSummary && (
                        <p className="font-mono text-xs text-muted">{row.packageSummary}</p>
                      )}
                      {row.detail && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{row.detail}</p>
                      )}
                      {row.proofUrl && (
                        <a
                          href={row.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs font-semibold text-boss-gold hover:underline"
                        >
                          View proof
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {row.amountJmd != null ? formatJmd(row.amountJmd) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">{renderActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
