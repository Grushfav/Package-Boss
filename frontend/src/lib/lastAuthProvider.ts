const STORAGE_KEY = 'package-boss-last-auth-provider'

export type AuthProvider = 'google' | 'facebook' | 'email'

export function getLastAuthProvider(): AuthProvider | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'google' || value === 'facebook' || value === 'email') {
      return value
    }
  } catch {
    // ignore quota / private mode
  }
  return null
}

export function setLastAuthProvider(provider: AuthProvider): void {
  try {
    localStorage.setItem(STORAGE_KEY, provider)
  } catch {
    // ignore quota / private mode
  }
}
