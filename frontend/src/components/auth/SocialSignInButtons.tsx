import { FacebookSignInButton } from './FacebookSignInButton'
import { GoogleSignInButton } from './GoogleSignInButton'

interface SocialSignInButtonsProps {
  mode?: 'signin' | 'signup'
}

export function SocialSignInButtons({ mode = 'signin' }: SocialSignInButtonsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:flex-1">
        <GoogleSignInButton label={mode === 'signup' ? 'signup_with' : 'signin_with'} />
      </div>
      <div className="min-w-0 sm:flex-1">
        <FacebookSignInButton label={mode === 'signup' ? 'signup' : 'signin'} />
      </div>
    </div>
  )
}
