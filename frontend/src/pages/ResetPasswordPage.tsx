import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword, validateResetToken } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [valid, setValid] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setValid(false)
      return
    }
    validateResetToken(token).then(setValid).catch(() => setValid(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const msg = await resetPassword(token, password)
      setMessage(msg)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (valid === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        Validating link...
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold uppercase text-red-400">Invalid or Expired Link</h1>
        <p className="mt-4 text-muted">Request a new password reset link.</p>
        <Link to="/forgot-password" className="mt-6 inline-block text-boss-green hover:underline">
          Forgot Password
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-bold uppercase">Reset Password</h1>
        <p className="mt-2 text-sm text-muted">Enter your new password below.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
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
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
