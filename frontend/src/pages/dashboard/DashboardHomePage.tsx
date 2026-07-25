import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardPackageStatsCard } from '../../components/account/DashboardPackageStatsCard'
import { BankTransferDetailsModal, bankTransferGridCardClassName } from '../../components/account/BankTransferDetailsCard'
import { FortLauderdaleShippingAddressCard } from '../../components/account/FortLauderdaleShippingAddressCard'
import { useAuth } from '../../context/AuthContext'
import { SHIPPING_FREQUENCY_SHORT } from '../../content/marketing'

export function DashboardHomePage() {
  const { user } = useAuth()
  const [bankTransferOpen, setBankTransferOpen] = useState(false)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold uppercase tracking-wide">Dashboard</h2>
        <p className="mt-2 text-sm text-muted">
          Welcome, {user?.first_name}. Packages ship from Fort Lauderdale to Jamaica{' '}
          <span className="font-semibold text-boss-gold">{SHIPPING_FREQUENCY_SHORT}</span>.
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
          to="/dashboard/delivery-address"
          className="rounded-xl border border-boss-gold/30 bg-card p-4 text-sm font-semibold shadow-sm shadow-boss-gold/15 transition-colors hover:border-boss-gold/50 hover:shadow-md hover:shadow-boss-gold/25"
        >
          Manage delivery addresses →
        </Link>
        <button
          type="button"
          onClick={() => setBankTransferOpen(true)}
          className={bankTransferGridCardClassName}
        >
          Bank transfer details →
        </button>
      </div>

      <BankTransferDetailsModal
        open={bankTransferOpen}
        onClose={() => setBankTransferOpen(false)}
      />
    </div>
  )
}
