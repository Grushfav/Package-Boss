import { BarChart3, ChevronLeft, Megaphone, UserCog, Warehouse } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-boss-gold/15 text-boss-gold'
      : 'text-muted hover:bg-card hover:text-foreground'
  }`

export function AdminLayout() {
  const { pathname } = useLocation()
  const isHub = pathname === '/admin'

  if (isHub) {
    return <Outlet />
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Home
          </Link>
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/admin/operations" className={navClass}>
              <BarChart3 className="h-4 w-4" />
              Metrics
            </NavLink>
            <NavLink to="/admin/clerks" className={navClass}>
              <UserCog className="h-4 w-4" />
              Clerks
            </NavLink>
            <NavLink to="/admin/announcements" className={navClass}>
              <Megaphone className="h-4 w-4" />
              Announcements
            </NavLink>
            <NavLink to="/warehouse" className={navClass}>
              <Warehouse className="h-4 w-4" />
              Warehouse floor
            </NavLink>
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  )
}
