import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchStaffPreAlerts } from '../api/staff'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import type { PreAlert } from '../types'

const PAGE_SIZE = 25

type StatusFilter = 'all' | PreAlert['status']

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

function statusBadgeClass(status: PreAlert['status']) {
  switch (status) {
    case 'pending':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    case 'received':
    case 'matched':
      return 'bg-boss-green/15 text-boss-green'
    case 'cancelled':
      return 'bg-muted/20 text-muted'
    default:
      return 'bg-muted/20 text-muted'
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function WarehousePreAlertsPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [preAlerts, setPreAlerts] = useState<PreAlert[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
      setOffset(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setLoading(true)
    fetchStaffPreAlerts({
      q: debouncedQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: PAGE_SIZE,
      offset,
    })
      .then((data) => {
        setPreAlerts(data.pre_alerts)
        setTotal(data.total)
      })
      .catch(() => {
        setPreAlerts([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [debouncedQuery, statusFilter, offset])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <IconBadge icon={Bell} size="sm" />
          <div>
            <h1 className="text-2xl font-black uppercase">Pre-alerts</h1>
            <p className="text-sm text-muted">
              Customer tracking submissions awaiting receipt at Fort Lauderdale
            </p>
          </div>
        </div>
        <Link to="/warehouse/receive">
          <Button variant="outline" className="!text-xs">
            Go to receive
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setStatusFilter(filter.value)
              setOffset(0)
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase transition-colors ${
              statusFilter === filter.value
                ? 'bg-boss-gold/15 text-boss-gold'
                : 'border border-border text-muted hover:text-foreground'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <Input
          label="Search tracking, merchant, customer, or BOSS ID"
          placeholder="1Z999AA10123456784 or BOSS-90009"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted">Loading pre-alerts...</p>
        ) : preAlerts.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            {debouncedQuery || statusFilter !== 'all'
              ? 'No pre-alerts match your filters.'
              : 'No pre-alerts submitted yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border bg-background/50 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Carrier tracking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 hidden md:table-cell">Merchant</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Value</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Submitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="px-4 py-3 font-mono font-semibold">{alert.carrier_tracking}</td>
                    <td className="px-4 py-3">
                      {alert.customer ? (
                        <div>
                          <p className="font-medium">{alert.customer.full_name}</p>
                          <p className="text-xs text-muted">{alert.customer.shipping_id}</p>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {alert.merchant || '—'}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {alert.declared_value_usd != null
                        ? `$${alert.declared_value_usd.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${statusBadgeClass(alert.status)}`}
                      >
                        {alert.status_label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">
                      {formatDate(alert.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {alert.invoice_url && (
                          <a
                            href={alert.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:border-boss-gold/40 hover:text-boss-gold"
                          >
                            Invoice
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            Page {currentPage} of {totalPages} ({total} pre-alerts)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="!py-2 !text-xs"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="!py-2 !text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
