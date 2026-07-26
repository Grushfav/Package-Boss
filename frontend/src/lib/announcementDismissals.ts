const DISMISSED_KEY = 'package-boss-dismissed-announcements'

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function isAnnouncementDismissedLocally(id: string): boolean {
  return readDismissed().includes(id)
}

export function dismissAnnouncementLocally(id: string): void {
  const dismissed = readDismissed()
  if (dismissed.includes(id)) return
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, id]))
}

export function clearDismissedAnnouncement(id: string): void {
  localStorage.setItem(
    DISMISSED_KEY,
    JSON.stringify(readDismissed().filter((entry) => entry !== id)),
  )
}

const MODAL_SEEN_PREFIX = 'package-boss-modal-seen:'

export function isModalSeenThisSession(id: string): boolean {
  return sessionStorage.getItem(`${MODAL_SEEN_PREFIX}${id}`) === '1'
}

export function markModalSeenThisSession(id: string): void {
  sessionStorage.setItem(`${MODAL_SEEN_PREFIX}${id}`, '1')
}
