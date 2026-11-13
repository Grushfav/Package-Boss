import { BarChart3, FileText, Megaphone, Truck, UserCog, Users, Warehouse } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchAdminOverview, fetchClerks } from '../api/admin'
import { getErrorMessage } from '../api/client'
import { fetchWarehouseSummary } from '../api/staff'
import { HubCard } from '../components/ui/HubCard'
import { LoadErrorBanner } from '../components/ui/LoadErrorBanner'
import { useAuth } from '../context/AuthContext'
import type { AdminOverview } from '../types'

export function AdminHubPage() {
  const { user } = useAuth()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [activeClerks, setActiveClerks] = useState(0)
  const [warehouseAttention, setWarehouseAttention] = useState(0)
  const [warehouseUrgent, setWarehouseUrgent] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoadError('')
    fetchAdminOverview()
      .then((data) => {
        if (!cancelled) setOverview(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err))
      })
    fetchClerks()
      .then((clerks) => {
        if (!cancelled) setActiveClerks(clerks.filter((c) => c.is_active !== false).length)
      })
      .catch(() => {})
    fetchWarehouseSummary()
      .then((summary) => {
        if (!cancelled) {
          setWarehouseAttention(
            summary.print_queue_pending + summary.unidentified_count + summary.pending_pre_alerts,
          )
          setWarehouseUrgent(summary.unidentified_count > 0)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-10">
      {/* Soft atmosphere so frosted hub cards have something to refract */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-16 top-8 h-56 w-56 rounded-full bg-boss-gold/15 blur-3xl" />
        <div className="absolute right-0 top-24 h-64 w-64 rounded-full bg-boss-green/10 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-48 w-48 rounded-full bg-boss-navy/40 blur-3xl" />
      </div>

      <header className="mb-10">
        <h1 className="text-2xl font-black uppercase">Hi, {user?.first_name}</h1>
        <p className="mt-1 text-sm text-muted">Where would you like to go?</p>
      </header>

      {loadError && (
        <LoadErrorBanner
          className="mb-6"
          message={loadError}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <HubCard
          to="/admin/operations"
          icon={BarChart3}
          title="Metrics"
          description="Volume, trends, revenue, and activity."
          accent="green"
          stat={
            overview
              ? `${overview.packages_today} received today · $${overview.revenue_30d_usd.toFixed(0)} (30d)`
              : undefined
          }
        />
        <HubCard
          to="/warehouse"
          icon={Warehouse}
          title="Warehouse floor"
          description="Receive, print labels, and update statuses."
          count={warehouseAttention > 0 ? warehouseAttention : undefined}
          urgent={warehouseUrgent}
          accent="gold"
          stat={warehouseAttention > 0 ? undefined : 'All clear'}
          statTone="success"
        />
        <HubCard
          to="/warehouse/customers"
          icon={Users}
          title="Directory"
          description="Look up customers by name, email, or BOSS ID."
          accent="gold"
        />
        <HubCard
          to="/admin/invoices"
          icon={FileText}
          title="Invoices"
          description="Recorded payments by date for accounting."
        />
        <HubCard
          to="/warehouse/requests"
          icon={Truck}
          title="Local delivery"
          description="Home delivery requests and runs."
          stat={
            overview
              ? `${overview.delivery_requests_active} active request${overview.delivery_requests_active === 1 ? '' : 's'}`
              : undefined
          }
        />
        <HubCard
          to="/admin/announcements"
          icon={Megaphone}
          title="Announcements"
          description="Site banners and customer broadcasts."
        />
        <HubCard
          to="/admin/clerks"
          icon={UserCog}
          title="Clerks"
          description="Staff accounts, permissions, and invites."
          stat={`${activeClerks} active clerk${activeClerks === 1 ? '' : 's'}`}
        />
      </div>
    </div>
  )
}
