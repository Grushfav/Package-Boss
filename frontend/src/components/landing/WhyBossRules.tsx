import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Gauge,
  LocateFixed,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useRef } from 'react'

const features: {
  title: string
  description: string
  icon: LucideIcon
}[] = [
  {
    title: 'Competitive Rates',
    description: 'The best USD pricing for every pound you ship.',
    icon: Banknote,
  },
  {
    title: 'Safe & Secure',
    description: 'Industrial-grade handling for your precious cargo.',
    icon: ShieldCheck,
  },
  {
    title: 'Fast Delivery',
    description: 'Next-day local processing once landed in JA.',
    icon: Gauge,
  },
  {
    title: 'Real-Time Tracking',
    description: 'Watch your package move from warehouse to door.',
    icon: LocateFixed,
  },
]

const CARD_SCROLL_AMOUNT = 300

export function WhyBossRules() {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scrollCards(direction: 'left' | 'right') {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -CARD_SCROLL_AMOUNT : CARD_SCROLL_AMOUNT,
      behavior: 'smooth',
    })
  }

  return (
    <section className="border-t border-border bg-card px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-black uppercase md:text-3xl">
            <span className="border-b-4 border-boss-gold pb-1">Why the</span>{' '}
            <span className="italic text-boss-green">Boss</span> Rules
          </h2>

          <div className="hidden shrink-0 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scrollCards('left')}
              aria-label="Scroll features left"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:border-boss-green hover:text-boss-green"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scrollCards('right')}
              aria-label="Scroll features right"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:border-boss-green hover:text-boss-green"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="mt-10 flex gap-5 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {features.map((feature, i) => {
            const Icon = feature.icon
            const number = String(i + 1).padStart(2, '0')

            return (
              <div
                key={feature.title}
                className="relative min-w-[260px] flex-shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-background p-6 lg:min-w-0"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1 select-none text-6xl font-black leading-none text-foreground/[0.06] dark:text-foreground/[0.08]"
                >
                  {number}
                </span>

                <div className="relative z-10">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-boss-green/30 bg-boss-green/15">
                    <Icon className="h-5 w-5 text-boss-green" strokeWidth={1.75} />
                  </div>

                  <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-boss-gold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {feature.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
