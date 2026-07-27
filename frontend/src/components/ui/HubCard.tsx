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
}: HubCardProps) {
  const showCount = count != null && count > 0

  return (
    <Link
      to={to}
      className={`group relative flex flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-boss-gold/40 ${
        urgent && showCount ? 'border-amber-500/40' : 'border-border'
      }`}
    >
      {showCount && (
        <span
          className={`absolute right-4 top-4 rounded-full px-2 py-0.5 text-xs font-bold ${
            urgent ? 'bg-amber-500 text-black' : 'bg-boss-gold text-black'
          }`}
        >
          {count}
        </span>
      )}
      <Icon className="h-7 w-7 text-boss-green" strokeWidth={2} />
      <h2 className="mt-3 font-bold uppercase tracking-wide">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted">{description}</p>
      {stat && (
        <p
          className={`mt-3 text-xs font-semibold ${
            statTone === 'success' ? 'text-boss-green' : 'text-foreground/80'
          }`}
        >
          {stat}
        </p>
      )}
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-boss-gold group-hover:underline">
        Open
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}
