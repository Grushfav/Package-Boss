import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchRates, type RateTier } from '../api/rates'
import { getErrorMessage } from '../api/client'
import { ShippingEstimator } from '../components/landing/ShippingEstimator'
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

function RatesPageContent() {
  const [tiers, setTiers] = useState<RateTier[]>([])
  const [roundingNote, setRoundingNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRates()
      .then((data) => {
        setTiers(data.tiers)
        setRoundingNote(data.rounding_note)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-black uppercase">
          Package <span className="italic text-boss-green">Rates</span>
        </h1>
        <p className="mt-2 text-muted">Miami → Kingston shipping rates in USD.</p>

        <div className="mt-8">
          <ShippingEstimator />
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">Package Rates</h2>
          </div>

          {loading && (
            <p className="px-6 py-8 text-muted">Loading rates...</p>
          )}

          {error && (
            <p className="px-6 py-8 text-red-500">{error}</p>
          )}

          {!loading && !error && (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-background text-left text-sm font-semibold text-muted">
                    <th className="px-6 py-4">Weight</th>
                    <th className="px-6 py-4 text-right">Rate (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier, i) => (
                    <tr
                      key={tier.label}
                      className={i % 2 === 0 ? 'bg-card' : 'bg-background/50'}
                    >
                      <td className="border-t border-border px-6 py-4 text-muted">
                        {tier.label}
                      </td>
                      <td className="border-t border-border px-6 py-4 text-right font-bold text-foreground">
                        {tier.rate_display}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-6 py-4 text-sm text-muted">
                {roundingNote}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
