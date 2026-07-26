import { Megaphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  fetchMyAnnouncements,
  markAnnouncementRead,
  type Announcement,
} from '../../api/announcements'
import { getErrorMessage } from '../../api/client'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function severityBadge(severity: Announcement['severity']) {
  switch (severity) {
    case 'urgent':
      return 'bg-red-500/15 text-red-400'
    case 'warning':
      return 'bg-amber-500/15 text-amber-500'
    default:
      return 'bg-boss-gold/15 text-boss-gold'
  }
}

export function MessagesSection() {
  const [messages, setMessages] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchMyAnnouncements()
      .then(setMessages)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  async function handleOpen(message: Announcement) {
    setExpandedId((current) => (current === message.id ? null : message.id))
    if (!message.is_read) {
      try {
        await markAnnouncementRead(message.id)
        setMessages((prev) =>
          prev.map((item) => (item.id === message.id ? { ...item, is_read: true } : item)),
        )
      } catch {
        // non-blocking
      }
    }
  }

  const unreadCount = messages.filter((message) => !message.is_read).length

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-boss-gold" />
        <h2 className="text-lg font-bold uppercase tracking-wide">Messages</h2>
        {unreadCount > 0 && (
          <span className="rounded-full bg-boss-gold/15 px-2 py-0.5 text-xs font-bold text-boss-gold">
            {unreadCount} new
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        Service updates and announcements from Package Boss.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading messages…</p>
      ) : messages.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted">
          No announcements yet. Important updates will appear here when we send them.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {messages.map((message) => {
            const expanded = expandedId === message.id
            return (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => handleOpen(message)}
                  className={`w-full rounded-xl border bg-card p-5 text-left transition-colors hover:border-boss-gold/30 ${
                    message.is_read ? 'border-border' : 'border-boss-gold/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{message.title}</p>
                        {!message.is_read && (
                          <span className="rounded-full bg-boss-gold px-2 py-0.5 text-[10px] font-bold uppercase text-black">
                            New
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityBadge(message.severity)}`}
                        >
                          {message.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {message.broadcast_at ? formatWhen(message.broadcast_at) : formatWhen(message.created_at)}
                      </p>
                    </div>
                  </div>
                  {expanded && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{message.body}</p>
                  )}
                  {!expanded && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{message.body}</p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
