import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { Seo } from '../components/seo/Seo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PAGE_SEO } from '../lib/seo'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const msg = await forgotPassword(email)
      setMessage(msg)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Seo {...PAGE_SEO.forgotPassword} />
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-bold uppercase">Forgot Password</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your email and we'll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
          )}
          {message && (
            <p className="rounded-lg bg-boss-green/10 px-4 py-2 text-sm text-boss-green">
              {message}
            </p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/login" className="text-boss-green hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
