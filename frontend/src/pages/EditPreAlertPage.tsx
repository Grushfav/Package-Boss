import { Bell, FileUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { deletePreAlert, fetchPreAlert, updatePreAlert } from '../api/preAlerts'
import { useAuth } from '../context/AuthContext'
import { useCustomerData } from '../context/CustomerDataContext'
import { getHomeRoute } from '../lib/routing'
import { uploadInvoice } from '../lib/uploadInvoice'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import type { PreAlert } from '../types'

const INVOICE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export function EditPreAlertPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshPreAlerts } = useCustomerData()

  const [preAlert, setPreAlert] = useState<PreAlert | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadingPreAlert, setLoadingPreAlert] = useState(true)

  const [carrierTracking, setCarrierTracking] = useState('')
  const [merchant, setMerchant] = useState('')
  const [description, setDescription] = useState('')
  const [declaredValue, setDeclaredValue] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [removeInvoice, setRemoveInvoice] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoadingPreAlert(true)
    setLoadError('')
    fetchPreAlert(id)
      .then((alert) => {
        if (alert.status !== 'pending') {
          setLoadError('Only pending pre-alerts can be edited.')
          return
        }
        setPreAlert(alert)
        setCarrierTracking(alert.carrier_tracking)
        setMerchant(alert.merchant ?? '')
        setDescription(alert.description ?? '')
        setDeclaredValue(
          alert.declared_value_usd != null ? String(alert.declared_value_usd) : '',
        )
      })
      .catch((err) => setLoadError(getErrorMessage(err)))
      .finally(() => setLoadingPreAlert(false))
  }, [id])

  if (user?.role && user.role !== 'customer') {
    return <Navigate to={getHomeRoute(user.role)} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !preAlert) return

    setError('')
    setLoading(true)

    try {
      const payload: Parameters<typeof updatePreAlert>[1] = {
        carrier_tracking: carrierTracking.trim().toUpperCase(),
        merchant: merchant.trim() || null,
        description: description.trim() || null,
        declared_value_usd: declaredValue ? parseFloat(declaredValue) : null,
      }

      if (removeInvoice) {
        payload.invoice_object_key = null
      } else if (invoiceFile) {
        payload.invoice_object_key = await uploadInvoice(invoiceFile)
      }

      await updatePreAlert(id, payload)
      await refreshPreAlerts()
      navigate('/dashboard/pre-alerts')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!id || !preAlert) return
    if (!window.confirm(`Delete pre-alert for ${preAlert.carrier_tracking}?`)) return

    setError('')
    setDeleting(true)
    try {
      await deletePreAlert(id)
      await refreshPreAlerts()
      navigate('/dashboard/pre-alerts')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  if (!id) {
    return <Navigate to="/dashboard/pre-alerts" replace />
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-2">
        <Link to="/dashboard/pre-alerts" className="text-sm text-muted hover:text-boss-gold">
          ← Pre-alerts
        </Link>
      </div>

      <div className="mb-8 flex items-center gap-2.5">
        <IconBadge icon={Bell} size="sm" />
        <h1 className="text-2xl font-black uppercase">Edit Pre-Alert</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        {loadingPreAlert ? (
          <p className="text-sm text-muted">Loading pre-alert…</p>
        ) : loadError ? (
          <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{loadError}</p>
        ) : !preAlert ? (
          <p className="text-sm text-muted">Pre-alert not found.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Update tracking, store details, or invoice before your package is received.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Input
                label="Carrier tracking number"
                placeholder="USPS / UPS / Amazon tracking"
                value={carrierTracking}
                onChange={(e) => setCarrierTracking(e.target.value.toUpperCase())}
                required
              />
              <Input
                label="Store / merchant (optional)"
                placeholder="Amazon, Shein, etc."
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
              <Input
                label="Item description (optional)"
                placeholder="Shoes, electronics, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Input
                label="Declared value USD (optional)"
                type="number"
                step="0.01"
                min="0"
                placeholder="49.99"
                value={declaredValue}
                onChange={(e) => setDeclaredValue(e.target.value)}
              />

              <div className="space-y-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                  Invoice / receipt (optional)
                </label>
                {preAlert.invoice_url && !removeInvoice && !invoiceFile && (
                  <a
                    href={preAlert.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm font-semibold text-boss-gold hover:underline"
                  >
                    View current invoice
                  </a>
                )}
                {preAlert.invoice_url && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={removeInvoice}
                      onChange={(e) => {
                        setRemoveInvoice(e.target.checked)
                        if (e.target.checked) setInvoiceFile(null)
                      }}
                      className="h-4 w-4 rounded border-border accent-boss-gold"
                    />
                    Remove current invoice
                  </label>
                )}
                {!removeInvoice && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-6 transition-colors hover:border-boss-gold">
                    <FileUp className="h-5 w-5 text-muted" />
                    <span className="text-sm text-muted">
                      {invoiceFile
                        ? invoiceFile.name
                        : preAlert.invoice_url
                          ? 'Replace invoice (PDF, JPEG, PNG, or WebP)'
                          : 'PDF, JPEG, PNG, or WebP'}
                    </span>
                    <input
                      type="file"
                      accept={INVOICE_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        setInvoiceFile(e.target.files?.[0] || null)
                        setRemoveInvoice(false)
                      }}
                    />
                  </label>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
              )}

              <Button type="submit" fullWidth disabled={loading || deleting || !carrierTracking.trim()}>
                {loading ? 'Saving…' : 'Save changes'}
              </Button>

              <Button
                type="button"
                variant="outline"
                fullWidth
                disabled={loading || deleting}
                onClick={handleDelete}
                className="!border-red-500/40 !text-red-400 hover:!bg-red-500/10"
              >
                {deleting ? 'Deleting…' : 'Delete pre-alert'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
