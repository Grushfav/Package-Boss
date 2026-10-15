export const FACEBOOK_APP_ID =
  (import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined)?.trim() ?? ''

export function isFacebookSignInEnabled(): boolean {
  return FACEBOOK_APP_ID.length > 0
}

const FACEBOOK_SIGNUP_TOKEN_KEY = 'facebook_signup_token'
const FACEBOOK_SIGNUP_PROFILE_KEY = 'facebook_signup_profile'

export interface FacebookSignupProfile {
  email: string
  first_name: string
  last_name: string
}

declare global {
  interface Window {
    fbAsyncInit?: () => void
    FB?: {
      init: (params: {
        appId: string
        cookie?: boolean
        xfbml?: boolean
        version: string
      }) => void
      login: (
        callback: (response: {
          authResponse?: { accessToken: string; userID: string }
          status: string
        }) => void,
        options?: { scope?: string },
      ) => void
    }
  }
}

let sdkPromise: Promise<void> | null = null

export function loadFacebookSdk(): Promise<void> {
  if (!isFacebookSignInEnabled()) {
    return Promise.reject(new Error('Facebook sign-in is not configured'))
  }
  if (window.FB) {
    return Promise.resolve()
  }
  if (sdkPromise) {
    return sdkPromise
  }

  sdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: 'v21.0',
      })
      resolve()
    }

    const existing = document.getElementById('facebook-jssdk')
    if (existing) {
      return
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.async = true
    script.defer = true
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.onerror = () => {
      sdkPromise = null
      reject(new Error('Failed to load Facebook SDK'))
    }
    document.body.appendChild(script)
  })

  return sdkPromise
}

export function storeFacebookSignupSession(
  signupToken: string,
  profile: FacebookSignupProfile,
): void {
  sessionStorage.setItem(FACEBOOK_SIGNUP_TOKEN_KEY, signupToken)
  sessionStorage.setItem(FACEBOOK_SIGNUP_PROFILE_KEY, JSON.stringify(profile))
}

export function readFacebookSignupSession(): {
  signupToken: string
  profile: FacebookSignupProfile
} | null {
  const signupToken = sessionStorage.getItem(FACEBOOK_SIGNUP_TOKEN_KEY)
  const rawProfile = sessionStorage.getItem(FACEBOOK_SIGNUP_PROFILE_KEY)
  if (!signupToken || !rawProfile) return null
  try {
    const profile = JSON.parse(rawProfile) as FacebookSignupProfile
    if (!profile.email || !profile.first_name || !profile.last_name) return null
    return { signupToken, profile }
  } catch {
    return null
  }
}

export function clearFacebookSignupSession(): void {
  sessionStorage.removeItem(FACEBOOK_SIGNUP_TOKEN_KEY)
  sessionStorage.removeItem(FACEBOOK_SIGNUP_PROFILE_KEY)
}
