import { FileUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { fetchMyPackage, submitPackageInvoice } from '../api/packages'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { uploadPackageInvoice } from '../lib/uploadPackageInvoice'
import type { Package } from '../types'

export function PackageInvoiceUploadPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const [pkg, setPkg] = useState<Package | null>(null)
  const [declaredValue, setDeclaredValue] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [skipUpload, setSkipUpload] = useState(false)

  useEffect(() => {
    if (!packageId) return
    fetchMyPackage(packageId)
      .then(setPkg)
      .catch(() => setError('Package not found'))
  }, [packageId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!packageId) return
    setError('')
    setLoading(true)
    try {
      let invoiceKey: string | undefined
      if (invoiceFile && !skipUpload) {
        invoiceKey = await uploadPackageInvoice(packageId, invoiceFile)
      }
      if (!invoiceKey) {
        setError('Please select an invoice file to upload')
        return
      }
      await submitPackageInvoice(packageId, {
        invoice_object_key: invoiceKey,
        declared_value_usd: declaredValue ? parseFloat(declaredValue) : undefined,
      })
      navigate('/dashboard/packages')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (!pkg && !error) {
    return <p className="px-4 py-12 text-center text-muted">Loading...</p>
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={FileUp} size="sm" />
        <h1 className="text-2xl font-black uppercase">Upload Invoice</h1>
      </div>

      {pkg && (
        <p className="text-sm text-muted">
          Package <span className="font-mono font-bold text-foreground">{pkg.tracking_number}</span>
          {pkg.invoice_request_note && (
            <span className="mt-2 block rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
              {pkg.invoice_request_note}
            </span>
          )}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="Declared value (USD)"
          type="number"
          min="0"
          step="0.01"
          placeholder="99.99"
          value={declaredValue}
          onChange={(e) => setDeclaredValue(e.target.value)}
        />
        <p className="text-xs text-muted">
          Items over $100 USD may incur customs duties and additional charges.
        </p>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Invoice or receipt
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-6 hover:border-boss-green/40">
            <FileUp className="h-5 w-5 text-muted" />
            <span className="text-sm text-muted">
              {invoiceFile ? invoiceFile.name : 'PDF, JPEG, PNG, or WebP'}
            </span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              className="sr-only"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={skipUpload}
            onChange={(e) => setSkipUpload(e.target.checked)}
            className="rounded border-border"
          />
          Skip upload (dev only — requires file storage in production)
        </label>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Uploading...' : 'Submit invoice'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/dashboard/packages')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
