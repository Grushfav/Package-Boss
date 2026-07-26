export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ''

export function isGoogleSignInEnabled(): boolean {
  return GOOGLE_CLIENT_ID.length > 0
}

const GOOGLE_SIGNUP_TOKEN_KEY = 'google_signup_token'
const GOOGLE_SIGNUP_PROFILE_KEY = 'google_signup_profile'

export interface GoogleSignupProfile {
  email: string
  first_name: string
  last_name: string
}

export function storeGoogleSignupSession(
  signupToken: string,
  profile: GoogleSignupProfile,
): void {
  sessionStorage.setItem(GOOGLE_SIGNUP_TOKEN_KEY, signupToken)
  sessionStorage.setItem(GOOGLE_SIGNUP_PROFILE_KEY, JSON.stringify(profile))
}

export function readGoogleSignupSession(): {
  signupToken: string
  profile: GoogleSignupProfile
} | null {
  const signupToken = sessionStorage.getItem(GOOGLE_SIGNUP_TOKEN_KEY)
  const rawProfile = sessionStorage.getItem(GOOGLE_SIGNUP_PROFILE_KEY)
  if (!signupToken || !rawProfile) return null
  try {
    const profile = JSON.parse(rawProfile) as GoogleSignupProfile
    if (!profile.email || !profile.first_name || !profile.last_name) return null
    return { signupToken, profile }
  } catch {
    return null
  }
}

export function clearGoogleSignupSession(): void {
  sessionStorage.removeItem(GOOGLE_SIGNUP_TOKEN_KEY)
  sessionStorage.removeItem(GOOGLE_SIGNUP_PROFILE_KEY)
}
