import { Link } from 'react-router-dom'
import { SocialLinks } from '../landing/SocialLinks'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <p className="text-xl font-black italic">
            <span className="text-foreground">PACKAGE </span>
            <span className="text-boss-gold">BOSS</span>
          </p>
          <p className="mt-3 text-sm text-muted">
            Package Boss Shipping &amp; Logistics — international air freight and package shipping
            from Fort Lauderdale to Jamaica.
          </p>
          <SocialLinks className="mt-6" />
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-boss-gold">Warehouse</h4>
          <p className="mt-3 text-sm text-muted">
            2201 SW 59th Terrace <br />
            West Park, FL 33023<br />
            United States
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-boss-gold">Quick Actions</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link to="/about" className="hover:text-boss-green">About Us</Link></li>
            <li><Link to="/services" className="hover:text-boss-green">Services</Link></li>
            <li><Link to="/track" className="hover:text-boss-green">Track My Package</Link></li>
            <li><Link to="/rates" className="hover:text-boss-green">View Rates</Link></li>
            <li><Link to="/terms" className="hover:text-boss-green">Terms &amp; Conditions</Link></li>
            <li><Link to="/signup" className="hover:text-boss-green">Sign Up</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Package Boss Shipping &amp; Logistics. Terms effective June 21, 2026.
      </div>
    </footer>
  )
}
