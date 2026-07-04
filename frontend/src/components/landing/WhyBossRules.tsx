import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { SERVICES } from '../../content/marketing'

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
    <section className="border-t border-border px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black uppercase md:text-3xl">
              <span className="border-b-4 border-boss-gold pb-1">Our</span>{' '}
              <span className="italic text-boss-gold">Services</span>
            </h2>
            <Link to="/services" className="mt-2 inline-block text-sm text-boss-gold hover:underline">
              View all services →
            </Link>
          </div>

          <div className="hidden shrink-0 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scrollCards('left')}
              aria-label="Scroll services left"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-boss-gold hover:text-boss-gold"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scrollCards('right')}
              aria-label="Scroll services right"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-boss-gold hover:text-boss-gold"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="mt-10 flex gap-5 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {SERVICES.map((service, i) => {
            const Icon = service.icon
            const number = String(i + 1).padStart(2, '0')

            return (
              <article
                key={service.title}
                className="group relative min-w-[272px] flex-shrink-0 snap-start overflow-hidden rounded-2xl bg-boss-navy shadow-lg ring-1 ring-boss-gold/25 transition-all hover:-translate-y-1 hover:shadow-xl hover:ring-boss-gold/45 lg:min-w-0"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-boss-gold/20 blur-2xl transition-opacity group-hover:opacity-100"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-boss-gold/10 blur-2xl"
                />

                <span
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1 select-none text-6xl font-black leading-none text-boss-gold/30"
                >
                  {number}
                </span>

                <div className="relative z-10 flex h-full flex-col p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm">
                    <Icon className="h-5 w-5 text-boss-gold" strokeWidth={2} />
                  </div>

                  <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-boss-gold">
                    {service.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-white/70">
                    {service.summary}
                  </p>

                  <div
                    aria-hidden
                    className="mt-5 h-px w-full bg-gradient-to-r from-boss-gold/50 via-boss-gold/30 to-transparent"
                  />
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
