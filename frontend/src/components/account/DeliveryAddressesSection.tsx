import { useEffect, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import {
  createDeliveryAddress,
  deleteDeliveryAddress,
  fetchDeliveryAddresses,
  setDefaultDeliveryAddress,
  updateWhatsappOptIn,
} from '../../api/deliveryAddresses'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { DeliveryAddress } from '../../types'

const DELIVERY_PARISHES = ['Kingston', 'St. Andrew', 'St. Catherine']

const emptyForm = {
  label: '',
  recipient_name: '',
  line1: '',
  line2: '',
  community: '',
  parish: '',
  contact_number: '',
  delivery_notes: '',
}

export function DeliveryAddressesSection() {
  const { user, refreshUser } = useAuth()
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [maxAddresses, setMaxAddresses] = useState(4)
  const [parishes, setParishes] = useState<string[]>([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [whatsappOptIn, setWhatsappOptIn] = useState(user?.whatsapp_opt_in ?? false)

  function load() {
    fetchDeliveryAddresses()
      .then(({ addresses: list, max_addresses }) => {
        setAddresses(list)
        setMaxAddresses(max_addresses)
      })
      .catch(() => setAddresses([]))
  }

  useEffect(() => {
    load()
    api.get<{ parishes: string[] }>('/parishes').then(({ data }) => setParishes(data.parishes))
  }, [])

  useEffect(() => {
    setWhatsappOptIn(user?.whatsapp_opt_in ?? false)
  }, [user?.whatsapp_opt_in])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createDeliveryAddress({
        ...form,
        parish: form.parish,
        contact_number: form.contact_number || user?.contact_number || '',
      })
      setForm(emptyForm)
      setShowForm(false)
      load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setError('')
    try {
      await deleteDeliveryAddress(id)
      load()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultDeliveryAddress(id)
      load()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleWhatsappToggle(checked: boolean) {
    setWhatsappOptIn(checked)
    try {
      await updateWhatsappOptIn(checked)
      await refreshUser?.()
    } catch (err) {
      setWhatsappOptIn(!checked)
      setError(getErrorMessage(err))
    }
  }

  const deliveryParishOptions = parishes.filter((p) => DELIVERY_PARISHES.includes(p))

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold uppercase tracking-wide">Delivery Addresses</h2>
        {addresses.length < maxAddresses && (
          <Button variant="outline" className="!text-xs" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Add address'}
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        Save up to {maxAddresses} Jamaica addresses for Kingston &amp; Portmore delivery.
      </p>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={whatsappOptIn}
          onChange={(e) => handleWhatsappToggle(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-boss-green"
        />
        <span>Receive WhatsApp updates (including invoice requests)</span>
      </label>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Label"
              placeholder="Home"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
            <Input
              label="Recipient name"
              value={form.recipient_name}
              onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
            />
            <Input
              label="Street address"
              value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
              required
              className="sm:col-span-2"
            />
            <Input
              label="Line 2"
              value={form.line2}
              onChange={(e) => setForm({ ...form, line2: e.target.value })}
              className="sm:col-span-2"
            />
            <Input
              label="Community / area"
              value={form.community}
              onChange={(e) => setForm({ ...form, community: e.target.value })}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                Parish
              </label>
              <select
                value={form.parish}
                onChange={(e) => setForm({ ...form, parish: e.target.value })}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
              >
                <option value="">Select parish</option>
                {deliveryParishOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Contact number"
              value={form.contact_number}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              placeholder={user?.contact_number}
              required
            />
            <Input
              label="Delivery notes"
              value={form.delivery_notes}
              onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })}
              className="sm:col-span-2"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save address'}
          </Button>
        </form>
      )}

      {addresses.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
          No delivery addresses yet. Add one for home or office delivery in Kingston and Portmore.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {addr.label}
                    {addr.is_default && (
                      <span className="ml-2 rounded-full bg-boss-green/15 px-2 py-0.5 text-xs text-boss-green">
                        Default
                      </span>
                    )}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap text-sm text-muted">{addr.formatted}</pre>
                  <p className="mt-1 text-xs text-muted">{addr.contact_number}</p>
                </div>
                <div className="flex gap-2">
                  {!addr.is_default && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-xs text-boss-green hover:underline"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(addr.id)}
                    className="text-xs text-muted hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
