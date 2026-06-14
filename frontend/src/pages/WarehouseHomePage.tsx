import { Activity, PackagePlus, RefreshCw, Users, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IconBadge } from '../components/ui/IconBadge'

const tools = [
  {
    to: '/warehouse/customers',
    icon: Users,
    title: 'Customers',
    description: 'Browse all customers, search by name, and start a receival.',
  },
  {
    to: '/warehouse/receive',
    icon: PackagePlus,
    title: 'Receive Package',
    description: 'Scan carrier barcode or find customer, weigh, and print a BOSS label.',
  },
  {
    to: '/warehouse/status',
    icon: RefreshCw,
    title: 'Update Status',
    description: 'Move a package through the shipment timeline.',
  },
  {
    to: '/warehouse/activity',
    icon: Activity,
    title: 'Activity Log',
    description: 'View package receive and status update history.',
  },
]

export function WarehouseHomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center gap-2.5">
        <IconBadge icon={Warehouse} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Warehouse</h1>
          <p className="text-sm text-muted">Miami operations hub</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-boss-green/40"
          >
            <tool.icon className="h-8 w-8 text-boss-green" strokeWidth={2} />
            <h2 className="mt-4 font-bold uppercase tracking-wide">{tool.title}</h2>
            <p className="mt-2 text-sm text-muted">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
