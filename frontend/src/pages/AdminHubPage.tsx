import { BarChart3, UserCog, Warehouse } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchAdminOverview, fetchClerks } from '../api/admin'
import { fetchWarehouseSummary } from '../api/staff'
import { HubCard } from '../components/ui/HubCard'
import { useAuth } from '../context/AuthContext'
import type { AdminOverview } from '../types'

export function AdminHubPage() {
  const { user } = useAuth()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [activeClerks, setActiveClerks] = useState(0)
  const [warehouseAttention, setWarehouseAttention] = useState(0)
  const [warehouseUrgent, setWarehouseUrgent] = useState(false)

  useEffect(() => {
    fetchAdminOverview().then(setOverview).catch(() => {})
    fetchClerks()
      .then((clerks) => setActiveClerks(clerks.filter((c) => c.is_active !== false).length))
      .catch(() => {})
    fetchWarehouseSummary()
      .then((summary) => {
        setWarehouseAttention(
          summary.print_queue_pending + summary.unidentified_count + summary.pending_pre_alerts,
        )
        setWarehouseUrgent(summary.unidentified_count > 0)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-black uppercase">Hi, {user?.first_name}</h1>
        <p className="mt-1 text-sm text-muted">Where would you like to go?</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <HubCard
          to="/admin/operations"
          icon={BarChart3}
          title="Metrics"
          description="Volume, trends, revenue, and activity."
          stat={
            overview
              ? `${overview.packages_today} received today · $${overview.revenue_30d_usd.toFixed(0)} (30d)`
              : undefined
          }
        />
        <HubCard
          to="/admin/clerks"
          icon={UserCog}
          title="Clerks"
          description="Staff accounts, permissions, and invites."
          stat={`${activeClerks} active clerk${activeClerks === 1 ? '' : 's'}`}
        />
        <HubCard
          to="/warehouse"
          icon={Warehouse}
          title="Warehouse floor"
          description="Receive, print labels, and update statuses."
          count={warehouseAttention > 0 ? warehouseAttention : undefined}
          urgent={warehouseUrgent}
          stat={warehouseAttention > 0 ? undefined : 'All clear'}
          statTone="success"
        />
      </div>
    </div>
  )
}
