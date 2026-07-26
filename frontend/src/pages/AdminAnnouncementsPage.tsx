import { Megaphone, Radio, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  broadcastAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  fetchAdminAnnouncements,
  updateAnnouncement,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementDisplayAs,
  type AnnouncementSeverity,
  type BroadcastChannel,
} from '../api/announcements'
import { getErrorMessage } from '../api/client'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'

const AUDIENCE_OPTIONS: { value: AnnouncementAudience; label: string }[] = [
  { value: 'public', label: 'Public (website visitors)' },
  { value: 'customers', label: 'Customers' },
  { value: 'staff', label: 'Staff / warehouse' },
  { value: 'all', label: 'Everyone' },
]

const DISPLAY_OPTIONS: { value: AnnouncementDisplayAs; label: string }[] = [
  { value: 'banner', label: 'Site banner' },
  { value: 'modal', label: 'Urgent modal' },
  { value: 'inbox_only', label: 'Inbox only (no banner)' },
]

const SEVERITY_OPTIONS: { value: AnnouncementSeverity; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'urgent', label: 'Urgent' },
]

function fromLocalInputValue(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

function statusLabel(announcement: Announcement): string {
  const now = Date.now()
  const starts = new Date(announcement.starts_at).getTime()
  const ends = announcement.ends_at ? new Date(announcement.ends_at).getTime() : null
  if (!announcement.is_active) return 'Inactive'
  if (starts > now) return 'Scheduled'
  if (ends !== null && ends <= now) return 'Expired'
  return 'Active'
}

const emptyForm = {
  title: '',
  body: '',
  severity: 'info' as AnnouncementSeverity,
  audience: 'customers' as AnnouncementAudience,
  display_as: 'banner' as AnnouncementDisplayAs,
  starts_at: '',
  ends_at: '',
  dismissible: true,
  is_active: true,
}

export function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState<'all' | 'active' | 'scheduled' | 'expired'>('all')

  useEffect(() => {
    fetchAdminAnnouncements().then(setAnnouncements).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    const now = Date.now()
    return announcements.filter((item) => {
      const starts = new Date(item.starts_at).getTime()
      const ends = item.ends_at ? new Date(item.ends_at).getTime() : null
      const active =
        item.is_active && starts <= now && (ends === null || ends > now)
      const scheduled = item.is_active && starts > now
      const expired = !item.is_active || (ends !== null && ends <= now)
      if (filter === 'active') return active
      if (filter === 'scheduled') return scheduled
      if (filter === 'expired') return expired
      return true
    })
  }, [announcements, filter])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const created = await createAnnouncement({
        title: form.title,
        body: form.body,
        severity: form.severity,
        audience: form.audience,
        display_as: form.display_as,
        starts_at: fromLocalInputValue(form.starts_at) ?? undefined,
        ends_at: fromLocalInputValue(form.ends_at),
        dismissible: form.dismissible,
        is_active: form.is_active,
      })
      setAnnouncements((prev) => [created, ...prev])
      setForm(emptyForm)
      setShowCreateForm(false)
      setSuccess('Announcement created.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(item: Announcement) {
    setError('')
    setSuccess('')
    try {
      const updated = await updateAnnouncement(item.id, { is_active: !item.is_active })
      setAnnouncements((prev) => prev.map((row) => (row.id === item.id ? updated : row)))
      setSuccess(updated.is_active ? 'Announcement activated.' : 'Announcement deactivated.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleDelete(item: Announcement) {
    if (!window.confirm(`Delete "${item.title}"?`)) return
    setError('')
    setSuccess('')
    try {
      await deleteAnnouncement(item.id)
      setAnnouncements((prev) => prev.filter((row) => row.id !== item.id))
      setSuccess('Announcement deleted.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleBroadcast(
    item: Announcement,
    channels: BroadcastChannel[],
    alsoShowBanner: boolean,
  ) {
    const channelLabel = channels.join(' + ')
    if (!window.confirm(`Broadcast "${item.title}" via ${channelLabel}?`)) return
    setError('')
    setSuccess('')
    try {
      const result = await broadcastAnnouncement(item.id, {
        channels,
        also_show_banner: alsoShowBanner,
      })
      setAnnouncements((prev) =>
        prev.map((row) => (row.id === item.id ? result.announcement : row)),
      )
      const job = result.broadcast_job
      setSuccess(
        `Broadcast started (${job.status}). Sent: ${job.sent_count}, failed: ${job.failed_count}.`,
      )
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <IconBadge icon={Megaphone} />
            <h1 className="text-2xl font-black uppercase">Announcements</h1>
          </div>
          <p className="mt-2 text-sm text-muted">
            Post site messages and broadcast updates to customers.
          </p>
        </div>
        <Button type="button" onClick={() => setShowCreateForm((value) => !value)}>
          {showCreateForm ? 'Close form' : 'New announcement'}
        </Button>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}
      {success && (
        <p className="mb-4 rounded-lg bg-boss-green/10 px-4 py-2 text-sm text-boss-green">
          {success}
        </p>
      )}

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-bold uppercase">Create announcement</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
                maxLength={120}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold">Message</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                required
                rows={5}
                maxLength={5000}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Audience</label>
              <select
                value={form.audience}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    audience: e.target.value as AnnouncementAudience,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {AUDIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Display</label>
              <select
                value={form.display_as}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    display_as: e.target.value as AnnouncementDisplayAs,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {DISPLAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Severity</label>
              <select
                value={form.severity}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    severity: e.target.value as AnnouncementSeverity,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Starts</label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Ends (optional)</label>
              <Input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm((prev) => ({ ...prev, ends_at: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.dismissible}
                onChange={(e) => setForm((prev) => ({ ...prev, dismissible: e.target.checked }))}
              />
              Users can dismiss banner
            </label>
          </div>
          <div className="mt-6">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Create announcement'}
            </Button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'active', 'scheduled', 'expired'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${
              filter === tab
                ? 'bg-boss-gold/15 text-boss-gold'
                : 'text-muted hover:bg-card hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted">
            No announcements in this view.
          </p>
        ) : (
          filtered.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{item.title}</h3>
                    <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {statusLabel(item)}
                    </span>
                    <span className="rounded-full bg-boss-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase text-boss-gold">
                      {item.audience}
                    </span>
                    <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {item.display_as.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{item.body}</p>
                  <p className="mt-3 text-xs text-muted">
                    {item.starts_at && `Starts ${new Date(item.starts_at).toLocaleString()}`}
                    {item.ends_at && ` · Ends ${new Date(item.ends_at).toLocaleString()}`}
                    {item.broadcast_at &&
                      ` · Broadcast ${new Date(item.broadcast_at).toLocaleString()}`}
                  </p>
                  {item.latest_broadcast && (
                    <p className="mt-1 text-xs text-muted">
                      Last broadcast: {item.latest_broadcast.status} · sent{' '}
                      {item.latest_broadcast.sent_count}, failed {item.latest_broadcast.failed_count}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => handleToggleActive(item)}>
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleBroadcast(item, ['in_app'], false)}
                  >
                    <Radio className="mr-1 h-4 w-4" />
                    In-app
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleBroadcast(item, ['in_app', 'email'], true)}
                  >
                    <Radio className="mr-1 h-4 w-4" />
                    Email + in-app
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10"
                    aria-label="Delete announcement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
