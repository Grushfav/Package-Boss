import { Link } from 'react-router-dom'
import { TAGLINE } from '../../content/marketing'
import { Button } from '../ui/Button'
import { SocialLinks } from './SocialLinks'

export function Hero() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px w-8 bg-boss-green" />
        <span className="text-sm font-semibold uppercase tracking-widest text-boss-gold">
          Ship Smart. Ship Easy.
        </span>
      </div>

      <h1 className="text-4xl font-black uppercase leading-tight md:text-5xl lg:text-6xl">
        Ship like a{' '}
        <span className="italic text-boss-gold">Boss!</span>
      </h1>

      <p className="mt-6 text-lg text-muted">{TAGLINE}</p>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link to="/signup">
          <Button>Get Your Fort Lauderdale Address →</Button>
        </Link>
        <Link to="/rates">
          <Button variant="outline">View Rates</Button>
        </Link>
      </div>

      <SocialLinks className="mt-8" />
    </div>
  )
}
