import { Scale } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { estimateRate } from '../../api/rates'
import { getErrorMessage } from '../../api/client'
import { Button } from '../ui/Button'
import { IconBadge } from '../ui/IconBadge'
import { Input } from '../ui/Input'

export function ShippingEstimator() {
  const [weight, setWeight] = useState('1.0')
  const [estimate, setEstimate] = useState<{
    cost_usd: number
    billable_weight_lbs: number
    actual_weight_lbs: number
    tier_label: string
    route: string
  } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function calculate() {
    setError('')
    setLoading(true)
    try {
      const result = await estimateRate(parseFloat(weight))
      setEstimate(result)
    } catch (err) {
      setError(getErrorMessage(err))
      setEstimate(null)
    } finally {
      setLoading(false)
    }
  }

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
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Button onClick={calculate} disabled={loading} fullWidth>
            {loading ? 'Calculating...' : 'Calculate'}
          </Button>
        </div>

        <div className="flex flex-col justify-center rounded-xl border border-boss-green/20 bg-accent-subtle p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Estimated Rate
          </p>
          {estimate ? (
            <>
              <p className="mt-2 text-3xl font-black text-boss-green">
                ${estimate.cost_usd.toFixed(2)} USD
              </p>
              <p className="mt-2 text-sm italic text-muted">{estimate.route}</p>
              {estimate.billable_weight_lbs !== estimate.actual_weight_lbs && (
                <p className="mt-2 text-xs text-boss-gold">
                  {estimate.actual_weight_lbs} lb billed as {estimate.billable_weight_lbs} lb
                </p>
              )}
              <p className="mt-1 text-xs text-muted">{estimate.tier_label}</p>
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
          *Weights are rounded up to the nearest whole pound.
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
