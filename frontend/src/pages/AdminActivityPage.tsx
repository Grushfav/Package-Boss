import { Activity } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchActivityLog } from '../api/admin'
import { IconBadge } from '../components/ui/IconBadge'
import { Button } from '../components/ui/Button'
import type { AuditLogEntry } from '../types'

const ACTION_LABELS: Record<string, string> = {
  'package.received': 'Package received',
  'package.status_updated': 'Status updated',
}

export function AdminActivityPage() {
  const [activity, setActivity] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [filter, setFilter] = useState('')
  const limit = 25

  useEffect(() => {
    fetchActivityLog(limit, offset, filter || undefined)
      .then((data) => {
        setActivity(data.activity)
        setTotal(data.total)
      })
      .catch(() => {
        setActivity([])
        setTotal(0)
      })
  }, [offset, filter])

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={Activity} size="sm" />
        <h1 className="text-2xl font-black uppercase">Activity Log</h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setFilter(''); setOffset(0) }}
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${!filter ? 'bg-boss-gold text-white' : 'border border-border text-muted'}`}
        >
          All
        </button>
        {Object.entries(ACTION_LABELS).map(([code, label]) => (
          <button
            key={code}
            type="button"
            onClick={() => { setFilter(code); setOffset(0) }}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${filter === code ? 'bg-boss-gold text-white' : 'border border-border text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {activity.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No activity found.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/50 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Clerk</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activity.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{entry.actor_name}</p>
                    <p className="text-xs text-muted">{entry.actor_role}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold uppercase text-boss-gold">
                    {ACTION_LABELS[entry.action] || entry.action}
                  </td>
                  <td className="px-4 py-3">{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            Page {currentPage} of {totalPages} ({total} entries)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="!py-2 !text-xs"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
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
