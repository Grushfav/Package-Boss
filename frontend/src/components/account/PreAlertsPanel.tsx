import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getErrorMessage } from '../../api/client'
import { deletePreAlert } from '../../api/preAlerts'
import { useCustomerData } from '../../context/CustomerDataContext'

export function PreAlertsPanel() {
  const { preAlerts, preAlertsLoading, refreshPreAlerts } = useCustomerData()
  const [error, setError] = useState('')

  async function handleDelete(id: string, tracking: string) {
    if (!window.confirm(`Delete pre-alert for ${tracking}?`)) return
    setError('')
    try {
      await deletePreAlert(id)
      await refreshPreAlerts()
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
            Submit tracking number. You can edit pending pre-alerts before they are received.
          </p>
        </div>
        <Link
          to="/pre-alerts/new"
          className="inline-flex items-center gap-2 rounded-lg border border-boss-gold/30 bg-boss-gold/10 px-4 py-2 text-sm font-semibold text-boss-gold hover:bg-boss-gold/20"
        >
          <Bell className="h-4 w-4" />
          Pre-alert a package
        </Link>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {preAlertsLoading && active.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
          Loading pre-alerts...
        </p>
      ) : active.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
          No pre-alerts yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {active.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-mono font-bold">{alert.carrier_tracking}</span>
                  {alert.merchant_label || alert.merchant ? (
                    <>
                      <span className="text-muted" aria-hidden>
                        ·
                      </span>
                      <span className="text-muted">{alert.merchant_label || alert.merchant}</span>
                    </>
                  ) : null}
                  {alert.description && (
                    <>
                      <span className="text-muted" aria-hidden>
                        ·
                      </span>
                      <span className="text-muted">{alert.description}</span>
                    </>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                  {alert.status_label}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {alert.invoice_url && (
                  <a
                    href={alert.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-boss-gold hover:underline"
                  >
                    View invoice
                  </a>
                )}
                {alert.status === 'pending' && (
                  <>
                    <Link
                      to={`/pre-alerts/${alert.id}/edit`}
                      className="text-sm font-semibold text-boss-gold hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(alert.id, alert.carrier_tracking)}
                      className="text-sm text-muted hover:text-red-400"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
