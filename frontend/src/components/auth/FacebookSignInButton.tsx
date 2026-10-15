import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isFacebookSignupPending, loginWithFacebook } from '../../api/auth'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  isFacebookSignInEnabled,
  loadFacebookSdk,
  storeFacebookSignupSession,
} from '../../lib/facebookAuth'
import { getPostLoginPath } from '../../lib/routing'
import { Button } from '../ui/Button'

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

  const buttonLabel =
    label === 'signin'
      ? 'Continue with Facebook'
      : label === 'signup'
        ? 'Sign up with Facebook'
        : 'Continue with Facebook'

  async function handleClick() {
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
      <Button
        type="button"
        variant="outline"
        fullWidth
        disabled={loading}
        onClick={() => void handleClick()}
        className="inline-flex items-center justify-center gap-2 border-[#1877F2]/40 text-[#1877F2] hover:bg-[#1877F2]/10"
      >
        <span className="text-base font-black" aria-hidden>
          f
        </span>
        {loading ? 'Connecting…' : buttonLabel}
      </Button>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
