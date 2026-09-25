import { Megaphone, Radio, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  broadcastAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  fetchAdminAnnouncements,
  previewAnnouncementRecipients,
  updateAnnouncement,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementDisplayAs,
  type AnnouncementRecipientPreview,
  type AnnouncementSeverity,
  type AnnouncementTargetMode,
  type BroadcastChannel,
} from '../api/announcements'
import { getErrorMessage } from '../api/client'
import { fetchShipments, type ShipmentSummary } from '../api/staff'
import { CustomerEmailNotificationsPanel } from '../components/admin/CustomerEmailNotificationsPanel'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { WORKFLOW_STATUSES } from '../lib/packageStatuses'

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
  target_mode: 'broadcast' as AnnouncementTargetMode,
  package_statuses: [] as string[],
  shipment_id: '',
  display_as: 'banner' as AnnouncementDisplayAs,
  starts_at: '',
  ends_at: '',
  dismissible: true,
  is_active: true,
}

function targetCriteriaFromForm(form: typeof emptyForm) {
  const criteria: {
    package_statuses?: string[]
    shipment_id?: string
  } = {}
  if (form.package_statuses.length > 0) criteria.package_statuses = form.package_statuses
  if (form.shipment_id) criteria.shipment_id = form.shipment_id
  return criteria
}

function statusLabelsFromCriteria(criteria: Announcement['target_criteria']): string[] {
  if (!criteria) return []
  const values =
    criteria.package_statuses ?? (criteria.package_status ? [criteria.package_status] : [])
  return values.map(
    (value) => WORKFLOW_STATUSES.find((row) => row.value === value)?.label ?? value,
  )
}

function describeTargetCriteria(
  targetMode: AnnouncementTargetMode,
  criteria: Announcement['target_criteria'],
): string | null {
  if (targetMode !== 'targeted' || !criteria) return null
  const parts: string[] = []
  const statusLabels = statusLabelsFromCriteria(criteria)
  if (statusLabels.length > 0) {
    parts.push(`status: ${statusLabels.join(', ')}`)
  }
  if (criteria.shipment_id) parts.push('departure batch')
  if (criteria.package_ids?.length) parts.push(`${criteria.package_ids.length} packages`)
  return parts.length > 0 ? parts.join(' · ') : 'custom targeting'
}

export function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState<'all' | 'active' | 'scheduled' | 'expired'>('all')
  const [shipments, setShipments] = useState<ShipmentSummary[]>([])
  const [recipientPreview, setRecipientPreview] = useState<AnnouncementRecipientPreview | null>(
    null,
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    fetchAdminAnnouncements().then(setAnnouncements).catch(() => {})
    fetchShipments({ limit: 50 })
      .then(({ shipments: rows }) => setShipments(rows))
      .catch(() => {})
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
        audience: form.target_mode === 'targeted' ? 'customers' : form.audience,
        target_mode: form.target_mode,
        target_criteria:
          form.target_mode === 'targeted' ? targetCriteriaFromForm(form) : null,
        display_as: form.display_as,
        starts_at: fromLocalInputValue(form.starts_at) ?? undefined,
        ends_at: fromLocalInputValue(form.ends_at),
        dismissible: form.dismissible,
        is_active: form.is_active,
      })
      setAnnouncements((prev) => [created, ...prev])
      setForm(emptyForm)
      setRecipientPreview(null)
      setPreviewError('')
      setShowCreateForm(false)
      setSuccess(
        created.target_mode === 'targeted'
          ? 'Targeted announcement created. Broadcast when ready to notify affected customers.'
          : 'Announcement created.',
      )
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

  async function handlePreviewRecipients() {
    setPreviewError('')
    setPreviewLoading(true)
    try {
      const preview = await previewAnnouncementRecipients(targetCriteriaFromForm(form))
      setRecipientPreview(preview)
    } catch (err) {
      setRecipientPreview(null)
      setPreviewError(getErrorMessage(err))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleBroadcast(
    item: Announcement,
    channels: BroadcastChannel[],
    alsoShowBanner: boolean,
  ) {
    const channelLabel = channels.join(' + ')
    const targetedNote =
      item.target_mode === 'targeted'
        ? '\n\nOnly customers with matching packages will receive this update.'
        : ''
    if (!window.confirm(`Broadcast "${item.title}" via ${channelLabel}?${targetedNote}`)) return
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

      <CustomerEmailNotificationsPanel />

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
              <label className="mb-1 block text-sm font-semibold">Reach</label>
              <select
                value={form.target_mode}
                onChange={(e) => {
                  const target_mode = e.target.value as AnnouncementTargetMode
                  setForm((prev) => ({
                    ...prev,
                    target_mode,
                    audience: target_mode === 'targeted' ? 'customers' : prev.audience,
                  }))
                  setRecipientPreview(null)
                  setPreviewError('')
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="broadcast">Everyone in audience</option>
                <option value="targeted">Affected customers only</option>
              </select>
            </div>
            {form.target_mode === 'broadcast' ? (
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
            ) : (
              <>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">Package status</label>
                  <p className="mb-2 text-xs text-muted">
                    Select one or more statuses. Leave empty to match any status.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {WORKFLOW_STATUSES.map((option) => {
                      const checked = form.package_statuses.includes(option.value)
                      return (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            checked
                              ? 'border-boss-gold/40 bg-boss-gold/10 text-boss-gold'
                              : 'border-border bg-background text-muted hover:text-foreground'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setForm((prev) => ({
                                ...prev,
                                package_statuses: e.target.checked
                                  ? [...prev.package_statuses, option.value]
                                  : prev.package_statuses.filter((value) => value !== option.value),
                              }))
                              setRecipientPreview(null)
                            }}
                          />
                          {option.label}
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Departure (optional)</label>
                  <select
                    value={form.shipment_id}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, shipment_id: e.target.value }))
                      setRecipientPreview(null)
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Any departure</option>
                    {shipments.map((shipment) => (
                      <option key={shipment.id} value={shipment.id}>
                        {shipment.reference} · {shipment.departure_date} · {shipment.status}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
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
          {form.target_mode === 'targeted' && (
            <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold">Preview recipients</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={previewLoading}
                  onClick={handlePreviewRecipients}
                >
                  {previewLoading ? 'Checking…' : 'Preview'}
                </Button>
              </div>
              {previewError && (
                <p className="mt-2 text-sm text-red-400">{previewError}</p>
              )}
              {recipientPreview && (
                <div className="mt-2 text-sm text-muted">
                  <p className="font-semibold text-foreground">
                    {recipientPreview.customer_count} customer
                    {recipientPreview.customer_count === 1 ? '' : 's'} ·{' '}
                    {recipientPreview.package_count} package
                    {recipientPreview.package_count === 1 ? '' : 's'}
                  </p>
                  {recipientPreview.customers.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs">
                      {recipientPreview.customers.slice(0, 5).map((customer) => (
                        <li key={customer.user_id}>
                          {customer.name} · {customer.package_count} pkg
                          {customer.package_count === 1 ? '' : 's'}
                        </li>
                      ))}
                      {recipientPreview.customers.length > 5 && (
                        <li>+ {recipientPreview.customers.length - 5} more customers</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
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
                      {item.target_mode === 'targeted' ? 'targeted' : item.audience}
                    </span>
                    {item.target_mode === 'targeted' && item.target_criteria && (
                      <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-bold uppercase">
                        {describeTargetCriteria(item.target_mode, item.target_criteria)}
                      </span>
                    )}
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
