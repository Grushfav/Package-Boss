import { Link } from 'react-router-dom'
import { ABOUT_PARAGRAPHS, TAGLINE } from '../../content/marketing'
import { Button } from '../ui/Button'
import { ShippingFrequencyCard } from './ShippingFrequencyCard'

export function AboutPreview() {
  return (
    <section className="border-t border-border px-4 py-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
        <div>
          <h2 className="text-2xl font-black uppercase md:text-3xl">
            About <span className="italic text-boss-gold">Package Boss</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
            {ABOUT_PARAGRAPHS[0]}
          </p>
          <blockquote className="mt-5 border-l-4 border-boss-green pl-4 text-sm font-semibold italic text-boss-green md:text-base">
            {TAGLINE}
          </blockquote>
          <p className="mt-5 text-sm leading-relaxed text-muted">{ABOUT_PARAGRAPHS[1]}</p>
          <Link to="/about" className="mt-6 inline-block">
            <Button variant="outline">Read our full story →</Button>
          </Link>
        </div>

        <div className="lg:sticky lg:top-24">
          <ShippingFrequencyCard compact />
        </div>
      </div>
    </section>
  )
}
