import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { completeGoogleSignup, fetchParishes } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Seo } from '../components/seo/Seo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import {
  clearGoogleSignupSession,
  isGoogleSignInEnabled,
  readGoogleSignupSession,
} from '../lib/googleAuth'
import { cacheShippingAddress } from '../lib/offlineAddress'
import { getPostLoginPath } from '../lib/routing'
import { PAGE_SEO } from '../lib/seo'

export function GoogleSignupCompletePage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const session = readGoogleSignupSession()
  const [parishes, setParishes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [form, setForm] = useState({
    contact_number: '',
    trn: '',
    parish: '',
  })

  useEffect(() => {
    fetchParishes().then(setParishes).catch(() => {})
  }, [])

  if (!isGoogleSignInEnabled()) {
    return <Navigate to="/signup" replace />
  }

  if (!session) {
    return <Navigate to="/signup" replace />
  }

  const { signupToken, profile } = session

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!acceptTerms) {
      setError('You must accept the Terms and Conditions to create an account.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await completeGoogleSignup(signupToken, {
        ...form,
        accept_terms: true,
      })
      clearGoogleSignupSession()
      setSession(data.access_token, data.user)
      if (data.shipping_address) {
        cacheShippingAddress(data.shipping_address)
      }
      navigate(getPostLoginPath(data.user.role, null), {
        state: { shipping_address: data.shipping_address },
      })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Seo {...PAGE_SEO.signup} title="Complete Google Sign Up | Package Boss" />
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-black uppercase">Almost there</h1>
        <p className="mt-2 text-sm text-muted">
          Signed in with Google as{' '}
          <span className="font-semibold text-foreground">{profile.email}</span>. Add the details
          below to finish creating your Package Boss account.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First Name" value={profile.first_name} disabled />
            <Input label="Last Name" value={profile.last_name} disabled />
          </div>
          <Input label="Email" type="email" value={profile.email} disabled />

          <Input
            label="Contact Number"
            value={form.contact_number}
            onChange={(e) => setForm((prev) => ({ ...prev, contact_number: e.target.value }))}
            required
          />
          <Input
            label="TRN (optional)"
            value={form.trn}
            onChange={(e) => setForm((prev) => ({ ...prev, trn: e.target.value }))}
          />
          <div>
            <label className="mb-1 block text-sm font-semibold">Parish</label>
            <select
              value={form.parish}
              onChange={(e) => setForm((prev) => ({ ...prev, parish: e.target.value }))}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select parish</option>
              {parishes.map((parish) => (
                <option key={parish} value={parish}>
                  {parish}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-boss-gold"
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="text-boss-gold underline">
                Terms and Conditions
              </Link>
              .
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </div>
    </div>
  )
}
