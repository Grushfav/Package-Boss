import { useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { openCheckoutBillInvoice, recordCustomerCheckout } from '../../api/staff'
import { formatJmd, sumJmd } from '../../lib/money'
import type { Package, PaymentCheckout } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface CheckoutPaymentModalProps {
  shippingId: string
  packages: Package[]
  onClose: () => void
  onCompleted: (checkout: PaymentCheckout, packageIds: string[]) => void
}

export function CheckoutPaymentModal({
  shippingId,
  packages,
  onClose,
  onCompleted,
}: CheckoutPaymentModalProps) {
  const [method, setMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const total = sumJmd(packages.map((pkg) => pkg.total_due_jmd))

  async function handleSubmit() {
    setError('')
    setLoading(true)
    try {
      const checkout = await recordCustomerCheckout(shippingId, {
        package_ids: packages.map((pkg) => pkg.id),
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onCompleted(checkout, packages.map((pkg) => pkg.id))
      await openCheckoutBillInvoice(checkout.id)
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wide">Checkout</h2>
            <p className="text-sm text-muted">
              {packages.length} package{packages.length === 1 ? '' : 's'} · {formatJmd(total)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <ul className="mt-4 space-y-2 rounded-xl border border-border bg-background/50 p-3 text-sm">
          {packages.map((pkg) => (
            <li key={pkg.id} className="flex items-center justify-between gap-3">
              <span className="font-mono text-boss-gold">{pkg.tracking_number}</span>
              <span className="font-semibold">{formatJmd(pkg.total_due_jmd)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              Payment method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
          </div>

          <Input
            label={method === 'bank_transfer' ? 'Transfer reference' : 'Reference (optional)'}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />

          <Input
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processing…' : 'Record payment & invoice'}
          </Button>
          <Button variant="outline" className="!text-xs" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
