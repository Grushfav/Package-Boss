import type { UserRow } from '../../db/schema/index.js'
import { getClerkPermissions } from '../../services/clerkPermissionService.js'

export function userFullName(user: UserRow): string {
  return `${user.firstName} ${user.lastName}`
}

export function customerStaffDict(
  user: UserRow,
  opts: { activePackageCount?: number } = {},
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: user.id,
    full_name: userFullName(user),
    email: user.email,
    contact_number: user.contactNumber || '',
    parish: user.parish || '',
    shipping_id: user.shippingId,
  }
  if (opts.activePackageCount !== undefined) {
    data.active_package_count = opts.activePackageCount
  }
  return data
}

export function userToDict(
  user: UserRow,
  opts: { includeTrn?: boolean; includeClerkFields?: boolean } = {},
): Record<string, unknown> {
  const { includeTrn = false, includeClerkFields = false } = opts
  const data: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    full_name: userFullName(user),
    contact_number: user.contactNumber,
    parish: user.parish ?? '',
    shipping_id: user.shippingId,
    role: user.role,
    whatsapp_opt_in: user.whatsappOptIn,
    created_at: user.createdAt.toISOString(),
  }
  if (includeTrn && user.trn) data.trn = user.trn
  if (includeClerkFields || user.role === 'clerk' || user.role === 'admin') {
    data.permissions = getClerkPermissions(user)
    data.is_active = user.isActive
    if (user.role === 'clerk') {
      data.must_set_password = user.mustSetPassword
      data.clerk_permissions = getClerkPermissions(user)
    }
  }
  return data
}
