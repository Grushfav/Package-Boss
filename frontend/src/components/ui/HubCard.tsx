import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface HubCardProps {
  to: string
  icon: LucideIcon
  title: string
  description: string
  count?: number
  stat?: string
  statTone?: 'default' | 'success'
  urgent?: boolean
  /** @deprecated Prefer accent="gold" */
  featured?: boolean
  accent?: 'default' | 'gold' | 'green'
}

export function HubCard({
  to,
  icon: Icon,
  title,
  description,
  count,
  stat,
  statTone = 'default',
  urgent,
  featured,
  accent = 'default',
}: HubCardProps) {
  const showCount = count != null && count > 0
  const tone = featured ? 'gold' : accent

  const shell =
    urgent && showCount
      ? 'border-amber-500/40 bg-card'
      : tone === 'gold'
        ? 'border-boss-gold/45 bg-boss-gold/10 shadow-[0_0_0_1px_rgba(212,175,55,0.12)] hover:border-boss-gold/70'
        : tone === 'green'
          ? 'border-boss-green/45 bg-boss-green/10 shadow-[0_0_0_1px_rgba(34,197,94,0.12)] hover:border-boss-green/70'
          : 'border-border bg-card hover:border-boss-gold/40'

  const iconTone =
    tone === 'gold' ? 'text-boss-gold' : tone === 'green' ? 'text-boss-green' : 'text-boss-green'

  const titleTone = tone === 'gold' ? 'text-boss-gold' : tone === 'green' ? 'text-boss-green' : ''

  const ctaTone = tone === 'green' ? 'text-boss-green' : 'text-boss-gold'

  return (
    <Link
      to={to}
      className={`group relative flex flex-col rounded-2xl border p-3.5 transition-colors sm:p-5 ${shell}`}
    >
      {showCount && (
        <span
          className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold sm:right-4 sm:top-4 sm:text-xs ${
            urgent ? 'bg-amber-500 text-black' : 'bg-boss-gold text-black'
          }`}
        >
          {count}
        </span>
      )}
      <Icon className={`h-5 w-5 sm:h-7 sm:w-7 ${iconTone}`} strokeWidth={2} />
      <h2
        className={`mt-2 text-sm font-bold uppercase tracking-wide sm:mt-3 sm:text-base ${titleTone}`}
      >
        {title}
      </h2>
      <p className="mt-1 flex-1 text-xs leading-snug text-muted sm:text-sm">{description}</p>
      {stat && (
        <p
          className={`mt-2 line-clamp-2 text-[11px] font-semibold sm:mt-3 sm:text-xs ${
            statTone === 'success' || tone === 'green' ? 'text-boss-green' : 'text-foreground/80'
          }`}
        >
          {stat}
        </p>
      )}
      <span
        className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold group-hover:underline sm:mt-4 sm:text-sm ${ctaTone}`}
      >
        Open
        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
    </Link>
  )
}
