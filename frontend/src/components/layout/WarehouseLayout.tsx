import {
  Activity,
  Bell,
  ChevronLeft,
  Inbox,
  LayoutDashboard,
  PackagePlus,
  PackageSearch,
  Plane,
  Printer,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { clerkHasAnyPermission, clerkHasPermission } from '../../lib/clerkPermissions'
import { canAccessWarehouse, isAdmin } from '../../lib/roles'
import type { ClerkPermission } from '../../types'
import { WarehouseCountsProvider, useWarehouseCounts } from '../../context/WarehouseCountsContext'
import { CommandPalette, openCommandPalette } from '../warehouse/CommandPalette'
import { CustomerQuickSearch } from '../warehouse/CustomerQuickSearch'
import { PackageQuickSearch } from '../warehouse/PackageQuickSearch'

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto rounded-full bg-boss-gold px-1.5 py-0.5 text-[10px] font-bold text-black">
      {count > 99 ? '99+' : count}
    </span>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-boss-gold/15 text-boss-gold'
      : 'text-muted hover:bg-card hover:text-foreground'
  }`

function WarehouseShell() {
  const { counts } = useWarehouseCounts()
  const { user } = useAuth()
  const perms = user?.permissions || user?.clerk_permissions
  const role = user?.role

  const navItems: {
    to: string
    end?: boolean
    icon: typeof LayoutDashboard
    label: string
    badge?: number
    permission: ClerkPermission | ClerkPermission[]
  }[] = [
    { to: '/warehouse', end: true, icon: LayoutDashboard, label: 'Floor', permission: 'receive' },
    { to: '/warehouse/receive', icon: PackagePlus, label: 'Receive', permission: 'receive' },
    {
      to: '/warehouse/pre-alerts',
      icon: Bell,
      label: 'Pre-alerts',
      badge: counts?.pending_pre_alerts,
      permission: 'pre_alerts',
    },
    {
      to: '/warehouse/print-queue',
      icon: Printer,
      label: 'Print',
      badge: counts?.print_queue_pending,
      permission: 'receive',
    },
    {
      to: '/warehouse/requests',
      icon: Inbox,
      label: 'Requests',
      badge: counts?.pending_customer_requests,
      permission: ['status_pickup', 'billing'],
    },
    {
      to: '/warehouse/unidentified',
      icon: PackageSearch,
      label: 'Unidentified',
      badge: counts?.unidentified_count,
      permission: 'receive',
    },
    {
      to: '/warehouse/departures',
      icon: Plane,
      label: 'Departures',
      badge: counts?.open_shipments,
      permission: 'status_transit',
    },
    {
      to: '/warehouse/status',
      icon: RefreshCw,
      label: 'Package status',
      permission: ['status_transit', 'status_customs', 'status_pickup'],
    },
    { to: '/warehouse/customers', icon: Users, label: 'Directory', permission: 'directory' },
    { to: '/warehouse/activity', icon: Activity, label: 'Activity', permission: 'activity' },
  ]

  const visibleNav = navItems.filter((item) =>
    Array.isArray(item.permission)
      ? clerkHasAnyPermission(perms, item.permission, role)
      : clerkHasPermission(perms, item.permission, role),
  )

  const showQuickSearch =
    clerkHasPermission(perms, 'directory', role) ||
    clerkHasPermission(perms, 'receive', role)

  const showPackageSearch = canAccessWarehouse(role)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row print:block print:min-h-0">
      <aside className="no-print hidden shrink-0 border-r border-border md:flex md:w-52 md:flex-col md:px-3 md:py-6 lg:w-56">
        {isAdmin(user?.role) && (
          <Link
            to="/admin"
            className="mb-4 inline-flex items-center gap-1 px-3 text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Admin home
          </Link>
        )}
        <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-widest text-muted">
          Warehouse
        </p>
        <nav className="flex flex-col gap-1">
          {visibleNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span>{item.label}</span>
              {item.badge != null && <NavBadge count={item.badge} />}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col print:block print:min-h-0">
        <div className="no-print relative z-40 flex flex-wrap items-center gap-3 overflow-visible border-b border-border px-4 py-3">
          {isAdmin(user?.role) && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-foreground md:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
              Admin home
            </Link>
          )}
          {showPackageSearch && <PackageQuickSearch />}
          {showQuickSearch && <CustomerQuickSearch />}
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted hover:border-boss-gold/40"
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

        <div className="flex-1 pb-20 md:pb-6 print:p-0">
          <Outlet />
        </div>
      </div>

      <nav className="no-print fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
        {visibleNav.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
                isActive ? 'text-boss-gold' : 'text-muted'
              }`
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={2} />
            {item.label.split(' ')[0]}
            {item.badge != null && item.badge > 0 && (
              <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-boss-gold" />
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
