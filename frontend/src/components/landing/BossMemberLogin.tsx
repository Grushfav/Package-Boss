import { Lock, User } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '../../api/auth'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { getPostLoginPath } from '../../lib/routing'
import { Button } from '../ui/Button'
import { IconBadge } from '../ui/IconBadge'
import { Input } from '../ui/Input'

export function BossMemberLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setSession } = useAuth()
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
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={User} size="sm" />
        <h2 className="text-sm font-bold uppercase tracking-wide">Boss Member Login</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
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

      <div className="mt-4 flex items-center justify-between text-xs">
        <Link to="/forgot-password" className="text-muted underline hover:text-foreground">
          Forgot Password?
        </Link>
        <Link to="/signup" className="text-muted hover:text-foreground">
          New Boss? <span className="text-boss-green">Sign Up</span>
        </Link>
      </div>
    </div>
  )
}
