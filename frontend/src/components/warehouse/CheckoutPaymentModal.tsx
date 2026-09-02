import { Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { DELIVERY_FEE_JMD } from '../../api/deliveryRequests'
import { openCheckoutBillInvoice, recordCustomerCheckout } from '../../api/staff'
import {
  optionalDeliveryFeeAmount,
  resolveCheckoutDelivery,
} from '../../lib/checkoutDelivery'
import { formatJmd, sumJmd } from '../../lib/money'
import type { DeliveryRequest, Package, PaymentCheckout } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface CheckoutPaymentModalProps {
  shippingId: string
  packages: Package[]
  customerEmail?: string | null
  pendingDeliveryRequests?: DeliveryRequest[]
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
  pendingDeliveryRequests = [],
  onClose,
  onCompleted,
}: CheckoutPaymentModalProps) {
  const [method, setMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [processingFee, setProcessingFee] = useState('')
  const [includeDeliveryFee, setIncludeDeliveryFee] = useState(false)
  const [printInvoice, setPrintInvoice] = useState(true)
  const [emailInvoice, setEmailInvoice] = useState(false)
  const [markDelivered, setMarkDelivered] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const packageIds = useMemo(() => packages.map((pkg) => pkg.id), [packages])
  const delivery = useMemo(
    () => resolveCheckoutDelivery(packageIds, pendingDeliveryRequests),
    [packageIds, pendingDeliveryRequests],
  )

  useEffect(() => {
    if (delivery.isCompleteMatch) {
      setIncludeDeliveryFee(true)
    } else {
      setIncludeDeliveryFee(false)
    }
  }, [delivery.isCompleteMatch, packageIds.join(',')])

  const packagesTotal = sumJmd(packages.map((pkg) => pkg.total_due_jmd))
  const processingFeeAmount = parseOptionalJmd(processingFee) ?? 0
  const deliveryFeeAmount = optionalDeliveryFeeAmount(delivery, includeDeliveryFee)
  const total = useMemo(
    () =>
      packagesTotal +
      (deliveryFeeAmount > 0 ? deliveryFeeAmount : 0) +
      (processingFeeAmount > 0 ? processingFeeAmount : 0),
    [packagesTotal, deliveryFeeAmount, processingFeeAmount],
  )

  const canSubmit = !delivery.isPartialMatch && !delivery.hasMultipleRequests

  async function handleSubmit() {
    if (!canSubmit) {
      setError('Fix delivery selection before recording payment')
      return
    }
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
        package_ids: packageIds,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        processing_fee_jmd: fee,
        include_delivery_fee:
          delivery.requiredDeliveryFee > 0 ? undefined : includeDeliveryFee || undefined,
        email_invoice: emailInvoice,
        mark_delivered: markDelivered,
      })

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

  const extraTrackings = packages
    .filter(
      (pkg) =>
        delivery.matchedRequest &&
        !(delivery.matchedRequest.packages ?? []).some((link) => link.package_id === pkg.id),
    )
    .map((pkg) => pkg.tracking_number)
    .filter(Boolean)

  const missingTrackings =
    delivery.matchedRequest?.packages
      ?.filter((pkg) => delivery.missingPackageIds.includes(pkg.package_id))
      .map((pkg) => pkg.tracking_number)
      .filter(Boolean) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wide">Checkout</h2>
            <p>
              <span className="text-sm text-muted">
                {packages.length} package{packages.length === 1 ? '' : 's'} ·{' '}
              </span>
              <span className="text-xl font-black tabular-nums text-boss-green">
                {formatJmd(total)}
              </span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        {delivery.isCompleteMatch && delivery.matchedRequest ? (
          <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <div>
                <p className="font-semibold text-sky-300">
                  Delivery requested · {delivery.matchedRequest.status_label}
                </p>
                {delivery.matchedRequest.delivery_address?.formatted ? (
                  <p className="mt-1 text-muted">
                    {delivery.matchedRequest.delivery_address.formatted}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted">
                  Delivery fee {formatJmd(delivery.requiredDeliveryFee)} included — all packages in
                  this request must be paid together.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {delivery.isPartialMatch ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
            {delivery.hasMultipleRequests ? (
              <p>Selected packages belong to different delivery requests. Pay each request separately.</p>
            ) : delivery.hasExtraPackages ? (
              <p>
                Deselect packages not in the delivery request
                {extraTrackings.length > 0 ? `: ${extraTrackings.join(', ')}` : ''}, or checkout them
                separately.
              </p>
            ) : (
              <p>
                This customer has a delivery request that includes other packages
                {missingTrackings.length > 0 ? `: ${missingTrackings.join(', ')}` : ''}. Select all
                packages in the request to checkout with the delivery fee.
              </p>
            )}
          </div>
        ) : null}

        {!delivery.isCompleteMatch &&
        !delivery.isPartialMatch &&
        pendingDeliveryRequests.length > 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-background/50 p-3 text-xs text-muted">
            Customer has {pendingDeliveryRequests.length} open delivery request
            {pendingDeliveryRequests.length === 1 ? '' : 's'} not matching this selection.
          </div>
        ) : null}

        <ul className="mt-4 space-y-2 rounded-xl border border-border bg-background/50 p-3 text-sm">
          {packages.map((pkg) => (
            <li key={pkg.id} className="flex items-center justify-between gap-3">
              <span className="font-mono text-boss-gold">{pkg.tracking_number}</span>
              <span className="font-semibold">{formatJmd(pkg.total_due_jmd)}</span>
            </li>
          ))}
          {deliveryFeeAmount > 0 && (
            <li className="flex items-center justify-between gap-3 border-t border-border pt-2 text-muted">
              <span>Delivery fee</span>
              <span className="font-semibold text-foreground">{formatJmd(deliveryFeeAmount)}</span>
            </li>
          )}
          {processingFeeAmount > 0 && (
            <li className="flex items-center justify-between gap-3 border-t border-border pt-2 text-muted">
              <span>Processing fee</span>
              <span className="font-semibold text-foreground">{formatJmd(processingFeeAmount)}</span>
            </li>
          )}
        </ul>

        <div className="mt-4 space-y-3">
          {!delivery.isCompleteMatch && !delivery.isPartialMatch ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background/50 p-3 text-sm">
              <input
                type="checkbox"
                checked={includeDeliveryFee}
                onChange={(e) => setIncludeDeliveryFee(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              <span>
                Include delivery fee ({formatJmd(DELIVERY_FEE_JMD)})
                <span className="mt-0.5 block text-xs text-muted">
                  Add home delivery to this checkout
                </span>
              </span>
            </label>
          ) : null}

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
          <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
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
