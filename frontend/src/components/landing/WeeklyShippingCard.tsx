import { ArrowRight, Plane } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  SHIPPING_FREQUENCY_BLURB,
  SHIPPING_FREQUENCY_SHORT,
} from '../../content/marketing'

interface WeeklyShippingCardProps {
  className?: string
  showCta?: boolean
}

export function WeeklyShippingCard({ className = '', showCta = true }: WeeklyShippingCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-boss-green/35 bg-gradient-to-br from-boss-green/15 via-card to-card shadow-sm ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-boss-green/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-boss-gold/5"
      />

      <div className="relative flex flex-col gap-8 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-boss-green/50 bg-boss-green/10 shadow-inner">
            <span className="text-4xl font-black leading-none text-boss-green">3×</span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-boss-green">
              Weekly
            </span>
          </div>

          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-boss-gold">
              <Plane className="h-3.5 w-3.5" strokeWidth={2.25} />
              Miami → Jamaica
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase md:text-3xl">
              {SHIPPING_FREQUENCY_SHORT}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
              {SHIPPING_FREQUENCY_BLURB}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 md:min-w-[200px]">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="flex flex-col items-center rounded-xl border border-border bg-background/90 px-2 py-3"
              >
                <Plane className="h-5 w-5 text-boss-green" strokeWidth={2} />
                <span className="mt-1.5 text-[10px] font-bold uppercase text-muted">
                  Departure
                </span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs font-medium text-boss-green">
            Every week, three flights to yaad
          </p>
          {showCta && (
            <Link
              to="/services"
              className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-boss-green hover:underline"
            >
              How we ship
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
