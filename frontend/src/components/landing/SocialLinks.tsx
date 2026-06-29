import { SOCIAL_URLS } from '../../content/social'

const iconClass = 'h-5 w-5'

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass} aria-hidden>
      <path d="M16.5 3.5c.3 2.1 1.4 3.4 3.5 3.6v3.1c-1.3 0-2.5-.4-3.5-1.1v6.9c0 3.4-2.8 5.5-5.8 5.5-2.9 0-5.2-2.1-5.2-5.1 0-3.1 2.5-5.3 5.7-5.3.5 0 1 .1 1.5.2v3.3c-.5-.2-1-.3-1.5-.3-1.5 0-2.5.9-2.5 2.2 0 1.3 1 2.1 2.4 2.1 1.5 0 2.6-1 2.6-2.8V3.5h3.3z" />
    </svg>
  )
}

const SOCIAL_ITEMS = [
  { key: 'instagram' as const, label: 'Instagram', Icon: InstagramIcon },
  { key: 'tiktok' as const, label: 'TikTok', Icon: TikTokIcon },
]

const linkClass =
  'flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:border-boss-green/50 hover:bg-boss-green/10 hover:text-boss-green'

interface SocialLinksProps {
  className?: string
  showLabel?: boolean
}

export function SocialLinks({ className = '', showLabel = true }: SocialLinksProps) {
  return (
    <div className={className}>
      {showLabel && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Follow us</p>
      )}
      <div className="flex items-center gap-3">
        {SOCIAL_ITEMS.map(({ key, label, Icon }) => {
          const url = SOCIAL_URLS[key]
          if (url) {
            return (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={linkClass}
              >
                <Icon />
              </a>
            )
          }
          return (
            <span
              key={key}
              aria-label={`${label} (link coming soon)`}
              title="Link coming soon"
              className={`${linkClass} cursor-default opacity-60`}
            >
              <Icon />
            </span>
          )
        })}
      </div>
    </div>
  )
}
