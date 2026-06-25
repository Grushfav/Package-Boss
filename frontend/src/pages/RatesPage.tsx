import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchRates } from '../api/rates'
import { getErrorMessage } from '../api/client'
import { ShippingEstimator } from '../components/landing/ShippingEstimator'
import { ShippingFrequencyCard } from '../components/landing/ShippingFrequencyCard'
import { useAuth } from '../context/AuthContext'
import { getHomeRoute } from '../lib/routing'

export function RatesPage() {
  const { user, isAuthenticated } = useAuth()
  const isCustomer = !user?.role || user.role === 'customer'

  if (isAuthenticated && !isCustomer) {
    return <Navigate to={getHomeRoute(user?.role)} replace />
  }

  return <RatesPageContent />
}

export function RatesPageContent({ embedded = false }: { embedded?: boolean } = {}) {
  const [tiers, setTiers] = useState<Awaited<ReturnType<typeof fetchRates>>['tiers']>([])
  const [roundingNote, setRoundingNote] = useState('')
  const [formulaNote, setFormulaNote] = useState('')
  const [quoteNote, setQuoteNote] = useState('')
  const [jmdPerUsd, setJmdPerUsd] = useState(160)
  const [maxLbs, setMaxLbs] = useState(30)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRates()
      .then((data) => {
        setTiers(data.tiers)
        setRoundingNote(data.rounding_note)
        setFormulaNote(data.formula_note)
        setQuoteNote(data.quote_note)
        setJmdPerUsd(data.jmd_per_usd)
        setMaxLbs(data.max_auto_rate_lbs)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={embedded ? '' : 'px-4 py-12'}>
      <div className={embedded ? '' : 'mx-auto max-w-4xl'}>
        {!embedded && (
          <>
            <h1 className="text-3xl font-black uppercase">
              Package <span className="italic text-boss-green">Rates</span>
            </h1>
            <p className="mt-2 text-muted">Miami → Jamaica · USD &amp; JMD ({jmdPerUsd} JMD = 1 USD)</p>
          </>
        )}
        {embedded && (
          <>
            <h2 className="text-lg font-bold uppercase tracking-wide">Rates</h2>
            <p className="mt-2 text-sm text-muted">
              Miami → Jamaica · USD &amp; JMD ({jmdPerUsd} JMD = 1 USD)
            </p>
          </>
        )}

        <div className={`mx-auto max-w-sm ${embedded ? 'mt-4' : 'mt-8'}`}>
          <ShippingFrequencyCard />
        </div>

        <div className="mt-8">
          <ShippingEstimator />
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">Rate table (1–{maxLbs} lbs)</h2>
            {formulaNote && <p className="mt-2 text-sm text-muted">{formulaNote}</p>}
          </div>

          {loading && (
            <p className="px-6 py-8 text-muted">Loading rates...</p>
          )}

          {error && (
            <p className="px-6 py-8 text-red-500">{error}</p>
          )}

          {!loading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px]">
                  <thead>
                    <tr className="bg-background text-left text-sm font-semibold text-muted">
                      <th className="px-6 py-4">Weight</th>
                      <th className="px-6 py-4 text-right">USD</th>
                      <th className="px-6 py-4 text-right">JMD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier, i) => (
                      <tr
                        key={tier.weight_lbs}
                        className={i % 2 === 0 ? 'bg-card' : 'bg-background/50'}
                      >
                        <td className="border-t border-border px-6 py-3 text-muted">
                          {tier.label}
                        </td>
                        <td className="border-t border-border px-6 py-3 text-right font-bold text-foreground">
                          {tier.rate_display_usd}
                        </td>
                        <td className="border-t border-border px-6 py-3 text-right font-semibold text-muted">
                          {tier.rate_display_jmd}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 border-t border-border px-6 py-4 text-sm text-muted">
                <p>{roundingNote}</p>
                <p className="text-amber-400/90">{quoteNote}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
