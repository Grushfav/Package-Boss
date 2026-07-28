const ONBOARDING_PREFIX = 'package-boss-onboarding-complete:'

export function isOnboardingComplete(userId: string): boolean {
  try {
    return localStorage.getItem(`${ONBOARDING_PREFIX}${userId}`) === '1'
  } catch {
    return false
  }
}

export function markOnboardingComplete(userId: string): void {
  try {
    localStorage.setItem(`${ONBOARDING_PREFIX}${userId}`, '1')
  } catch {
    // ignore storage failures
  }
}

export function clearOnboardingComplete(userId: string): void {
  try {
    localStorage.removeItem(`${ONBOARDING_PREFIX}${userId}`)
  } catch {
    // ignore storage failures
  }
}

/** Show tour for accounts created within this window (fallback when storage is empty). */
export function isRecentAccount(createdAt: string | undefined, withinDays = 14): boolean {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created <= withinDays * 24 * 60 * 60 * 1000
}
