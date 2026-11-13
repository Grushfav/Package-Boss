import {
  PackagePlus,
  Plane,
  Printer,
  RefreshCw,
  Warehouse,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWarehouseCounts } from '../context/WarehouseCountsContext'
import { IconBadge } from '../components/ui/IconBadge'
import { Button } from '../components/ui/Button'
import { HubCard } from '../components/ui/HubCard'

export function WarehouseHomePage() {
  const { counts, refresh } = useWarehouseCounts()

  return (
    <div className="relative px-4 py-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-10 top-6 h-48 w-48 rounded-full bg-boss-gold/12 blur-3xl" />
        <div className="absolute right-4 top-20 h-52 w-52 rounded-full bg-boss-green/10 blur-3xl" />
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <IconBadge icon={Warehouse} size="sm" />
          <div>
            <h1 className="text-2xl font-black uppercase">Floor</h1>
            <p className="text-sm text-muted">What needs attention right now</p>
          </div>
        </div>
        <Link to="/warehouse/receive">
          <Button className="inline-flex items-center gap-2">
            <PackagePlus className="h-4 w-4" />
            Receive package
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard
          to="/warehouse/status?preset=received"
          icon={RefreshCw}
          title="Received"
          description="Packages received and waiting to go in transit."
          count={counts?.received_count}
        />
        <HubCard
          to="/warehouse/status?preset=today"
          icon={RefreshCw}
          title="Received today"
          description="All packages received today — review or update statuses."
          count={counts?.packages_today}
        />
        <HubCard
          to="/warehouse/departures"
          icon={Plane}
          title="Departures"
          description="Group received packages by shipment before marking in transit."
          count={counts?.open_shipments}
        />
        <HubCard
          to="/warehouse/print-queue"
          icon={Printer}
          title="Print queue"
          description="Labels queued during busy receival — batch print when ready."
          count={counts?.print_queue_pending}
        />
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Quick links</p>
            <p className="text-xs text-muted">Customer directory, activity log, and more in the sidebar.</p>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            className="text-xs text-boss-gold hover:underline"
          >
            Refresh counts
          </button>
        </div>
      </div>
    </div>
  )
}
