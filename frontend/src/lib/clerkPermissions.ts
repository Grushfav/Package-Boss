import type { ClerkPermission } from '../types'

export const CLERK_PERMISSION_LABELS: Record<ClerkPermission, string> = {
  receive: 'Receive packages',
  activity: 'Activity log',
  directory: 'Customer directory',
  status_transit: 'Status: received → in transit (Florida)',
  status_customs: 'Status: customs updates',
  status_pickup: 'Status: ready for pickup / delivered',
  billing: 'Billing & payments',
  invoice_request: 'Request customer invoices',
}

export const DEFAULT_CLERK_PERMISSIONS: ClerkPermission[] = ['receive', 'activity']

export function clerkHasPermission(
  permissions: ClerkPermission[] | undefined,
  permission: ClerkPermission,
  role?: string,
): boolean {
  if (role === 'admin') return true
  if (!permissions) return DEFAULT_CLERK_PERMISSIONS.includes(permission)
  return permissions.includes(permission)
}

export function clerkHasAnyPermission(
  permissions: ClerkPermission[] | undefined,
  required: ClerkPermission[],
  role?: string,
): boolean {
  if (role === 'admin') return true
  return required.some((p) => clerkHasPermission(permissions, p, role))
}
