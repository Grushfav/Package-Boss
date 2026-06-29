import { Link } from 'react-router-dom'
import { ABOUT_PARAGRAPHS, TAGLINE } from '../content/marketing'
import { Button } from '../components/ui/Button'
import { ShippingFrequencyCard } from '../components/landing/ShippingFrequencyCard'

export function AboutPage() {
  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-boss-green">About Us</p>
        <h1 className="mt-2 text-3xl font-black uppercase md:text-4xl">
          Your trusted partner{' '}
          <span className="italic text-boss-green">US → Jamaica</span>
        </h1>

        <div className="mx-auto mt-10 max-w-sm">
          <ShippingFrequencyCard />
        </div>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-muted md:text-base">
          {ABOUT_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>

        <blockquote className="mt-10 border-l-4 border-boss-gold pl-6 text-lg font-semibold italic text-foreground">
          {TAGLINE}
        </blockquote>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link to="/signup">
            <Button>Get your Fort Lauderdale address</Button>
          </Link>
          <Link to="/services">
            <Button variant="outline">View our services</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
