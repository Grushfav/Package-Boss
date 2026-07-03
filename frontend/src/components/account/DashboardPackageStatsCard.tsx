import { DollarSign, MapPin, PackageCheck, Plane } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  computeDashboardPackageStats,
  formatDashboardTotalDue,
} from '../../lib/dashboardStats'
import { useCustomerData } from '../../context/CustomerDataContext'

function StatCard({
  to,
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  to: string
  icon: typeof DollarSign
  label: string
  value: string
  sub?: string
  loading: boolean
}) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-boss-gold/30 bg-card p-6 shadow-md shadow-boss-gold/20 transition-colors hover:border-boss-gold/50 hover:shadow-lg hover:shadow-boss-gold/25"
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-boss-gold/15 text-boss-gold">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
          {loading ? (
            <p className="mt-2 text-sm text-muted">—</p>
          ) : (
            <>
              <p className="mt-1 text-2xl font-black text-foreground">{value}</p>
              {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

export function DashboardPackageStatsCard() {
  const { packages, packagesLoading } = useCustomerData()
  const stats = computeDashboardPackageStats(packages)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Package overview</p>
        <Link
          to="/dashboard/packages"
          className="text-xs font-semibold text-boss-gold hover:underline"
        >
          View all packages →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          to="/dashboard/packages"
          icon={MapPin}
          label="Received"
          value={String(stats.receivedFortLauderdale)}
          sub="At our Fort Lauderdale warehouse"
          loading={packagesLoading}
        />
        <StatCard
          to="/dashboard/packages"
          icon={Plane}
          label="In transit"
          value={String(stats.inTransit)}
          sub="En route to Jamaica"
          loading={packagesLoading}
        />
        <StatCard
          to="/dashboard/packages"
          icon={PackageCheck}
          label="Ready pickup / delivery"
          value={String(stats.readyPickupDelivery)}
          sub="Ready for pickup or delivery"
          loading={packagesLoading}
        />
        <StatCard
          to="/dashboard/packages"
          icon={DollarSign}
          label="Total due"
          value={stats.totalDueJmd > 0 ? formatDashboardTotalDue(stats.totalDueJmd) : 'J$0'}
          sub="Published bills awaiting payment"
          loading={packagesLoading}
        />
      </div>
    </div>
  )
}
