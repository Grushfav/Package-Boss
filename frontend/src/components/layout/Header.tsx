import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { ThemeToggle } from '../ui/ThemeToggle'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-xs font-semibold uppercase tracking-widest transition-colors ${
    isActive ? 'text-boss-green' : 'text-foreground/80 hover:text-boss-green'
  }`

export function Header() {
  const { isAuthenticated, user, logout, homeRoute } = useAuth()
  const isCustomer = !user?.role || user.role === 'customer'

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to={isAuthenticated && isCustomer ? '/dashboard' : '/'} className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="h-[3.375rem] w-auto" aria-hidden />
          <span className="text-xl font-black italic tracking-tight">
            <span className="text-foreground">PACKAGE </span>
            <span className="text-boss-gold">BOSS</span>
          </span>
        </Link>

        {!isAuthenticated && (
          <nav className="hidden items-center gap-8 md:flex">
            <NavLink to="/about" className={navClass}>About</NavLink>
            <NavLink to="/services" className={navClass}>Services</NavLink>
            <NavLink to="/track" className={navClass}>Tracking</NavLink>
            <NavLink to="/rates" className={navClass}>Rates</NavLink>
          </nav>
        )}

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              {!isCustomer && (
                <Link to={homeRoute} className="hidden items-center gap-2 text-sm sm:flex">
                  <span className="font-semibold text-foreground">{user?.first_name}</span>
                  {user?.role && user.role !== 'customer' && (
                    <span className="rounded-full bg-boss-green/15 px-2 py-0.5 text-[10px] font-bold uppercase text-boss-green">
                      {user.role}
                    </span>
                  )}
                </Link>
              )}
              <Button variant="outline" onClick={logout} className="!py-2 !text-xs">
                Logout
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button variant="outline" className="!py-2 !text-xs">
                Boss Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
