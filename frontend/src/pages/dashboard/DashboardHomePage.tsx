import { Link } from 'react-router-dom'
import { DashboardPackageStatsCard } from '../../components/account/DashboardPackageStatsCard'
import { FortLauderdaleShippingAddressCard } from '../../components/account/FortLauderdaleShippingAddressCard'
import { useAuth } from '../../context/AuthContext'

export function DashboardHomePage() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold uppercase tracking-wide">Dashboard</h2>
        <p className="mt-2 text-sm text-muted">
          Welcome, {user?.first_name}. 
        </p>
      </div>

      <DashboardPackageStatsCard />

      <FortLauderdaleShippingAddressCard />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/pre-alerts/new"
          className="rounded-xl border border-boss-gold/30 bg-card p-4 text-sm font-semibold shadow-sm shadow-boss-gold/15 transition-colors hover:border-boss-gold/50 hover:shadow-md hover:shadow-boss-gold/25"
        >
          Pre-alert a shipment →
        </Link>
        <Link
          to="/dashboard/packages"
          className="rounded-xl border border-boss-gold/30 bg-card p-4 text-sm font-semibold shadow-sm shadow-boss-gold/15 transition-colors hover:border-boss-gold/50 hover:shadow-md hover:shadow-boss-gold/25"
        >
          View packages →
        </Link>
        <Link
          to="/dashboard/profile"
          className="rounded-xl border border-boss-gold/30 bg-card p-4 text-sm font-semibold shadow-sm shadow-boss-gold/15 transition-colors hover:border-boss-gold/50 hover:shadow-md hover:shadow-boss-gold/25"
        >
          Manage delivery addresses →
        </Link>
        <Link
          to="/dashboard/bank-transfer"
          className="rounded-xl border border-boss-gold/30 bg-card p-4 text-sm font-semibold shadow-sm shadow-boss-gold/15 transition-colors hover:border-boss-gold/50 hover:shadow-md hover:shadow-boss-gold/25"
        >
          Bank transfer details →
        </Link>
      </div>
    </div>
  )
}
