import { Shield, UserPlus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClerk, demoteClerk, fetchClerks, promoteToClerk } from '../api/admin'
import { api } from '../api/client'
import { getErrorMessage } from '../api/client'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import type { User } from '../types'

export function AdminClerksPage() {
  const [clerks, setClerks] = useState<User[]>([])
  const [parishes, setParishes] = useState<string[]>([])
  const [promoteEmail, setPromoteEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    contact_number: '',
    trn: '',
    parish: 'Kingston',
  })

  useEffect(() => {
    fetchClerks().then(setClerks).catch(() => {})
    api.get<{ parishes: string[] }>('/parishes').then(({ data }) => setParishes(data.parishes))
  }, [])

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const clerk = await promoteToClerk(promoteEmail)
      setClerks((prev) => [clerk, ...prev.filter((c) => c.id !== clerk.id)])
      setPromoteEmail('')
      setSuccess(`Promoted ${clerk.full_name} to clerk.`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const clerk = await createClerk(form)
      setClerks((prev) => [clerk, ...prev])
      setForm({
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        contact_number: '',
        trn: '',
        parish: 'Kingston',
      })
      setShowCreateForm(false)
      setSuccess(`Created clerk account for ${clerk.full_name}.`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDemote(clerkId: string) {
    setError('')
    setSuccess('')
    try {
      const demoted = await demoteClerk(clerkId)
      setClerks((prev) => prev.filter((c) => c.id !== clerkId))
      setSuccess(`${demoted.full_name} is now a customer.`)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={Shield} size="sm" />
        <h1 className="text-2xl font-black uppercase">Manage Clerks</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-boss-green">
          <UserPlus className="h-4 w-4" />
          Promote existing customer
        </h2>
        <p className="mt-2 text-sm text-muted">
          Enter the email of a registered customer to grant clerk access.
        </p>
        <form onSubmit={handlePromote} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            label="Customer email"
            type="email"
            placeholder="clerk@example.com"
            value={promoteEmail}
            onChange={(e) => setPromoteEmail(e.target.value)}
            className="flex-1"
            required
          />
          <Button type="submit" disabled={loading} className="sm:self-end">
            Promote to Clerk
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-6">
          <Button
            variant="outline"
            onClick={() => setShowCreateForm((v) => !v)}
            className="!text-xs"
          >
            {showCreateForm ? 'Cancel new clerk form' : 'Create new clerk account'}
          </Button>

          {showCreateForm && (
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="First name"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
                <Input
                  label="Last name"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </div>
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <Input
                label="Contact (876)"
                value={form.contact_number}
                onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                required
              />
              <Input
                label="TRN (9 digits)"
                value={form.trn}
                onChange={(e) => setForm({ ...form, trn: e.target.value })}
                required
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                  Parish
                </label>
                <select
                  value={form.parish}
                  onChange={(e) => setForm({ ...form, parish: e.target.value })}
                  className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-green focus:outline-none focus:ring-1 focus:ring-boss-green"
                >
                  {parishes.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" fullWidth disabled={loading}>
                Create Clerk
              </Button>
            </form>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
        )}
        {success && (
          <p className="mt-4 rounded-lg bg-boss-green/10 px-4 py-3 text-sm text-boss-green">
            {success}
          </p>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-boss-green">
          <Users className="h-4 w-4" />
          Current clerks ({clerks.length})
        </h2>
        {clerks.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No clerks yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {clerks.map((clerk) => (
              <li
                key={clerk.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4"
              >
                <div>
                  <p className="font-semibold">{clerk.full_name}</p>
                  <p className="text-sm text-muted">{clerk.email}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleDemote(clerk.id)}
                  className="!py-2 !text-xs"
                >
                  Remove clerk access
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
