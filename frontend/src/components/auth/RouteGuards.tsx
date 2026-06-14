import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getHomeRoute } from '../../lib/routing'
import { canAccessWarehouse, isAdmin } from '../../lib/roles'

function LoadingScreen() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted">
      Loading...
    </div>
  )
}

function loginRedirect(path: string) {
  return `/login?next=${encodeURIComponent(path)}`
}

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to={loginRedirect(location.pathname)} replace />
  return <Outlet />
}

export function RequireWarehouse() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to={loginRedirect(location.pathname)} replace />
  if (!canAccessWarehouse(user?.role)) {
    return <Navigate to={getHomeRoute(user?.role)} replace />
  }
  return <Outlet />
}

export function RequireAdmin() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to={loginRedirect(location.pathname)} replace />
  if (!isAdmin(user?.role)) {
    return <Navigate to={getHomeRoute(user?.role)} replace />
  }
  return <Outlet />
}
