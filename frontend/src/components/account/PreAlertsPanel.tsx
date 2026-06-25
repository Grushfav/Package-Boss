import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getErrorMessage } from '../../api/client'
import { cancelPreAlert, fetchMyPreAlerts } from '../../api/preAlerts'
import type { PreAlert } from '../../types'

export function PreAlertsPanel() {
  const [preAlerts, setPreAlerts] = useState<PreAlert[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMyPreAlerts()
      .then(setPreAlerts)
      .catch(() => setPreAlerts([]))
  }, [])

  async function handleCancel(id: string) {
    setError('')
    try {
      await cancelPreAlert(id)
      setPreAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const active = preAlerts.filter((a) => a.status !== 'cancelled')

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wide">Pre-Alerts</h2>
          <p className="mt-2 text-sm text-muted">
            Submit tracking and invoice before your package reaches Miami.
          </p>
        </div>
        <Link
          to="/pre-alerts/new"
          className="inline-flex items-center gap-2 rounded-lg border border-boss-green/30 bg-boss-green/10 px-4 py-2 text-sm font-semibold text-boss-green hover:bg-boss-green/20"
        >
          <Bell className="h-4 w-4" />
          Pre-alert a package
        </Link>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {active.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
          No pre-alerts yet. Add one when you order online using your Miami address.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {active.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-sm font-bold">{alert.carrier_tracking}</p>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">
                  {alert.status_label}
                </span>
              </div>
              {alert.merchant && <p className="mt-2 text-sm text-muted">{alert.merchant}</p>}
              {alert.description && <p className="mt-1 text-sm text-muted">{alert.description}</p>}
              <div className="mt-3 flex flex-wrap gap-3">
                {alert.invoice_url && (
                  <a
                    href={alert.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-boss-green hover:underline"
                  >
                    View invoice
                  </a>
                )}
                {alert.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleCancel(alert.id)}
                    className="text-sm text-muted hover:text-red-400"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
