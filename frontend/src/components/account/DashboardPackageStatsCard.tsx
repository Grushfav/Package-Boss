import { DollarSign, MapPin, PackageCheck, Plane } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyPackages } from '../../api/packages'
import {
  computeDashboardPackageStats,
  formatDashboardTotalDue,
  type DashboardPackageStats,
} from '../../lib/dashboardStats'

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: typeof DollarSign
  label: string
  value: string
  sub?: string
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-boss-green/10 text-boss-green">
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
    </div>
  )
}

export function DashboardPackageStatsCard() {
  const [stats, setStats] = useState<DashboardPackageStats>({
    totalDueJmd: 0,
    readyPickupDelivery: 0,
    receivedFortLauderdale: 0,
    inTransit: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMyPackages()
      .then((packages) => setStats(computeDashboardPackageStats(packages)))
      .catch(() =>
        setStats({
          totalDueJmd: 0,
          readyPickupDelivery: 0,
          receivedFortLauderdale: 0,
          inTransit: 0,
        }),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Package overview</p>
        <Link
          to="/dashboard/packages"
          className="text-xs font-semibold text-boss-green hover:underline"
        >
          View all packages →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Total due"
          value={stats.totalDueJmd > 0 ? formatDashboardTotalDue(stats.totalDueJmd) : 'J$0'}
          sub="Published bills awaiting payment"
          loading={loading}
        />
        <StatCard
          icon={PackageCheck}
          label="Ready pickup / delivery"
          value={String(stats.readyPickupDelivery)}
          sub="Ready for pickup or delivery"
          loading={loading}
        />
        <StatCard
          icon={MapPin}
          label="Received at Fort Lauderdale"
          value={String(stats.receivedFortLauderdale)}
          sub="At our US warehouse"
          loading={loading}
        />
        <StatCard
          icon={Plane}
          label="In transit"
          value={String(stats.inTransit)}
          sub="En route to Jamaica"
          loading={loading}
        />
      </div>
    </div>
  )
}
