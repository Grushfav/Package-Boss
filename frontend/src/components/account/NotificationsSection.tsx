import { useEffect, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { updateProfile } from '../../api/profile'
import { useAuth } from '../../context/AuthContext'

export function NotificationsSection() {
  const { user, refreshUser } = useAuth()
  const [whatsappOptIn, setWhatsappOptIn] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setWhatsappOptIn(user?.whatsapp_opt_in ?? false)
  }, [user?.whatsapp_opt_in])

  async function handleWhatsappToggle(checked: boolean) {
    setWhatsappOptIn(checked)
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await updateProfile({ whatsapp_opt_in: checked })
      await refreshUser()
      setSuccess('Notification preferences updated')
    } catch (err) {
      setWhatsappOptIn(!checked)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold uppercase tracking-wide">Notifications</h2>
      <p className="mt-2 text-sm text-muted">
        Choose how Package Boss keeps you updated about invoices, arrivals, and delivery.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}
      {success && (
        <p className="mt-3 rounded-lg bg-boss-green/10 px-4 py-2 text-sm text-boss-green">
          {success}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Email</p>
              <p className="mt-1 text-sm text-muted">
                Transactional emails to <span className="text-foreground">{user?.email}</span>{' '}
                — welcome messages, invoice requests, and package status updates.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-boss-green/15 px-2.5 py-1 text-xs font-semibold text-boss-green">
              Always on
            </span>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-5">
          <input
            type="checkbox"
            checked={whatsappOptIn}
            disabled={loading}
            onChange={(e) => handleWhatsappToggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-boss-green"
          />
          <div>
            <p className="font-semibold">WhatsApp</p>
            <p className="mt-1 text-sm text-muted">
              Receive invoice requests and important shipment updates on WhatsApp at{' '}
              <span className="text-foreground">{user?.contact_number}</span>.
            </p>
          </div>
        </label>
      </div>
    </div>
  )
}
