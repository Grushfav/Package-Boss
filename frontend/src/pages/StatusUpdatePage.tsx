import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { updatePackageStatus } from '../api/staff'
import { PACKAGE_STATUSES } from '../lib/packageStatuses'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'

export function StatusUpdatePage() {
  const [statusTracking, setStatusTracking] = useState('')
  const [statusValue, setStatusValue] = useState('processing')
  const [statusNote, setStatusNote] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusSuccess, setStatusSuccess] = useState('')
  const [statusError, setStatusError] = useState('')

  async function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault()
    const tracking = statusTracking.trim().toUpperCase()
    if (!tracking) return

    setStatusError('')
    setStatusSuccess('')
    setStatusLoading(true)

    try {
      const updated = await updatePackageStatus(tracking, statusValue, statusNote || undefined)
      setStatusSuccess(`Updated ${updated.tracking_number} to ${updated.status_label}.`)
      setStatusNote('')
    } catch (err) {
      setStatusError(getErrorMessage(err))
    } finally {
      setStatusLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-2">
        <Link to="/warehouse" className="text-sm text-muted hover:text-boss-green">
          ← Warehouse
        </Link>
      </div>
      <div className="mb-8 flex items-center gap-2.5">
        <IconBadge icon={RefreshCw} size="sm" />
        <h1 className="text-2xl font-black uppercase">Update Status</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted">
          Enter a tracking number and set the next shipment status.
        </p>

        <form onSubmit={handleStatusUpdate} className="mt-6 space-y-4">
          <Input
            label="Tracking Number"
            placeholder="PB-2026-000001"
            value={statusTracking}
            onChange={(e) => setStatusTracking(e.target.value.toUpperCase())}
            required
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              Status
            </label>
            <select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-green focus:outline-none focus:ring-1 focus:ring-boss-green"
            >
              {PACKAGE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Note (optional)"
            placeholder="Departed Miami hub, etc."
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
          />
          <Button type="submit" fullWidth disabled={statusLoading || !statusTracking.trim()}>
            {statusLoading ? 'Updating...' : 'Update Status'}
          </Button>
        </form>

        {statusError && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{statusError}</p>
        )}
        {statusSuccess && (
          <p className="mt-4 rounded-lg bg-boss-green/10 px-4 py-3 text-sm text-boss-green">
            {statusSuccess}
          </p>
        )}
      </div>
    </div>
  )
}
