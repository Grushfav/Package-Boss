import { Lock, User } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { getPostLoginPath } from '../lib/routing'
import { Seo } from '../components/seo/Seo'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { PAGE_SEO } from '../lib/seo'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { setSession } = useAuth()
  const passwordUpdated = (location.state as { passwordUpdated?: boolean } | null)?.passwordUpdated
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      setSession(data.access_token, data.user)
      navigate(getPostLoginPath(data.user.role, searchParams.get('next')))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Seo {...PAGE_SEO.login} />
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <IconBadge icon={User} size="sm" />
          <h1 className="text-lg font-bold uppercase tracking-wide">Boss Member Login</h1>
        </div>

        {passwordUpdated && (
          <p className="mb-4 rounded-lg bg-boss-green/10 px-4 py-2 text-sm text-boss-green">
            Password updated. Sign in with your new password.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading} className="inline-flex items-center justify-center gap-2">
            {!loading && <Lock className="h-4 w-4" strokeWidth={2} />}
            {loading ? 'Authorizing...' : 'Authorize Login'}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-muted underline hover:text-foreground">
            Forgot Password?
          </Link>
          <Link to="/signup" className="text-muted hover:text-foreground">
            New Boss? <span className="text-boss-green">Sign Up</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
