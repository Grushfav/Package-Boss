import { Link } from 'react-router-dom'
import { BookLogisticsForm } from '../../components/logistics/BookLogisticsForm'
import { IconBadge } from '../../components/ui/IconBadge'
import { Truck } from 'lucide-react'

export function BookLogisticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard/logistics"
          className="text-sm font-semibold text-muted hover:text-foreground"
        >
          ← Back to local delivery
        </Link>
        <div className="mt-4 flex items-center gap-2.5">
          <IconBadge icon={Truck} size="sm" />
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wide">Book local delivery</h2>
            <p className="mt-1 text-sm text-muted">Pickup and drop-off anywhere in Jamaica.</p>
          </div>
        </div>
      </div>
      <BookLogisticsForm />
    </div>
  )
}
