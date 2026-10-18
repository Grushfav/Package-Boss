import {
  CLERK_PERMISSIONS,
  DEFAULT_CLERK_PERMISSIONS,
  STATUS_TRANSITIONS_BY_PERMISSION,
} from '../constants.js'
import type { UserRow } from '../db/schema/index.js'

export function normalizeClerkPermissions(perms: string[] | null | undefined): string[] {
  if (!perms?.length) return [...DEFAULT_CLERK_PERMISSIONS]
  return perms.filter((p) => (CLERK_PERMISSIONS as readonly string[]).includes(p))
}

export function getClerkPermissions(user: UserRow): string[] {
  if (user.role === 'admin') return [...CLERK_PERMISSIONS]
  if (user.role !== 'clerk') return []
  return normalizeClerkPermissions(user.clerkPermissions ?? undefined)
}

export function clerkHasPermission(user: UserRow, permission: string): boolean {
  if (user.role === 'admin') return true
  if (user.role !== 'clerk') return false
  return getClerkPermissions(user).includes(permission)
}

export function clerkHasAnyPermission(user: UserRow, permissions: string[]): boolean {
  if (user.role === 'admin') return true
  if (user.role !== 'clerk') return false
  const perms = new Set(getClerkPermissions(user))
  return permissions.some((p) => perms.has(p))
}

export function assertStatusTransitionAllowed(
  user: UserRow,
  fromStatus: string,
  toStatus: string,
): void {
  if (user.role === 'admin') return
  if (fromStatus === toStatus) return
  if (user.role !== 'clerk') throw new Error('Clerk access required')

  const allowed = new Set<string>()
  for (const perm of getClerkPermissions(user)) {
    for (const transition of STATUS_TRANSITIONS_BY_PERMISSION[perm] ?? []) {
      allowed.add(transition)
    }
  }

  if (!allowed.has(`${fromStatus}->${toStatus}`)) {
    throw new Error(`You are not allowed to change status from ${fromStatus} to ${toStatus}`)
  }
}
