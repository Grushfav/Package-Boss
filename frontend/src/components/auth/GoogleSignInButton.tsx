import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isGoogleSignupPending, loginWithGoogle } from '../../api/auth'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  isGoogleSignInEnabled,
  storeGoogleSignupSession,
} from '../../lib/googleAuth'
import { getPostLoginPath } from '../../lib/routing'

interface GoogleSignInButtonProps {
  label?: 'signin_with' | 'signup_with' | 'continue_with'
}

export function GoogleSignInButton({ label = 'continue_with' }: GoogleSignInButtonProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setSession } = useAuth()
  const [error, setError] = useState('')

  if (!isGoogleSignInEnabled()) {
    return null
  }

  async function handleSuccess(response: CredentialResponse) {
    if (!response.credential) {
      setError('Google sign-in did not return a credential')
      return
    }

    setError('')
    try {
      const data = await loginWithGoogle(response.credential)
      if (isGoogleSignupPending(data)) {
        storeGoogleSignupSession(data.signup_token, {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
        })
        navigate('/signup/google')
        return
      }

      setSession(data.access_token, data.user)
      navigate(getPostLoginPath(data.user.role, searchParams.get('next')))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-center [&>div]:w-full">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError('Google sign-in was cancelled or failed')}
          useOneTap={false}
          theme="outline"
          size="large"
          shape="rectangular"
          text={label}
          width="100%"
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
