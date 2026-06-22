import { Clock, Plane, Zap } from 'lucide-react'

const SHORT_LINE =
  'Your packages spend less time in Miami and more time on the way to yaad.'

interface ShippingFrequencyCardProps {
  className?: string
  compact?: boolean
}

export function ShippingFrequencyCard({
  className = '',
  compact = false,
}: ShippingFrequencyCardProps) {
  return (
    <div
      className={`relative h-full overflow-hidden rounded-3xl bg-boss-navy shadow-xl ring-1 ring-boss-green/40 ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-boss-green/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-boss-gold/15 blur-3xl"
      />

      <div className={`relative z-10 ${compact ? 'p-6 md:p-7' : 'p-8 md:p-10'}`}>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-boss-green">
            <Plane className="h-3.5 w-3.5" strokeWidth={2.5} />
            Shipping schedule
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
            Florida → JA
          </span>
        </div>

        <div className="mt-6 flex items-end gap-2">
          <span
            className={`font-black leading-none tracking-tight text-white ${
              compact ? 'text-6xl md:text-7xl' : 'text-7xl md:text-8xl'
            }`}
          >
            3
          </span>
          <div className="mb-1">
            <span className="block text-2xl font-black leading-none text-boss-gold md:text-3xl">
              ×
            </span>
            <span className="mt-1 block text-xs font-bold uppercase tracking-widest text-boss-green">
              weekly
            </span>
          </div>
        </div>

        <p className="mt-3 text-base font-semibold leading-snug text-white md:text-lg">
          Flights from Miami to Jamaica, every week.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm md:p-4">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                From
              </p>
              <p className="mt-0.5 truncate text-xs font-bold text-white md:text-sm">Miami, FL</p>
            </div>

            <div className="flex shrink-0 items-center gap-1 px-0.5">
              <span className="h-1 w-4 bg-gradient-to-r from-transparent to-boss-green sm:w-6" />
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-boss-green/20 ring-1 ring-boss-green/50">
                <Plane className="h-3.5 w-3.5 text-boss-green" strokeWidth={2.25} />
              </span>
              <span className="h-1 w-4 bg-gradient-to-l from-transparent to-boss-gold sm:w-6" />
            </div>

            <div className="min-w-0 flex-1 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                To
              </p>
              <p className="mt-0.5 truncate text-xs font-bold text-white md:text-sm">Kingston, JA</p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-white/70">{SHORT_LINE}</p>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-boss-gold" strokeWidth={2} />
            <div>
              <p className="text-[11px] font-bold text-white">Less waiting</p>
              <p className="mt-0.5 text-[10px] leading-snug text-white/55">No long Miami holds</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-boss-green" strokeWidth={2} />
            <div>
              <p className="text-[11px] font-bold text-white">Faster to yaad</p>
              <p className="mt-0.5 text-[10px] leading-snug text-white/55">3 departures weekly</p>
            </div>
          </div>
        </div>
      </div>

      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 right-4 select-none text-5xl font-black text-white/[0.04]"
      >
        BOSS
      </span>
    </div>
  )
}
