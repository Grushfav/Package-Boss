import {
  AlertTriangle,
  ArrowRight,
  PackagePlus,
  PackageSearch,
  Printer,
  RefreshCw,
  Warehouse,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWarehouseCounts } from '../context/WarehouseCountsContext'
import { IconBadge } from '../components/ui/IconBadge'
import { Button } from '../components/ui/Button'

interface InboxCardProps {
  to: string
  icon: typeof Printer
  title: string
  description: string
  count?: number
  urgent?: boolean
  actionLabel: string
}

function InboxCard({ to, icon: Icon, title, description, count, urgent, actionLabel }: InboxCardProps) {
  const showCount = count != null && count > 0

  return (
    <Link
      to={to}
      className={`group relative flex flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-boss-green/40 ${
        urgent && showCount ? 'border-amber-500/40' : 'border-border'
      }`}
    >
      {showCount && (
        <span
          className={`absolute right-4 top-4 rounded-full px-2 py-0.5 text-xs font-bold ${
            urgent ? 'bg-amber-500 text-black' : 'bg-boss-green text-black'
          }`}
        >
          {count}
        </span>
      )}
      <Icon className="h-7 w-7 text-boss-green" strokeWidth={2} />
      <h2 className="mt-3 font-bold uppercase tracking-wide">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-boss-green group-hover:underline">
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}

export function WarehouseHomePage() {
  const { counts, refresh } = useWarehouseCounts()

  return (
    <div className="px-4 py-8">
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
        <InboxCard
          to="/warehouse/print-queue"
          icon={Printer}
          title="Print queue"
          description="Labels queued during busy receival — batch print when ready."
          count={counts?.print_queue_pending}
          actionLabel={counts?.print_queue_pending ? 'Print labels' : 'Open queue'}
        />
        <InboxCard
          to="/warehouse/unidentified"
          icon={PackageSearch}
          title="Unidentified"
          description="Packages with no matching customer — assign owners when identified."
          count={counts?.unidentified_count}
          urgent
          actionLabel={counts?.unidentified_count ? 'Assign owners' : 'View queue'}
        />
        <InboxCard
          to="/warehouse/status?preset=received"
          icon={RefreshCw}
          title="Received"
          description="Packages received and waiting to go in transit."
          count={counts?.received_count}
          actionLabel="Bulk update status"
        />
        <InboxCard
          to="/warehouse/status?preset=today"
          icon={RefreshCw}
          title="Received today"
          description="All packages received today — review or update statuses."
          count={counts?.packages_today}
          actionLabel="View & update"
        />
        {counts && counts.pending_pre_alerts > 0 && (
          <InboxCard
            to="/warehouse/receive"
            icon={AlertTriangle}
            title="Pending pre-alerts"
            description="Customers expecting packages — match carrier tracking on receive."
            count={counts.pending_pre_alerts}
            urgent
            actionLabel="Go to receive"
          />
        )}
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
            className="text-xs text-boss-green hover:underline"
          >
            Refresh counts
          </button>
        </div>
      </div>
    </div>
  )
}
