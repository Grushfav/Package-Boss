export type UserRole = 'customer' | 'clerk' | 'admin'

export const WAREHOUSE_ROLES: UserRole[] = ['clerk', 'admin']

export function canAccessWarehouse(role?: string): role is 'clerk' | 'admin' {
  return role === 'clerk' || role === 'admin'
}

export function isAdmin(role?: string): role is 'admin' {
  return role === 'admin'
}
