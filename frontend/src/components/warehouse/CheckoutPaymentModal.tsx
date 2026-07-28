import { useMemo, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { openCheckoutBillInvoice, recordCustomerCheckout } from '../../api/staff'
import { formatJmd, sumJmd } from '../../lib/money'
import type { Package, PaymentCheckout } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface CheckoutPaymentModalProps {
  shippingId: string
  packages: Package[]
  customerEmail?: string | null
  onClose: () => void
  onCompleted: (
    checkout: PaymentCheckout,
    packageIds: string[],
    options?: { markDelivered?: boolean },
  ) => void
}

function parseOptionalJmd(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function CheckoutPaymentModal({
  shippingId,
  packages,
  customerEmail,
  onClose,
  onCompleted,
}: CheckoutPaymentModalProps) {
  const [method, setMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [processingFee, setProcessingFee] = useState('')
  const [printInvoice, setPrintInvoice] = useState(true)
  const [emailInvoice, setEmailInvoice] = useState(false)
  const [markDelivered, setMarkDelivered] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const packagesTotal = sumJmd(packages.map((pkg) => pkg.total_due_jmd))
  const processingFeeAmount = parseOptionalJmd(processingFee) ?? 0
  const total = useMemo(
    () => packagesTotal + (processingFeeAmount > 0 ? processingFeeAmount : 0),
    [packagesTotal, processingFeeAmount],
  )

  async function handleSubmit() {
    if (!printInvoice && !emailInvoice) {
      setError('Select print invoice, email invoice, or both')
      return
    }
    if (emailInvoice && !customerEmail) {
      setError('Customer has no email on file — uncheck email invoice or update their profile')
      return
    }

    setError('')
    setLoading(true)
    try {
      const fee = parseOptionalJmd(processingFee)
      if (fee != null && fee < 0) {
        setError('Processing fee cannot be negative')
        return
      }

      const result = await recordCustomerCheckout(shippingId, {
        package_ids: packages.map((pkg) => pkg.id),
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        processing_fee_jmd: fee,
        email_invoice: emailInvoice,
        mark_delivered: markDelivered,
      })

      const packageIds = packages.map((pkg) => pkg.id)
      onCompleted(result.checkout, packageIds, { markDelivered })

      const deliveryIssue =
        markDelivered &&
        ((result.delivery_failed?.length ?? 0) > 0 ||
          (result.delivered_count ?? 0) < packageIds.length)

      if (emailInvoice && !result.email_sent && result.email_error) {
        setError(`Payment recorded, but email failed: ${result.email_error}`)
        if (printInvoice) {
          await openCheckoutBillInvoice(result.checkout.id)
        }
        return
      }

      if (deliveryIssue) {
        const failedMsg = result.delivery_failed?.map((f) => f.error).join('; ')
        setError(
          failedMsg
            ? `Payment recorded, but delivery update failed: ${failedMsg}`
            : 'Payment recorded, but some packages were not marked delivered',
        )
        if (printInvoice) {
          await openCheckoutBillInvoice(result.checkout.id)
        }
        return
      }

      if (printInvoice) {
        await openCheckoutBillInvoice(result.checkout.id)
      }

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
          {processingFeeAmount > 0 && (
            <li className="flex items-center justify-between gap-3 border-t border-border pt-2 text-muted">
              <span>Processing fee</span>
              <span className="font-semibold text-foreground">{formatJmd(processingFeeAmount)}</span>
            </li>
          )}
        </ul>

        <div className="mt-4 space-y-3">
          <Input
            label="Processing fee (JMD, optional)"
            type="number"
            step="1"
            min="0"
            value={processingFee}
            onChange={(e) => setProcessingFee(e.target.value)}
          />

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

          <div className="space-y-2 rounded-xl border border-border bg-background/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              When complete
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={printInvoice}
                onChange={(e) => setPrintInvoice(e.target.checked)}
                className="rounded border-border"
              />
              Print invoice
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={emailInvoice}
                onChange={(e) => setEmailInvoice(e.target.checked)}
                className="rounded border-border"
              />
              Email invoice to customer
              {customerEmail ? (
                <span className="text-xs text-muted">({customerEmail})</span>
              ) : (
                <span className="text-xs text-amber-500">(no email on file)</span>
              )}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={markDelivered}
                onChange={(e) => setMarkDelivered(e.target.checked)}
                className="rounded border-border"
              />
              Mark as delivered
            </label>
          </div>
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
