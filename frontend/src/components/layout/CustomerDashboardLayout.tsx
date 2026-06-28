import {
  Bell,
  BellRing,
  DollarSign,
  LayoutDashboard,
  Package,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { fetchMyPackages } from '../../api/packages'
import { fetchMyPreAlerts } from '../../api/preAlerts'
import { useAuth } from '../../context/AuthContext'
import { getHomeRoute } from '../../lib/routing'
import { packageNeedsInvoiceUpload } from '../../lib/packageBilling'

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
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

export function CustomerDashboardLayout() {
  const { user } = useAuth()
  const isCustomer = !user?.role || user.role === 'customer'
  const [preAlertCount, setPreAlertCount] = useState(0)
  const [actionCount, setActionCount] = useState(0)

  useEffect(() => {
    fetchMyPreAlerts()
      .then((alerts) =>
        setPreAlertCount(alerts.filter((a) => a.status === 'pending').length),
      )
      .catch(() => setPreAlertCount(0))

    fetchMyPackages()
      .then((pkgs) => setActionCount(pkgs.filter(packageNeedsInvoiceUpload).length))
      .catch(() => setActionCount(0))
  }, [])

  if (!isCustomer) {
    return <Navigate to={getHomeRoute(user?.role)} replace />
  }

  const navItems = [
    { to: '/dashboard', end: true, icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Home' },
    { to: '/dashboard/profile', icon: User, label: 'Profile', shortLabel: 'Profile' },
    {
      to: '/dashboard/pre-alerts',
      icon: Bell,
      label: 'Pre-alerts',
      shortLabel: 'Alerts',
      badge: preAlertCount,
    },
    {
      to: '/dashboard/packages',
      icon: Package,
      label: 'Packages',
      shortLabel: 'Packages',
      badge: actionCount,
    },
    { to: '/dashboard/rates', icon: DollarSign, label: 'Rates', shortLabel: 'Rates' },
    {
      to: '/dashboard/notifications',
      icon: BellRing,
      label: 'Notifications',
      shortLabel: 'Notify',
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col md:flex-row">
      <aside className="hidden shrink-0 border-r border-border md:flex md:w-52 md:flex-col md:px-3 md:py-8 lg:w-56">
        <div className="mb-6 px-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Account</p>
          <p className="mt-2 text-sm font-semibold text-foreground">Hi, {user?.first_name}</p>
        </div>
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
        <div className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          <Outlet />
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto border-t border-border bg-background/95 backdrop-blur md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex min-w-[4.25rem] shrink-0 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold ${
                isActive ? 'text-boss-green' : 'text-muted'
              }`
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={2} />
            {item.shortLabel}
            {item.badge != null && item.badge > 0 && (
              <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-amber-500" />
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
