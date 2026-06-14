import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchParishes, register } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function SignupPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [parishes, setParishes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    contact_number: '',
    trn: '',
    parish: '',
  })

  useEffect(() => {
    fetchParishes().then(setParishes).catch(() => {})
  }, [])

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await register(form)
      setSession(data.access_token, data.user)
      navigate('/dashboard', { state: { shipping_address: data.shipping_address } })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-black uppercase">
          Join <span className="italic text-boss-green">Package Boss</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Create your account and get your Miami shipping address instantly.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First Name"
              value={form.first_name}
              onChange={(e) => update('first_name', e.target.value)}
              required
            />
            <Input
              label="Last Name"
              value={form.last_name}
              onChange={(e) => update('last_name', e.target.value)}
              required
            />
          </div>

          <Input
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          <Input
            label="Contact Number"
            type="tel"
            placeholder="8765551234"
            value={form.contact_number}
            onChange={(e) => update('contact_number', e.target.value)}
            required
          />

          <Input
            label="TRN (9 digits)"
            placeholder="123456789"
            value={form.trn}
            onChange={(e) => update('trn', e.target.value)}
            required
            maxLength={11}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              Parish
            </label>
            <select
              value={form.parish}
              onChange={(e) => update('parish', e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-green focus:outline-none"
            >
              <option value="">Select parish</option>
              {parishes.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already a member?{' '}
          <Link to="/login" className="text-boss-green hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
