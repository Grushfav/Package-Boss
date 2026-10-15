import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isFacebookSignupPending, loginWithFacebook } from '../../api/auth'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  isFacebookSignInEnabled,
  isFacebookSignInReady,
  loadFacebookSdk,
  storeFacebookSignupSession,
} from '../../lib/facebookAuth'
import { getPostLoginPath } from '../../lib/routing'

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.48h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z"
      />
    </svg>
  )
}

interface FacebookSignInButtonProps {
  label?: 'signin' | 'signup' | 'continue'
}

export function FacebookSignInButton({ label = 'continue' }: FacebookSignInButtonProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setSession } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isFacebookSignInEnabled()) {
    return null
  }

  const ready = isFacebookSignInReady()
  const buttonLabel =
    label === 'signup' ? 'Sign up with Facebook' : 'Sign in with Facebook'

  async function handleClick() {
    if (!ready) return
    setError('')
    setLoading(true)
    try {
      await loadFacebookSdk()
      if (!window.FB) {
        throw new Error('Facebook SDK failed to initialize')
      }

      const accessToken = await new Promise<string>((resolve, reject) => {
        window.FB!.login(
          (response) => {
            if (response.authResponse?.accessToken) {
              resolve(response.authResponse.accessToken)
              return
            }
            if (response.status === 'unknown') {
              reject(new Error('Facebook sign-in was cancelled'))
              return
            }
            reject(new Error('Facebook sign-in did not return an access token'))
          },
          { scope: 'email,public_profile' },
        )
      })

      const data = await loginWithFacebook(accessToken)
      if (isFacebookSignupPending(data)) {
        storeFacebookSignupSession(data.signup_token, {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
        })
        navigate('/signup/facebook')
        return
      }

      setSession(data.access_token, data.user)
      navigate(getPostLoginPath(data.user.role, searchParams.get('next')))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading || !ready}
        title={ready ? undefined : 'Facebook sign-in coming soon'}
        aria-disabled={!ready}
        onClick={() => void handleClick()}
        className={
          ready
            ? 'flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1877F2] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#166FE5] disabled:cursor-not-allowed disabled:opacity-50'
            : 'flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm font-semibold text-muted opacity-60'
        }
      >
        <FacebookIcon className="h-5 w-5 shrink-0" />
        <span className="truncate">
          {loading ? 'Connecting…' : ready ? buttonLabel : 'Facebook (coming soon)'}
        </span>
      </button>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
