import { Scale } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { estimateRate, fetchRates } from '../../api/rates'
import { getErrorMessage } from '../../api/client'
import { Button } from '../ui/Button'
import { IconBadge } from '../ui/IconBadge'
import { Input } from '../ui/Input'

const DEFAULT_MAX_AUTO_LBS = 50

export function ShippingEstimator() {
  const [maxAutoLbs, setMaxAutoLbs] = useState(DEFAULT_MAX_AUTO_LBS)
  const [weight, setWeight] = useState('1.0')
  const [estimate, setEstimate] = useState<{
    cost_usd: number
    cost_jmd: number
    billable_weight_lbs: number
    actual_weight_lbs: number
    tier_label: string
    route: string
    jmd_per_usd: number
  } | null>(null)
  const [requiresQuote, setRequiresQuote] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function calculate() {
    setError('')
    setRequiresQuote(false)
    setEstimate(null)
    setLoading(true)
    try {
      const w = parseFloat(weight)
      if (w > maxAutoLbs) {
        setRequiresQuote(true)
        return
      }
      const result = await estimateRate(w)
      setEstimate(result)
    } catch (err) {
      const msg = getErrorMessage(err)
      if (msg.toLowerCase().includes('custom quote')) {
        setRequiresQuote(true)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRates()
      .then((data) => setMaxAutoLbs(data.max_auto_rate_lbs))
      .catch(() => setMaxAutoLbs(DEFAULT_MAX_AUTO_LBS))
  }, [])

  useEffect(() => {
    calculate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={Scale} size="sm" />
        <h2 className="text-sm font-bold uppercase tracking-wide">Estimate Your Shipping</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Input
            label="Weight (lbs)"
            type="number"
            min="0.1"
            step="0.1"
            max={maxAutoLbs}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Button onClick={calculate} disabled={loading} fullWidth>
            {loading ? 'Calculating...' : 'Calculate'}
          </Button>
        </div>

        <div className="flex flex-col justify-center rounded-xl border border-boss-green/20 bg-accent-subtle p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Estimated Freight
          </p>
          {requiresQuote ? (
            <>
              <p className="mt-3 text-lg font-bold text-amber-400">Custom quote required</p>
              <p className="mt-2 text-sm text-muted">
                Packages over {maxAutoLbs} lbs need a quote from Package Boss Shipping &amp;
                Logistics.
              </p>
              <a
                href="mailto:support@packageboss.com"
                className="mt-3 text-sm font-semibold text-boss-green hover:underline"
              >
                Request a quote →
              </a>
            </>
          ) : estimate ? (
            <>
              <p className="mt-2 text-3xl font-black text-boss-green">
                ${estimate.cost_usd.toFixed(2)} USD
              </p>
              <p className="mt-1 text-xl font-bold text-muted">
                ${estimate.cost_jmd.toLocaleString()} JMD
              </p>
              <p className="mt-2 text-sm italic text-muted">{estimate.route}</p>
              {estimate.billable_weight_lbs !== estimate.actual_weight_lbs && (
                <p className="mt-2 text-xs text-boss-gold">
                  {estimate.actual_weight_lbs} lb billed as {estimate.billable_weight_lbs} lb
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                {estimate.tier_label} · {estimate.jmd_per_usd} JMD = 1 USD
              </p>
            </>
          ) : (
            <p className="mt-2 text-muted">Enter weight to estimate</p>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          *Freight estimates only — weights rounded up to the nearest pound. Duties, handling, and
          other charges may apply after invoice review.
        </p>
        <Link to="/rates">
          <Button variant="outline" className="!border-boss-gold !text-boss-gold hover:!bg-boss-gold/10">
            View Full Rate Table
          </Button>
        </Link>
      </div>
    </div>
  )
}
