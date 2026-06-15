import {
  Activity,
  LayoutDashboard,
  PackagePlus,
  PackageSearch,
  Printer,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { WarehouseCountsProvider, useWarehouseCounts } from '../../context/WarehouseCountsContext'
import { CommandPalette, openCommandPalette } from '../warehouse/CommandPalette'
import { CustomerQuickSearch } from '../warehouse/CustomerQuickSearch'

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto rounded-full bg-boss-green px-1.5 py-0.5 text-[10px] font-bold text-black">
      {count > 99 ? '99+' : count}
    </span>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-boss-green/15 text-boss-green'
      : 'text-muted hover:bg-card hover:text-foreground'
  }`

function WarehouseShell() {
  const { counts } = useWarehouseCounts()

  const navItems = [
    { to: '/warehouse', end: true, icon: LayoutDashboard, label: 'Inbox' },
    { to: '/warehouse/receive', icon: PackagePlus, label: 'Receive' },
    {
      to: '/warehouse/print-queue',
      icon: Printer,
      label: 'Print queue',
      badge: counts?.print_queue_pending,
    },
    {
      to: '/warehouse/unidentified',
      icon: PackageSearch,
      label: 'Unidentified',
      badge: counts?.unidentified_count,
    },
    { to: '/warehouse/status', icon: RefreshCw, label: 'Status' },
    { to: '/warehouse/customers', icon: Users, label: 'Directory' },
    { to: '/warehouse/activity', icon: Activity, label: 'Activity' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
      <aside className="hidden shrink-0 border-r border-border md:flex md:w-52 md:flex-col md:px-3 md:py-6 lg:w-56">
        <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-widest text-muted">
          Warehouse
        </p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span>{item.label}</span>
              {item.badge != null && <NavBadge count={item.badge} />}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <CustomerQuickSearch />
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted hover:border-boss-green/40"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Jump to…</span>
            <kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          {counts && counts.packages_today > 0 && (
            <span className="ml-auto text-xs text-muted">
              {counts.packages_today} received today
            </span>
          )}
        </div>

        <div className="flex-1 pb-20 md:pb-6">
          <Outlet />
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
                isActive ? 'text-boss-green' : 'text-muted'
              }`
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={2} />
            {item.label.split(' ')[0]}
            {item.badge != null && item.badge > 0 && (
              <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-boss-green" />
            )}
          </NavLink>
        ))}
      </nav>

      <CommandPalette />
    </div>
  )
}

export function WarehouseLayout() {
  return (
    <WarehouseCountsProvider>
      <WarehouseShell />
    </WarehouseCountsProvider>
  )
}
