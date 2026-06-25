import { useEffect, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import {
  createAuthorizedPickup,
  deleteAuthorizedPickup,
  fetchAuthorizedPickups,
} from '../../api/authorizedPickups'
import type { AuthorizedPickupPerson, PickupOption } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

const emptyForm = {
  full_name: '',
  contact_number: '',
  id_type: '',
  notes: '',
}

export function AuthorizedPickupsSection() {
  const [pickups, setPickups] = useState<AuthorizedPickupPerson[]>([])
  const [maxPickups, setMaxPickups] = useState(5)
  const [idTypes, setIdTypes] = useState<PickupOption[]>([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function load() {
    fetchAuthorizedPickups()
      .then(({ pickups: list, max_pickups, id_types }) => {
        setPickups(list)
        setMaxPickups(max_pickups)
        setIdTypes(id_types)
      })
      .catch(() => setPickups([]))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createAuthorizedPickup({
        full_name: form.full_name,
        contact_number: form.contact_number,
        id_type: form.id_type,
        notes: form.notes || undefined,
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
      await deleteAuthorizedPickup(id)
      load()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold uppercase tracking-wide">Authorized Pickup</h2>
        {pickups.length < maxPickups && (
          <Button variant="outline" className="!text-xs" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Add person'}
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        People allowed to collect packages on your behalf. They must present a matching valid
        government ID at pickup (up to {maxPickups}).
      </p>

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
              label="Full name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              className="sm:col-span-2"
            />
            <Input
              label="Contact number"
              value={form.contact_number}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              required
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                ID type
              </label>
              <select
                value={form.id_type}
                onChange={(e) => setForm({ ...form, id_type: e.target.value })}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
              >
                <option value="">Select ID type</option>
                {idTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="sm:col-span-2"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save person'}
          </Button>
        </form>
      )}

      {pickups.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted">
          No authorized pickup persons yet. Add someone who can collect packages for you at our
          drop-off points.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {pickups.map((person) => (
            <div key={person.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{person.full_name}</p>
                  <p className="mt-1 text-sm text-muted">{person.contact_number}</p>
                  <p className="mt-1 text-xs text-muted">{person.id_type_label}</p>
                  {person.notes && (
                    <p className="mt-2 text-sm text-muted">{person.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(person.id)}
                  className="text-xs text-muted hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
