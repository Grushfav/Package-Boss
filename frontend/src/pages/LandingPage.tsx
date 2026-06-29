import { Link } from 'react-router-dom'
import { AboutPreview } from '../components/landing/AboutPreview'
import { BossMemberLogin } from '../components/landing/BossMemberLogin'
import { Hero } from '../components/landing/Hero'
import { ShippingEstimator } from '../components/landing/ShippingEstimator'
import { WhyBossRules } from '../components/landing/WhyBossRules'
import { Button } from '../components/ui/Button'

export function LandingPage() {
  return (
    <>
      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:gap-12">
          <Hero />
          <BossMemberLogin />
        </div>
      </section>

      <section className="border-t border-border px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <ShippingEstimator />
        </div>
      </section>

      <AboutPreview />

  
      <WhyBossRules /> <section className="border-t border-border px-4 py-16">
        <div className="mx-auto max-w-6xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm md:p-12">
          <h2 className="text-2xl font-black uppercase md:text-3xl">
            Ready to ship like a <span className="italic text-boss-green">Boss?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Sign up today and get your dedicated Fort Lauderdale warehouse address instantly.
            Always put your BOSS ID on address line 2 when shopping online.
          </p>
          <Link to="/signup" className="mt-8 inline-block">
            <Button>Claim My Address Now</Button>
          </Link>
        </div>
      </section>


    </>
  )
}
