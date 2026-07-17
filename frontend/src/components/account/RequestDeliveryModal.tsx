import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../../api/client'
import { createDeliveryRequest, DELIVERY_FEE_JMD } from '../../api/deliveryRequests'
import { useCustomerData } from '../../context/CustomerDataContext'
import { formatPackageCost } from '../../lib/packageBilling'
import { formatJmd, sumJmd } from '../../lib/money'
import type { Package } from '../../types'
import { Button } from '../ui/Button'

interface RequestDeliveryModalProps {
  packages: Package[]
  onClose: () => void
  onSubmitted: () => void
}

export function RequestDeliveryModal({
  packages,
  onClose,
  onSubmitted,
}: RequestDeliveryModalProps) {
  const { deliveryAddresses, refreshPackages } = useCustomerData()
  const [addressId, setAddressId] = useState(
    () => deliveryAddresses.find((addr) => addr.is_default)?.id ?? deliveryAddresses[0]?.id ?? '',
  )
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const packagesTotal = sumJmd(packages.map((pkg) => pkg.total_due_jmd))
  const totalWithDelivery = packagesTotal + DELIVERY_FEE_JMD

  const packageSummary = useMemo(
    () => packages.map((pkg) => pkg.tracking_number).join(', '),
    [packages],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!addressId) {
      setError('Choose a delivery address')
      return
    }

    setLoading(true)
    try {
      await createDeliveryRequest({
        package_ids: packages.map((pkg) => pkg.id),
        delivery_address_id: addressId,
        notes: notes.trim() || undefined,
      })
      await refreshPackages()
      onSubmitted()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold uppercase tracking-wide">Request delivery</h3>
            <p className="mt-1 text-sm text-muted">
              {packages.length} package{packages.length === 1 ? '' : 's'} · one delivery fee applies
              to the whole request.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-background hover:text-foreground"
          >
            Close
          </button>
        </div>

        {deliveryAddresses.length === 0 ? (
          <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              Add a delivery address first
            </p>
            <p className="mt-1 text-muted">
              Delivery is available in Kingston, St. Andrew, and St. Catherine.
            </p>
            <Link
              to="/dashboard/profile"
              className="mt-3 inline-block text-sm font-semibold text-boss-gold hover:underline"
            >
              Manage delivery addresses →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Packages</p>
              <p className="mt-1 font-mono text-sm text-foreground">{packageSummary}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Deliver to
              </p>
              {deliveryAddresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition-colors ${
                    addressId === addr.id
                      ? 'border-boss-gold bg-boss-gold/10'
                      : 'border-border hover:border-boss-gold/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery-address"
                    value={addr.id}
                    checked={addressId === addr.id}
                    onChange={() => setAddressId(addr.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold">{addr.label}</span>
                    <span className="mt-1 block text-muted">{addr.formatted}</span>
                  </span>
                </label>
              ))}
            </div>

            <div>
              <label
                htmlFor="delivery-notes"
                className="text-xs font-semibold uppercase tracking-wider text-muted"
              >
                Notes (optional)
              </label>
              <textarea
                id="delivery-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="Gate code, landmarks, best time to call…"
              />
            </div>

            <div className="rounded-xl border border-border bg-background/60 p-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Package bills</span>
                <span>{packagesTotal > 0 ? formatJmd(packagesTotal) : 'Bill pending'}</span>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-muted">Delivery fee</span>
                <span>{formatJmd(DELIVERY_FEE_JMD)}</span>
              </div>
              <div className="mt-3 flex justify-between gap-3 border-t border-border pt-3 font-semibold">
                <span>Estimated total</span>
                <span className="text-boss-gold">
                  {packagesTotal > 0 ? formatJmd(totalWithDelivery) : `${formatJmd(DELIVERY_FEE_JMD)} + bills`}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                You can pay after requesting delivery. Unpaid package bills show as pending above.
              </p>
              {packages.some((pkg) => !formatPackageCost(pkg, { customer: true })) && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Some selected packages do not have a published bill yet.
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Submitting…' : 'Submit delivery request'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
