import { Bike, Warehouse } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchMyStaffLogisticsJobs } from '../api/logisticsJobs'
import { fetchWarehouseSummary } from '../api/staff'
import { HubCard } from '../components/ui/HubCard'
import { useAuth } from '../context/AuthContext'
import { isAdmin } from '../lib/roles'

export function ClerkHubPage() {
  const { user } = useAuth()
  const [floorAttention, setFloorAttention] = useState(0)
  const [floorUrgent, setFloorUrgent] = useState(false)
  const [deliveryCount, setDeliveryCount] = useState(0)

  useEffect(() => {
    fetchWarehouseSummary()
      .then((summary) => {
        setFloorAttention(
          summary.print_queue_pending + summary.unidentified_count + summary.pending_pre_alerts,
        )
        setFloorUrgent(summary.unidentified_count > 0)
      })
      .catch(() => {})

    fetchMyStaffLogisticsJobs('active')
      .then((jobs) => setDeliveryCount(jobs.length))
      .catch(() => {})
  }, [])

  if (isAdmin(user?.role)) {
    return <Navigate to="/warehouse/floor" replace />
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-black uppercase">Hi, {user?.first_name}</h1>
        <p className="mt-1 text-sm text-muted">Where would you like to go?</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <HubCard
          to="/warehouse/floor"
          icon={Warehouse}
          title="Floor"
          description="Receive packages, print labels, and update statuses."
          count={floorAttention > 0 ? floorAttention : undefined}
          urgent={floorUrgent}
          stat={floorAttention > 0 ? undefined : 'All clear'}
          statTone="success"
        />
        <HubCard
          to="/warehouse/local-delivery"
          icon={Bike}
          title="Delivery requests"
          description="Local pickup and drop-off jobs assigned to you."
          count={deliveryCount > 0 ? deliveryCount : undefined}
          stat={deliveryCount > 0 ? `${deliveryCount} active job${deliveryCount === 1 ? '' : 's'}` : 'No active jobs'}
          statTone={deliveryCount === 0 ? 'success' : 'default'}
        />
      </div>
    </div>
  )
}
