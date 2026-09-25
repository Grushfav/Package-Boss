import { Megaphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AnnouncementSeverity } from '../../api/announcements'
import { getErrorMessage } from '../../api/client'
import {
  previewTargetedAnnouncementRecipients,
  sendTargetedAnnouncement,
} from '../../api/staff'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { Package } from '../../types'

interface TargetedAnnouncementModalProps {
  packageIds: string[]
  packages?: Package[]
  defaultTitle?: string
  defaultBody?: string
  onClose: () => void
  onCompleted: (summary: string) => void
}

const DEFAULT_TITLE = 'Customs clearance update'
const DEFAULT_BODY =
  'There is a delay with customs clearance affecting your package(s). We are monitoring the situation and will update you as soon as your package is released. Thank you for your patience.'

export function TargetedAnnouncementModal({
  packageIds,
  packages = [],
  defaultTitle = DEFAULT_TITLE,
  defaultBody = DEFAULT_BODY,
  onClose,
  onCompleted,
}: TargetedAnnouncementModalProps) {
  const [title, setTitle] = useState(defaultTitle)
  const [body, setBody] = useState(defaultBody)
  const [severity, setSeverity] = useState<AnnouncementSeverity>('warning')
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState('')
  const [customerCount, setCustomerCount] = useState<number | null>(null)
  const [packageCount, setPackageCount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const trackingPreview = useMemo(() => {
    if (packages.length > 0) {
      return packages.map((pkg) => pkg.tracking_number).slice(0, 8)
    }
    return []
  }, [packages])

  useEffect(() => {
    if (packageIds.length === 0) {
      setPreviewLoading(false)
      setPreviewError('No packages selected')
      return
    }

    setPreviewLoading(true)
    setPreviewError('')
    previewTargetedAnnouncementRecipients({ package_ids: packageIds })
      .then((preview) => {
        setCustomerCount(preview.customer_count)
        setPackageCount(preview.package_count)
      })
      .catch((err) => setPreviewError(getErrorMessage(err)))
      .finally(() => setPreviewLoading(false))
  }, [packageIds])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (packageIds.length === 0) return

    setSubmitting(true)
    setError('')
    try {
      const result = await sendTargetedAnnouncement({
        title: title.trim(),
        body: body.trim(),
        package_ids: packageIds,
        severity,
        channels: ['in_app', 'email'],
        also_show_banner: true,
      })
      onCompleted(
        `Notified ${result.preview.customer_count} customer${result.preview.customer_count === 1 ? '' : 's'} about ${result.preview.package_count} package${result.preview.package_count === 1 ? '' : 's'}.`,
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-boss-gold/15 p-2 text-boss-gold">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold uppercase">Notify affected customers</h2>
            <p className="text-sm text-muted">
              Email and in-app update for selected packages only.
            </p>
          </div>
        </div>

        {previewLoading ? (
          <p className="mb-4 text-sm text-muted">Checking recipients…</p>
        ) : previewError ? (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {previewError}
          </p>
        ) : (
          <p className="mb-4 rounded-lg bg-boss-gold/10 px-3 py-2 text-sm text-boss-gold">
            Will reach {customerCount ?? 0} customer{(customerCount ?? 0) === 1 ? '' : 's'} across{' '}
            {packageCount ?? 0} package{(packageCount ?? 0) === 1 ? '' : 's'}.
          </p>
        )}

        {trackingPreview.length > 0 && (
          <p className="mb-4 text-xs text-muted">
            {trackingPreview.join(', ')}
            {packages.length > trackingPreview.length
              ? ` + ${packages.length - trackingPreview.length} more`
              : ''}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={5}
              maxLength={5000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AnnouncementSeverity)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                previewLoading ||
                Boolean(previewError) ||
                packageIds.length === 0 ||
                (customerCount ?? 0) === 0
              }
            >
              {submitting ? 'Sending…' : 'Send update'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
