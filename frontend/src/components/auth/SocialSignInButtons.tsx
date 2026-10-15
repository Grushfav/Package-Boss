import { useState } from 'react'
import { getLastAuthProvider, type AuthProvider } from '../../lib/lastAuthProvider'
import { FacebookSignInButton } from './FacebookSignInButton'
import { GoogleSignInButton } from './GoogleSignInButton'

interface SocialSignInButtonsProps {
  mode?: 'signin' | 'signup'
}

function LastUsedHint({ provider, last }: { provider: AuthProvider; last: AuthProvider | null }) {
  if (last !== provider) return null
  return (
    <p className="mt-1.5 text-center text-[11px] font-medium text-muted">
      Last used
    </p>
  )
}

export function SocialSignInButtons({ mode = 'signin' }: SocialSignInButtonsProps) {
  const [last] = useState(() => getLastAuthProvider())

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="w-full min-w-0 sm:flex-1">
        <GoogleSignInButton label={mode === 'signup' ? 'signup' : 'signin'} />
        <LastUsedHint provider="google" last={last} />
      </div>
      <div className="w-full min-w-0 sm:flex-1">
        <FacebookSignInButton label={mode === 'signup' ? 'signup' : 'signin'} />
        <LastUsedHint provider="facebook" last={last} />
      </div>
    </div>
  )
}
