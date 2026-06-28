import { useEffect, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import {
  fetchCustomerDeliveryAddresses,
  releasePackagesFromCustoms,
  requestPackageInvoice,
  setPackageDeliveryAddress,
  updatePackageBilling,
} from '../../api/staff'
import { formatJmd } from '../../lib/money'
import { packageHasAdditionalFees } from '../../lib/packageBilling'
import { RecordPaymentForm } from './RecordPaymentForm'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { DeliveryAddress, Package } from '../../types'

interface PackageStaffModalProps {
  pkg: Package
  onClose: () => void
  onUpdated: (pkg: Package) => void
}

export function PackageStaffModal({ pkg, onClose, onUpdated }: PackageStaffModalProps) {
  const [tab, setTab] = useState<'invoice' | 'billing' | 'payment' | 'delivery'>('invoice')
  const [note, setNote] = useState('')
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('email')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [billing, setBilling] = useState({
    estimated_freight_jmd: pkg.estimated_freight_jmd?.toString() ?? '',
    duties_jmd: pkg.duties_jmd?.toString() ?? '',
    handling_jmd: pkg.handling_jmd?.toString() ?? '',
    other_fees_jmd: pkg.other_fees_jmd?.toString() ?? '',
    declared_value_usd: pkg.declared_value_usd?.toString() ?? '',
  })
  const [showExtraFees, setShowExtraFees] = useState(packageHasAdditionalFees(pkg))

  useEffect(() => {
    if (pkg.customer?.shipping_id) {
      fetchCustomerDeliveryAddresses(pkg.customer.shipping_id)
        .then(setAddresses)
        .catch(() => setAddresses([]))
    }
  }, [pkg.customer?.shipping_id])

  const [success, setSuccess] = useState('')

  async function handleRequestInvoice() {
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const result = await requestPackageInvoice(pkg.id, { channel, note: note || undefined })
      onUpdated(result.package)
      setNote('')
      const parts: string[] = []
      if (result.channels_sent.includes('email') && result.email_recipient) {
        parts.push(`Email sent to ${result.email_recipient}`)
      }
      if (result.channels_sent.includes('whatsapp')) {
        parts.push('WhatsApp notification sent')
      }
      setSuccess(parts.join(' · ') || 'Invoice request sent')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveBilling(publish: boolean) {
    setError('')
    setLoading(true)
    try {
      const parse = (v: string) => (v.trim() ? parseFloat(v) : undefined)
      const updated = await updatePackageBilling(pkg.id, {
        estimated_freight_jmd: parse(billing.estimated_freight_jmd),
        duties_jmd: parse(billing.duties_jmd),
        handling_jmd: parse(billing.handling_jmd),
        other_fees_jmd: parse(billing.other_fees_jmd),
        declared_value_usd: parse(billing.declared_value_usd),
        publish,
      })
      onUpdated(updated)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDeliveryAddress(addressId: string) {
    setError('')
    setLoading(true)
    try {
      const updated = await setPackageDeliveryAddress(pkg.id, addressId)
      onUpdated(updated)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'invoice' as const, label: 'Invoice' },
    { id: 'billing' as const, label: 'Billing' },
    { id: 'payment' as const, label: 'Payment' },
    { id: 'delivery' as const, label: 'Delivery' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-mono font-bold text-boss-green">{pkg.tracking_number}</h2>
            <p className="text-sm text-muted">
              {pkg.invoice_status_label} · {pkg.billing_status_label}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="mt-4 flex gap-2 border-b border-border pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase ${
                tab === t.id
                  ? 'bg-boss-green/15 text-boss-green'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {success && (
          <p className="mt-3 rounded-lg bg-boss-green/10 px-3 py-2 text-sm text-boss-green">
            {success}
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        {tab === 'invoice' && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted">
            Send the customer a link to upload their invoice/receipt by email or WhatsApp.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="both">Both</option>
              </select>
            </div>
            <Input
              label="Note to customer (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Customs needs your receipt for duties assessment"
            />
            {pkg.invoice_url && (
              <a
                href={pkg.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-boss-green hover:underline"
              >
                View uploaded invoice
              </a>
            )}
            <Button onClick={handleRequestInvoice} disabled={loading}>
              {loading ? 'Sending...' : pkg.invoice_status === 'requested' ? 'Resend request' : 'Request invoice'}
            </Button>
            {pkg.customer?.email && (
              <p className="text-xs text-muted">Customer email: {pkg.customer.email}</p>
            )}
          </div>
        )}

        {tab === 'billing' && (
          <div className="mt-4 space-y-3">
            {pkg.status === 'customs' ? (
              <>
                <p className="text-sm text-muted">
                  Release from customs to auto-calculate shipping from weight and publish the bill.
                  Add optional duties or fees below.
                </p>
                <Input
                  label="Duties (JMD)"
                  type="number"
                  step="1"
                  value={billing.duties_jmd}
                  onChange={(e) => setBilling({ ...billing, duties_jmd: e.target.value })}
                />
                <Input
                  label="Handling (JMD)"
                  type="number"
                  step="1"
                  value={billing.handling_jmd}
                  onChange={(e) => setBilling({ ...billing, handling_jmd: e.target.value })}
                />
                <Input
                  label="Other fees (JMD)"
                  type="number"
                  step="1"
                  value={billing.other_fees_jmd}
                  onChange={(e) => setBilling({ ...billing, other_fees_jmd: e.target.value })}
                />
                <Button
                  onClick={async () => {
                    setError('')
                    setLoading(true)
                    try {
                      const parse = (v: string) => (v.trim() ? parseFloat(v) : undefined)
                      const result = await releasePackagesFromCustoms({
                        items: [
                          {
                            package_id: pkg.id,
                            duties_jmd: parse(billing.duties_jmd),
                            handling_jmd: parse(billing.handling_jmd),
                            other_fees_jmd: parse(billing.other_fees_jmd),
                          },
                        ],
                      })
                      if (result.packages[0]) {
                        onUpdated(result.packages[0])
                        setSuccess('Released from customs — bill published')
                      }
                    } catch (err) {
                      setError(getErrorMessage(err))
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? 'Releasing…' : 'Release & publish bill'}
                </Button>
              </>
            ) : pkg.status === 'ready_for_pickup' ? (
              <>
                <p className="text-sm text-muted">
                  Adjust amounts if needed after release. Republish to update the customer bill.
                </p>
                <Input
                  label="Shipping (JMD)"
                  type="number"
                  step="1"
                  value={billing.estimated_freight_jmd}
                  onChange={(e) => setBilling({ ...billing, estimated_freight_jmd: e.target.value })}
                />
                {!showExtraFees ? (
                  <button
                    type="button"
                    onClick={() => setShowExtraFees(true)}
                    className="text-xs font-semibold text-boss-green hover:underline"
                  >
                    + Add duties, handling, or other fees
                  </button>
                ) : (
                  <>
                    <Input
                      label="Duties (JMD)"
                      type="number"
                      step="1"
                      value={billing.duties_jmd}
                      onChange={(e) => setBilling({ ...billing, duties_jmd: e.target.value })}
                    />
                    <Input
                      label="Handling (JMD)"
                      type="number"
                      step="1"
                      value={billing.handling_jmd}
                      onChange={(e) => setBilling({ ...billing, handling_jmd: e.target.value })}
                    />
                    <Input
                      label="Other fees (JMD)"
                      type="number"
                      step="1"
                      value={billing.other_fees_jmd}
                      onChange={(e) => setBilling({ ...billing, other_fees_jmd: e.target.value })}
                    />
                    <Input
                      label="Declared value (USD, from receipt)"
                      type="number"
                      step="0.01"
                      value={billing.declared_value_usd}
                      onChange={(e) => setBilling({ ...billing, declared_value_usd: e.target.value })}
                    />
                  </>
                )}
                {pkg.total_due_jmd != null && (
                  <p className="text-sm font-semibold">
                    Total: {formatJmd(pkg.total_due_jmd)} ({pkg.billing_status_label})
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleSaveBilling(false)} disabled={loading}>
                    Save draft
                  </Button>
                  {pkg.billing_status !== 'paid' && (
                    <Button onClick={() => handleSaveBilling(true)} disabled={loading}>
                      Update bill
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  The bill is published automatically when this package is released from customs and
                  marked ready for pickup.
                </p>
                {pkg.billing_status_label && (
                  <p className="text-xs text-muted">Current billing: {pkg.billing_status_label}</p>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'payment' && (
          <div className="mt-4">
            <RecordPaymentForm
              pkg={pkg}
              onCompleted={(updated, payment) => {
                onUpdated({ ...updated, payment })
                setSuccess('Payment recorded — invoice opened for printing')
              }}
            />
          </div>
        )}

        {tab === 'delivery' && (
          <div className="mt-4 space-y-3">
            {addresses.length === 0 ? (
              <p className="text-sm text-muted">Customer has no saved delivery addresses.</p>
            ) : (
              addresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => handleDeliveryAddress(addr.id)}
                  disabled={loading}
                  className={`w-full rounded-xl border p-4 text-left text-sm transition-colors ${
                    pkg.delivery_address_id === addr.id
                      ? 'border-boss-green bg-boss-green/10'
                      : 'border-border hover:border-boss-green/40'
                  }`}
                >
                  <p className="font-semibold">{addr.label}</p>
                  <p className="mt-1 text-muted">{addr.formatted}</p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
