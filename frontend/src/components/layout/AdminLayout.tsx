import { Shield, UserCog, Warehouse } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-boss-green/15 text-boss-green'
      : 'text-muted hover:bg-card hover:text-foreground'
  }`

export function AdminLayout() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <NavLink to="/admin" end className={navClass}>
            <Shield className="h-4 w-4" />
            Operations
          </NavLink>
          <NavLink to="/admin/clerks" className={navClass}>
            <UserCog className="h-4 w-4" />
            Clerks
          </NavLink>
          <NavLink to="/warehouse" className={navClass}>
            <Warehouse className="h-4 w-4" />
            Warehouse floor
          </NavLink>
        </div>
      </div>
      <Outlet />
    </div>
  )
}
