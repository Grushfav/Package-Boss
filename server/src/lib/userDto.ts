import { utcIsoformat } from './dates.js'
import { getClerkPermissions } from '../services/clerkPermissionService.js'
import type { UserRow } from '../db/schema/index.js'

export function userToDict(
  user: UserRow,
  opts: { includeTrn?: boolean; includeClerkFields?: boolean } = {},
) {
  const data: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    full_name: `${user.firstName} ${user.lastName}`,
    contact_number: user.contactNumber,
    parish: user.parish ?? '',
    shipping_id: user.shippingId,
    role: user.role,
    whatsapp_opt_in: user.whatsappOptIn,
    created_at: utcIsoformat(user.createdAt),
  }

  if (opts.includeTrn && user.trn) {
    data.trn = user.trn
  }

  if (opts.includeClerkFields || user.role === 'clerk' || user.role === 'admin') {
    const permissions = getClerkPermissions(user)
    data.permissions = permissions
    data.is_active = user.isActive
    if (user.role === 'clerk') {
      data.must_set_password = user.mustSetPassword
      data.clerk_permissions = permissions
    }
  }

  return data
}

export function clerkToDict(user: UserRow) {
  return userToDict(user, { includeClerkFields: true })
}
