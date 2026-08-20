import { Pencil, Printer, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { fetchShippers, updatePackageReceiveDetails } from '../../api/staff'
import { MAX_RECEIVE_LBS } from '../../lib/warehouseConstants'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { Package, Shipper, StaffCustomer } from '../../types'
import { ShippingLabel } from './ShippingLabel'

const LABEL_EDITABLE_STATUSES = new Set(['received', 'unidentified', 'in_transit'])

interface EditLabelModalProps {
  pkg: Package
  customer: StaffCustomer | null
  onClose: () => void
  onSaved: (pkg: Package, options?: { reprint?: boolean }) => void
}

function labelCustomer(pkg: Package): StaffCustomer | null {
  if (!pkg.customer) return null
  return {
    id: pkg.customer.id,
    full_name: pkg.customer.full_name,
    shipping_id: pkg.customer.shipping_id,
    parish: pkg.customer.parish ?? '',
    email: '',
    contact_number: '',
  }
}

export function EditLabelModal({ pkg, customer, onClose, onSaved }: EditLabelModalProps) {
  const isUnidentified = pkg.status === 'unidentified' || pkg.is_unidentified
  const canEdit = LABEL_EDITABLE_STATUSES.has(pkg.status)

  const [shippers, setShippers] = useState<Shipper[]>([])
  const [weight, setWeight] = useState(String(pkg.actual_weight_lbs ?? pkg.billable_weight_lbs ?? ''))
  const [shipper, setShipper] = useState(pkg.shipper ?? 'usps')
  const [carrierTracking, setCarrierTracking] = useState(pkg.carrier_tracking ?? '')
  const [labelName, setLabelName] = useState(pkg.label_name ?? '')
  const [labelBossId, setLabelBossId] = useState(pkg.label_boss_id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchShippers()
      .then(setShippers)
      .catch(() => setShippers([]))
  }, [])

  const previewPackage = useMemo<Package>(() => {
    const parsedWeight = Number.parseFloat(weight)
    const billable =
      Number.isFinite(parsedWeight) && parsedWeight > 0 ? Math.ceil(parsedWeight) : pkg.billable_weight_lbs
    const shipperOption = shippers.find((item) => item.code === shipper)

    return {
      ...pkg,
      actual_weight_lbs: Number.isFinite(parsedWeight) ? parsedWeight : pkg.actual_weight_lbs,
      billable_weight_lbs: billable ?? pkg.billable_weight_lbs,
      shipper,
      shipper_label: shipperOption?.label ?? pkg.shipper_label,
      carrier_tracking: carrierTracking.trim() || null,
      label_name: labelName.trim() || null,
      label_boss_id: labelBossId.trim().toUpperCase() || null,
    }
  }, [carrierTracking, labelBossId, labelName, pkg, shipper, shippers, weight])

  async function handleSave(reprint: boolean) {
    setError('')
    const parsedWeight = Number.parseFloat(weight)
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setError('Enter a valid weight in lbs.')
      return
    }
    if (parsedWeight > MAX_RECEIVE_LBS) {
      setError(`Weight cannot exceed ${MAX_RECEIVE_LBS} lbs.`)
      return
    }
    if (!shipper) {
      setError('Select a shipper.')
      return
    }
    if (!isUnidentified && !carrierTracking.trim()) {
      setError('Carrier tracking is required for identified packages.')
      return
    }
    if (isUnidentified && !carrierTracking.trim() && !labelName.trim() && !labelBossId.trim()) {
      setError('Provide carrier tracking, label name, or BOSS ID.')
      return
    }

    setLoading(true)
    try {
      const updated = await updatePackageReceiveDetails(pkg.id, {
        actual_weight_lbs: parsedWeight,
        shipper,
        carrier_tracking: carrierTracking.trim(),
        ...(isUnidentified
          ? {
              label_name: labelName.trim(),
              label_boss_id: labelBossId.trim().toUpperCase(),
            }
          : {}),
        requeue_print: reprint,
      })
      onSaved(updated, { reprint })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
              <Pencil className="h-4 w-4 text-boss-gold" />
              Edit label
            </p>
            <p className="font-mono text-xs text-muted">{pkg.tracking_number}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!canEdit ? (
          <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            This package is {pkg.status_label.toLowerCase()} — label details can only be edited while
            received, unidentified, or in transit.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Weight (lbs)</span>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Shipper</span>
                <select
                  value={shipper}
                  onChange={(e) => setShipper(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {shippers.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Carrier tracking</span>
                <Input
                  value={carrierTracking}
                  onChange={(e) => setCarrierTracking(e.target.value)}
                  placeholder={isUnidentified ? 'Optional if name or BOSS ID set' : 'Required'}
                />
              </label>

              {isUnidentified && (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Label name</span>
                    <Input value={labelName} onChange={(e) => setLabelName(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">BOSS ID on label</span>
                    <Input
                      value={labelBossId}
                      onChange={(e) => setLabelBossId(e.target.value.toUpperCase())}
                      placeholder="BOSS-12345"
                    />
                  </label>
                </>
              )}

              <p className="text-xs text-muted">
                Saving updates the package record. Use Save &amp; reprint to print a corrected label.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
              <div className="shipping-label-screen-scale">
                <ShippingLabel
                  pkg={previewPackage}
                  customer={customer ?? labelCustomer(previewPackage)}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button type="button" disabled={loading} onClick={() => void handleSave(false)}>
                Save changes
              </Button>
              <Button
                type="button"
                disabled={loading}
                className="inline-flex items-center gap-2"
                onClick={() => void handleSave(true)}
              >
                <Printer className="h-4 w-4" />
                Save &amp; reprint
              </Button>
            </>
          )}
          <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
