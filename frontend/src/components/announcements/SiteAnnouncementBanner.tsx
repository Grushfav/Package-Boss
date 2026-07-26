import { AlertTriangle, Info, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  dismissAnnouncement,
  fetchActiveAnnouncements,
  markAnnouncementRead,
  type AnnouncementBanner,
  type AnnouncementContext,
} from '../../api/announcements'
import { useAuth } from '../../context/AuthContext'
import {
  dismissAnnouncementLocally,
  isAnnouncementDismissedLocally,
  isModalSeenThisSession,
  markModalSeenThisSession,
} from '../../lib/announcementDismissals'
import { canAccessWarehouse } from '../../lib/roles'

function resolveContext(pathname: string, isAuthenticated: boolean, role?: string): AnnouncementContext {
  if (pathname.startsWith('/warehouse') && canAccessWarehouse(role)) {
    return 'staff'
  }
  if (pathname.startsWith('/dashboard') && isAuthenticated) {
    return 'customer'
  }
  return 'public'
}

function severityStyles(severity: AnnouncementBanner['severity']) {
  switch (severity) {
    case 'urgent':
      return 'border-red-500/40 bg-red-500/10 text-red-100'
    case 'warning':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
    default:
      return 'border-boss-gold/40 bg-boss-gold/10 text-foreground'
  }
}

function SeverityIcon({ severity }: { severity: AnnouncementBanner['severity'] }) {
  if (severity === 'urgent') return <XCircle className="h-4 w-4 shrink-0" />
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 shrink-0" />
  return <Info className="h-4 w-4 shrink-0" />
}

function AnnouncementModal({
  announcement,
  onClose,
}: {
  announcement: AnnouncementBanner
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
        role="dialog"
        aria-labelledby={`announcement-modal-${announcement.id}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <SeverityIcon severity={announcement.severity} />
            <div>
              <h2
                id={`announcement-modal-${announcement.id}`}
                className="text-lg font-bold uppercase tracking-wide"
              >
                {announcement.title}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{announcement.body}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-boss-gold px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export function SiteAnnouncementBanner() {
  const { pathname } = useLocation()
  const { user, isAuthenticated } = useAuth()
  const [banner, setBanner] = useState<AnnouncementBanner | null>(null)
  const [modal, setModal] = useState<AnnouncementBanner | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [hidden, setHidden] = useState(false)

  const context = useMemo(
    () => resolveContext(pathname, isAuthenticated, user?.role),
    [pathname, isAuthenticated, user?.role],
  )

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await fetchActiveAnnouncements(context)
      const nextBanner = data.banner
      if (nextBanner && isAnnouncementDismissedLocally(nextBanner.id)) {
        setBanner(null)
      } else {
        setBanner(nextBanner)
      }

      const nextModal = data.modals.find((item) => !isModalSeenThisSession(item.id)) ?? null
      setModal(nextModal)
      setHidden(false)
      setExpanded(false)
    } catch {
      setBanner(null)
      setModal(null)
    }
  }, [context])

  useEffect(() => {
    loadAnnouncements()
  }, [loadAnnouncements])

  async function handleDismiss(target: AnnouncementBanner) {
    if (isAuthenticated) {
      try {
        await dismissAnnouncement(target.id)
      } catch {
        dismissAnnouncementLocally(target.id)
      }
    } else {
      dismissAnnouncementLocally(target.id)
    }
    if (target.id === banner?.id) {
      setBanner(null)
      setHidden(true)
    }
  }

  function handleModalClose() {
    if (!modal) return
    markModalSeenThisSession(modal.id)
    if (isAuthenticated) {
      markAnnouncementRead(modal.id).catch(() => {})
    }
    setModal(null)
  }

  if (hidden && !modal) return null

  return (
    <>
      {modal && <AnnouncementModal announcement={modal} onClose={handleModalClose} />}

      {banner && !hidden && (
        <div className={`no-print border-b px-4 py-3 ${severityStyles(banner.severity)}`}>
          <div className="mx-auto flex max-w-6xl items-start gap-3">
            <SeverityIcon severity={banner.severity} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{banner.title}</p>
              {expanded ? (
                <p className="mt-1 whitespace-pre-wrap text-sm opacity-90">{banner.body}</p>
              ) : (
                <p className="mt-1 truncate text-sm opacity-90">{banner.body}</p>
              )}
              {banner.body.length > 80 && (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="mt-1 text-xs font-semibold underline opacity-80"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {banner.dismissible && (
                <button
                  type="button"
                  onClick={() => handleDismiss(banner)}
                  className="rounded p-1 opacity-80 transition-opacity hover:opacity-100"
                  aria-label="Dismiss announcement"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
