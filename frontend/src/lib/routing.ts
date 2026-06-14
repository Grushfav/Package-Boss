import { canAccessWarehouse, isAdmin, type UserRole } from './roles'

const WAREHOUSE_PREFIXES = ['/warehouse']
const ADMIN_PREFIXES = ['/admin']
const CUSTOMER_PREFIXES = ['/dashboard', '/pre-alerts']
const STAFF_BLOCKED_PREFIXES = ['/rates']

export function getHomeRoute(role?: UserRole): string {
  if (isAdmin(role)) return '/admin'
  if (canAccessWarehouse(role)) return '/warehouse'
  return '/dashboard'
}

export function isPathAllowed(path: string, role?: UserRole): boolean {
  if (ADMIN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return isAdmin(role)
  }
  if (WAREHOUSE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return canAccessWarehouse(role)
  }
  if (CUSTOMER_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return !role || role === 'customer'
  }
  if (STAFF_BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return !role || role === 'customer'
  }
  return true
}

export function getPostLoginPath(role: UserRole | undefined, next: string | null): string {
  if (next && next.startsWith('/') && isPathAllowed(next, role)) {
    return next
  }
  return getHomeRoute(role)
}
