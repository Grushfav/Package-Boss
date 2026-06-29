import { Bell, FileUp } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { createPreAlert } from '../api/preAlerts'
import { useAuth } from '../context/AuthContext'
import { getHomeRoute } from '../lib/routing'
import { uploadInvoice } from '../lib/uploadInvoice'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'

const INVOICE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export function NewPreAlertPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [carrierTracking, setCarrierTracking] = useState('')
  const [merchant, setMerchant] = useState('')
  const [description, setDescription] = useState('')
  const [declaredValue, setDeclaredValue] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [skipInvoice, setSkipInvoice] = useState(false)

  if (user?.role && user.role !== 'customer') {
    return <Navigate to={getHomeRoute(user.role)} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let invoiceKey: string | undefined
      if (invoiceFile && !skipInvoice) {
        invoiceKey = await uploadInvoice(invoiceFile)
      }

      await createPreAlert({
        carrier_tracking: carrierTracking.trim().toUpperCase(),
        invoice_object_key: invoiceKey,
        merchant: merchant || undefined,
        description: description || undefined,
        declared_value_usd: declaredValue ? parseFloat(declaredValue) : undefined,
      })

      navigate('/dashboard/pre-alerts')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-2">
        <Link to="/dashboard/pre-alerts" className="text-sm text-muted hover:text-boss-green">
          ← Dashboard
        </Link>
      </div>

      <div className="mb-8 flex items-center gap-2.5">
        <IconBadge icon={Bell} size="sm" />
        <h1 className="text-2xl font-black uppercase">Pre-Alert Package</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted">
          Tell us a package is on its way to your Fort Lauderdale address. Upload your invoice or receipt
          so we can process it faster when it arrives.
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

          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              Invoice / receipt
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-6 transition-colors hover:border-boss-green">
              <FileUp className="h-5 w-5 text-muted" />
              <span className="text-sm text-muted">
                {invoiceFile ? invoiceFile.name : 'PDF, JPEG, PNG, or WebP'}
              </span>
              <input
                type="file"
                accept={INVOICE_ACCEPT}
                className="hidden"
                disabled={skipInvoice}
                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={skipInvoice}
                onChange={(e) => {
                  setSkipInvoice(e.target.checked)
                  if (e.target.checked) setInvoiceFile(null)
                }}
              />
              Skip invoice for now (requires image upload worker in production)
            </label>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading || !carrierTracking.trim()}>
            {loading ? 'Submitting...' : 'Submit pre-alert'}
          </Button>
        </form>
      </div>
    </div>
  )
}
