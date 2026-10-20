import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DashboardPackageStatsCard } from '../../components/account/DashboardPackageStatsCard'
import { FortLauderdaleShippingAddressCard } from '../../components/account/FortLauderdaleShippingAddressCard'
import { useAuth } from '../../context/AuthContext'
import { useCustomerData } from '../../context/CustomerDataContext'
import type { DeliveryAddress } from '../../types'

function deliveryAddressLine(address: DeliveryAddress) {
  return [address.line1, address.line2, address.community, address.parish]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
}

export function DashboardHomePage() {
  const { user } = useAuth()
  const { deliveryAddresses, isPrefetching } = useCustomerData()
  const defaultAddress = deliveryAddresses.find((address) => address.is_default)
  const addressLine = defaultAddress ? deliveryAddressLine(defaultAddress) : ''

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold uppercase tracking-wide">Dashboard</h2>
        <p className="mt-2 text-sm text-muted">Welcome, {user?.first_name}.</p>
        {!isPrefetching && (
          <Link
            to="/dashboard/profile#delivery-addresses"
            title={addressLine || 'Manage delivery addresses'}
            className="mt-3 flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-border bg-card py-1.5 pl-3 pr-1.5 text-sm transition-colors hover:border-boss-gold/40"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-boss-gold" />
            {defaultAddress ? (
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{defaultAddress.label}</span>
                {addressLine && <span className="text-muted"> · {addressLine}</span>}
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-muted">No default delivery address</span>
            )}
            <span className="shrink-0 rounded-full bg-boss-gold/10 px-2.5 py-1 text-xs font-semibold text-boss-gold">
              {defaultAddress ? 'Change' : 'Add'}
            </span>
          </Link>
        )}
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
