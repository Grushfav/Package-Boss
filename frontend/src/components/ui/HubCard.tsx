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

const GLASS_BASE =
  'relative overflow-hidden border border-white/12 bg-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_10px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150 transition-[border-color,background-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_14px_40px_rgba(0,0,0,0.4)]'

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

  const accentRing =
    urgent && showCount
      ? 'hover:border-amber-400/50'
      : tone === 'gold'
        ? 'hover:border-boss-gold/45'
        : tone === 'green'
          ? 'hover:border-boss-green/45'
          : 'hover:border-white/25'

  const glow =
    urgent && showCount
      ? 'bg-amber-400/20'
      : tone === 'gold'
        ? 'bg-boss-gold/25'
        : tone === 'green'
          ? 'bg-boss-green/20'
          : 'bg-white/10'

  const iconTone =
    tone === 'gold' ? 'text-boss-gold' : tone === 'green' ? 'text-boss-green' : 'text-boss-green'

  const titleTone = tone === 'gold' ? 'text-boss-gold' : tone === 'green' ? 'text-boss-green' : ''

  const ctaTone = tone === 'green' ? 'text-boss-green' : 'text-boss-gold'

  return (
    <Link
      to={to}
      className={`group flex flex-col rounded-2xl p-3.5 sm:p-5 ${GLASS_BASE} ${accentRing}`}
    >
      {/* Specular wash + soft accent bloom */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${glow} opacity-70`}
      />

      {showCount && (
        <span
          className={`absolute right-2.5 top-2.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm sm:right-4 sm:top-4 sm:text-xs ${
            urgent ? 'bg-amber-500 text-black' : 'bg-boss-gold text-black'
          }`}
        >
          {count}
        </span>
      )}
      <Icon className={`relative z-[1] h-5 w-5 sm:h-7 sm:w-7 ${iconTone}`} strokeWidth={2} />
      <h2
        className={`relative z-[1] mt-2 text-sm font-bold uppercase tracking-wide sm:mt-3 sm:text-base ${titleTone}`}
      >
        {title}
      </h2>
      <p className="relative z-[1] mt-1 flex-1 text-xs leading-snug text-muted sm:text-sm">
        {description}
      </p>
      {stat && (
        <p
          className={`relative z-[1] mt-2 line-clamp-2 text-[11px] font-semibold sm:mt-3 sm:text-xs ${
            statTone === 'success' || tone === 'green' ? 'text-boss-green' : 'text-foreground/80'
          }`}
        >
          {stat}
        </p>
      )}
      <span
        className={`relative z-[1] mt-3 inline-flex items-center gap-1 text-xs font-semibold group-hover:underline sm:mt-4 sm:text-sm ${ctaTone}`}
      >
        Open
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 sm:h-4 sm:w-4" />
      </span>
    </Link>
  )
}
