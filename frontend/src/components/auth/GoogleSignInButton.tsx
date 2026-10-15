import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isGoogleSignupPending, loginWithGoogle } from '../../api/auth'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  isGoogleSignInEnabled,
  storeGoogleSignupSession,
} from '../../lib/googleAuth'
import { setLastAuthProvider } from '../../lib/lastAuthProvider'
import { getPostLoginPath } from '../../lib/routing'

interface GoogleSignInButtonProps {
  label?: 'signin_with' | 'signup_with' | 'continue_with'
}

/** Snap width so scrollbar flicker / tiny layout shifts don't remount Google's iframe. */
function stableWidth(px: number): number {
  return Math.max(200, Math.floor(px / 16) * 16)
}

export function GoogleSignInButton({ label = 'continue_with' }: GoogleSignInButtonProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setSession } = useAuth()
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const [buttonWidth, setButtonWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = stableWidth(el.getBoundingClientRect().width)
        if (next > 0) {
          setButtonWidth((prev) => (prev === next ? prev : next))
        }
      })
    }

    update()
    window.addEventListener('resize', update)
    // Observe parent size only — not Google iframe internals (avoids remount loops).
    const ro = new ResizeObserver(update)
    const parent = el.parentElement
    if (parent) ro.observe(parent)
    else ro.observe(el)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      ro.disconnect()
    }
  }, [])

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

      setLastAuthProvider('google')
      setSession(data.access_token, data.user)
      navigate(getPostLoginPath(data.user.role, searchParams.get('next')))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="w-full min-w-0">
        {buttonWidth > 0 && (
          <GoogleLogin
            key={buttonWidth}
            onSuccess={handleSuccess}
            onError={() => setError('Google sign-in was cancelled or failed')}
            useOneTap={false}
            theme="outline"
            size="large"
            shape="rectangular"
            text={label}
            width={String(buttonWidth)}
          />
        )}
      </div>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
