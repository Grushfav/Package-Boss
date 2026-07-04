import { Link } from 'react-router-dom'
import {
  DELIVERY_AREAS,
  PICKUP_DAYS,
  SERVICES,
  SHIPPING_FREQUENCY_SHORT,
} from '../content/marketing'
import { Seo } from '../components/seo/Seo'
import { Button } from '../components/ui/Button'
import { ShippingFrequencyCard } from '../components/landing/ShippingFrequencyCard'
import { PAGE_SEO } from '../lib/seo'

export function ServicesPage() {
  return (
    <div className="px-4 py-12">
      <Seo {...PAGE_SEO.services} />
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-boss-gold">Services</p>
        <h1 className="mt-2 text-3xl font-black uppercase md:text-4xl">
          How we <span className="italic text-boss-gold">ship it</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          From Fort Lauderdale receival to yaad — {SHIPPING_FREQUENCY_SHORT} from our Florida warehouse, plus
          tracking, notifications, and flexible delivery across Jamaica.
        </p>

        <div className="mx-auto mt-8 max-w-sm">
          <ShippingFrequencyCard />
        </div>

        <ul className="mt-12 space-y-8">
          {SERVICES.map((service) => {
            const Icon = service.icon
            return (
              <li
                key={service.title}
                className="flex gap-5 rounded-2xl border border-border bg-card p-6 md:p-8"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-boss-gold/30 bg-boss-gold/15">
                  <Icon className="h-6 w-6 text-boss-gold" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wide text-boss-gold">
                    {service.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{service.description}</p>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mt-12 rounded-2xl border border-boss-gold/30 bg-boss-gold/5 p-6 md:p-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-boss-gold">
            Delivery &amp; pickup at a glance
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>
              <span className="font-semibold text-foreground">Flights:</span>{' '}
              {SHIPPING_FREQUENCY_SHORT} from Fort Lauderdale
            </li>
            <li>
              <span className="font-semibold text-foreground">Delivery:</span> {DELIVERY_AREAS} on
              designated days (fee applies)
            </li>
            <li>
              <span className="font-semibold text-foreground">Pickup:</span> Drop-off points open{' '}
              {PICKUP_DAYS}
            </li>
            <li>
              <span className="font-semibold text-foreground">Islandwide:</span> Knutsford Express
              and Zipmail for areas outside Kingston and Portmore
            </li>
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link to="/signup">
            <Button>Sign up free</Button>
          </Link>
          <Link to="/rates">
            <Button variant="outline">View rates</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
