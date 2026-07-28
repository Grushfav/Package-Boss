import { Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  fetchCustomerEmailNotificationSettings,
  updateCustomerEmailNotificationSettings,
} from '../../api/admin'
import { getErrorMessage } from '../../api/client'

export function CustomerEmailNotificationsPanel() {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCustomerEmailNotificationSettings()
      .then((settings) => setEnabled(settings.customer_email_notifications_enabled))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle() {
    const next = !enabled
    setSaving(true)
    setError('')
    try {
      const settings = await updateCustomerEmailNotificationSettings(next)
      setEnabled(settings.customer_email_notifications_enabled)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-boss-green/10 text-boss-green">
            <Mail className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-bold uppercase tracking-wide">Customer email notifications</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Controls automated customer emails for package status updates, invoice requests, and
              announcement broadcasts. Welcome emails, password resets, and clerk invites are not
              affected.
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <span className="text-sm font-semibold">{enabled ? 'On' : 'Off'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={loading || saving}
            onClick={() => void handleToggle()}
            className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${
              enabled ? 'bg-boss-green' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                enabled ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  )
}
