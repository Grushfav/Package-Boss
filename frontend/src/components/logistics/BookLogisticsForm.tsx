import { Banknote, Bike, Car, Clock, CreditCard, Truck, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../../api/client'
import {
  createLogisticsJob,
  estimateLogisticsFee,
  LOGISTICS_DELIVERY_SPEEDS,
  LOGISTICS_ITEM_CATEGORIES,
  LOGISTICS_PAYMENT_METHODS,
  LOGISTICS_VEHICLE_TYPES,
  type InlineAddressPayload,
  type LogisticsDeliverySpeed,
  type LogisticsPaymentMethod,
  type LogisticsVehicleType,
} from '../../api/logisticsJobs'
import { useAuth } from '../../context/AuthContext'
import { useCustomerData } from '../../context/CustomerDataContext'
import { formatJmd } from '../../lib/money'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import {
  emptyInlineAddress,
  LogisticsAddressFields,
  type InlineAddressFormValues,
} from './LogisticsAddressFields'

type AddressMode = 'saved' | 'new'

const VEHICLE_OPTION_DETAILS: Record<
  LogisticsVehicleType,
  { icon: typeof Bike; description: string }
> = {
  bike: {
    icon: Bike,
    description: 'Small items up to 10 lbs',
  },
  car: {
    icon: Car,
    description: '10 lbs and above',
  },
  truck: {
    icon: Truck,
    description: 'Heavy or bulk — we confirm pricing',
  },
}

function inlinePayload(values: InlineAddressFormValues, fallbackLabel: string): InlineAddressPayload {
  return {
    label: values.label.trim() || fallbackLabel,
    recipient_name: values.recipient_name.trim() || undefined,
    line1: values.line1.trim(),
    line2: values.line2.trim() || undefined,
    community: values.community.trim() || undefined,
    parish: values.parish,
    contact_number: values.contact_number.trim(),
    delivery_notes: values.delivery_notes.trim() || undefined,
  }
}

function parishFromSaved(
  addresses: { id: string; parish: string }[],
  id: string,
): string {
  return addresses.find((addr) => addr.id === id)?.parish ?? ''
}

export function BookLogisticsForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { deliveryAddresses, parishes } = useCustomerData()

  const [pickupMode, setPickupMode] = useState<AddressMode>(
    deliveryAddresses.length > 0 ? 'saved' : 'new',
  )
  const [dropoffMode, setDropoffMode] = useState<AddressMode>(
    deliveryAddresses.length > 0 ? 'saved' : 'new',
  )
  const [pickupAddressId, setPickupAddressId] = useState(
    () => deliveryAddresses.find((a) => a.is_default)?.id ?? deliveryAddresses[0]?.id ?? '',
  )
  const [dropoffAddressId, setDropoffAddressId] = useState(
    () => deliveryAddresses.find((a) => a.is_default)?.id ?? deliveryAddresses[0]?.id ?? '',
  )
  const [pickupInline, setPickupInline] = useState(() => ({
    ...emptyInlineAddress(),
    label: 'Pickup',
    contact_number: user?.contact_number ?? '',
  }))
  const [dropoffInline, setDropoffInline] = useState(() => ({
    ...emptyInlineAddress(),
    label: 'Drop-off',
    contact_number: user?.contact_number ?? '',
  }))
  const [itemDescription, setItemDescription] = useState('Documents')
  const [vehicleType, setVehicleType] = useState<LogisticsVehicleType>('bike')
  const [deliverySpeed, setDeliverySpeed] = useState<LogisticsDeliverySpeed>('immediate')
  const [paymentMethod, setPaymentMethod] = useState<LogisticsPaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const feeEstimate = useMemo(() => {
    const pickupParish =
      pickupMode === 'saved'
        ? parishFromSaved(deliveryAddresses, pickupAddressId)
        : pickupInline.parish
    const dropoffParish =
      dropoffMode === 'saved'
        ? parishFromSaved(deliveryAddresses, dropoffAddressId)
        : dropoffInline.parish
    if (!pickupParish || !dropoffParish) {
      return { feeJmd: null as number | null, feePendingQuote: false }
    }
    return estimateLogisticsFee(pickupParish, dropoffParish)
  }, [
    deliveryAddresses,
    dropoffAddressId,
    dropoffInline.parish,
    dropoffMode,
    pickupAddressId,
    pickupInline.parish,
    pickupMode,
  ])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!itemDescription.trim()) {
      setError('Describe what you are delivering')
      return
    }

    setLoading(true)
    try {
      const payload: Parameters<typeof createLogisticsJob>[0] = {
        item_description: itemDescription.trim(),
        vehicle_type: vehicleType,
        delivery_speed: deliverySpeed,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
      }

      if (pickupMode === 'saved') {
        if (!pickupAddressId) {
          setError('Choose a pickup address')
          setLoading(false)
          return
        }
        payload.pickup_address_id = pickupAddressId
      } else {
        if (!pickupInline.line1.trim() || !pickupInline.parish || !pickupInline.contact_number.trim()) {
          setError('Complete the pickup address')
          setLoading(false)
          return
        }
        payload.pickup_address = inlinePayload(pickupInline, 'Pickup')
      }

      if (dropoffMode === 'saved') {
        if (!dropoffAddressId) {
          setError('Choose a drop-off address')
          setLoading(false)
          return
        }
        payload.dropoff_address_id = dropoffAddressId
      } else {
        if (!dropoffInline.line1.trim() || !dropoffInline.parish || !dropoffInline.contact_number.trim()) {
          setError('Complete the drop-off address')
          setLoading(false)
          return
        }
        payload.dropoff_address = inlinePayload(dropoffInline, 'Drop-off')
      }

      await createLogisticsJob(payload)
      navigate('/dashboard/logistics', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <p className="text-sm text-muted">
        Book islandwide pickup and delivery. This is separate from home delivery for your US packages.
      </p>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide">Pickup</h3>
        {deliveryAddresses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                pickupMode === 'saved' ? 'bg-boss-gold/15 text-boss-gold' : 'bg-muted/20 text-muted'
              }`}
              onClick={() => setPickupMode('saved')}
            >
              Saved address
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                pickupMode === 'new' ? 'bg-boss-gold/15 text-boss-gold' : 'bg-muted/20 text-muted'
              }`}
              onClick={() => setPickupMode('new')}
            >
              Enter new address
            </button>
          </div>
        )}
        {pickupMode === 'saved' ? (
          <select
            value={pickupAddressId}
            onChange={(e) => setPickupAddressId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {deliveryAddresses.map((addr) => (
              <option key={addr.id} value={addr.id}>
                {addr.label} — {addr.parish}
              </option>
            ))}
          </select>
        ) : (
          <LogisticsAddressFields
            idPrefix="pickup"
            values={pickupInline}
            onChange={setPickupInline}
            parishes={parishes}
            defaultContactNumber={user?.contact_number}
            defaultLabel="Pickup"
          />
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide">Drop-off</h3>
        {deliveryAddresses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                dropoffMode === 'saved' ? 'bg-boss-gold/15 text-boss-gold' : 'bg-muted/20 text-muted'
              }`}
              onClick={() => setDropoffMode('saved')}
            >
              Saved address
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                dropoffMode === 'new' ? 'bg-boss-gold/15 text-boss-gold' : 'bg-muted/20 text-muted'
              }`}
              onClick={() => setDropoffMode('new')}
            >
              Enter new address
            </button>
          </div>
        )}
        {dropoffMode === 'saved' ? (
          <select
            value={dropoffAddressId}
            onChange={(e) => setDropoffAddressId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {deliveryAddresses.map((addr) => (
              <option key={addr.id} value={addr.id}>
                {addr.label} — {addr.parish}
              </option>
            ))}
          </select>
        ) : (
          <LogisticsAddressFields
            idPrefix="dropoff"
            values={dropoffInline}
            onChange={setDropoffInline}
            parishes={parishes}
            defaultContactNumber={user?.contact_number}
            defaultLabel="Drop-off"
          />
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide">Shipment details</h3>
        <div>
          <label htmlFor="item-description" className="mb-1 block text-xs font-semibold text-muted">
            What are we delivering?
          </label>
          <Input
            id="item-description"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="Type what you're sending, or pick a quick option below"
            required
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {LOGISTICS_ITEM_CATEGORIES.map((option) => {
              const selected =
                itemDescription.trim().toLowerCase() === option.label.toLowerCase()
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setItemDescription(option.label)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? 'border-boss-gold bg-boss-gold/15 text-boss-gold'
                      : 'border-border bg-background/60 text-muted hover:border-boss-gold/40 hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Vehicle size</p>
          <div
            className="grid gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Vehicle size"
          >
            {LOGISTICS_VEHICLE_TYPES.map((option) => {
              const selected = vehicleType === option.value
              const Icon = VEHICLE_OPTION_DETAILS[option.value].icon
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setVehicleType(option.value)}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                    selected
                      ? 'border-boss-gold bg-boss-gold/10 ring-1 ring-boss-gold/40'
                      : 'border-border bg-background/60 hover:border-boss-gold/30 hover:bg-card'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      selected ? 'bg-boss-gold/20 text-boss-gold' : 'bg-muted/20 text-muted'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-xs font-medium text-boss-gold">
                      {option.weightLabel}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted">
                      {VEHICLE_OPTION_DETAILS[option.value].description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label htmlFor="job-notes" className="mb-1 block text-xs font-semibold text-muted">
            Special instructions (optional)
          </label>
          <Input
            id="job-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Fragile, call on arrival, etc."
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">When do you need it?</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Delivery timing">
            {LOGISTICS_DELIVERY_SPEEDS.map((option) => {
              const selected = deliverySpeed === option.value
              const Icon = option.value === 'immediate' ? Zap : Clock
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDeliverySpeed(option.value)}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                    selected
                      ? 'border-boss-gold bg-boss-gold/10 ring-1 ring-boss-gold/40'
                      : 'border-border bg-background/60 hover:border-boss-gold/30 hover:bg-card'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      selected ? 'bg-boss-gold/20 text-boss-gold' : 'bg-muted/20 text-muted'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted">
                      {option.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Payment method</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
            {LOGISTICS_PAYMENT_METHODS.map((option) => {
              const selected = paymentMethod === option.value
              const disabled = 'disabled' in option && option.disabled
              const Icon = option.value === 'cash' ? Banknote : CreditCard
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) setPaymentMethod(option.value)
                  }}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                    disabled
                      ? 'cursor-not-allowed border-border/60 bg-background/30 opacity-50'
                      : selected
                        ? 'border-boss-gold bg-boss-gold/10 ring-1 ring-boss-gold/40'
                        : 'border-border bg-background/60 hover:border-boss-gold/30 hover:bg-card'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      disabled
                        ? 'bg-muted/10 text-muted/60'
                        : selected
                          ? 'bg-boss-gold/20 text-boss-gold'
                          : 'bg-muted/20 text-muted'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-semibold ${
                        disabled ? 'text-muted' : 'text-foreground'
                      }`}
                    >
                      {option.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted">
                      {option.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="rounded-lg border border-boss-gold/30 bg-boss-gold/5 px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">Estimated fee</p>
          <p className="mt-1 text-muted">
            {vehicleType === 'truck'
              ? 'Our team will confirm pricing for truck deliveries.'
              : feeEstimate.feePendingQuote
                ? 'Our team will confirm pricing for island-to-island routes.'
                : feeEstimate.feeJmd != null
                  ? formatJmd(feeEstimate.feeJmd)
                  : 'Select pickup and drop-off parishes to see an estimate.'}
          </p>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Request local delivery'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate('/dashboard/logistics')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
