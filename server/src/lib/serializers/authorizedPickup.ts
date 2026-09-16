import { PICKUP_ID_TYPE_LABELS } from '../../constants.js'
import type { authorizedPickupPersons } from '../../db/schema/index.js'

type AuthorizedPickupRow = typeof authorizedPickupPersons.$inferSelect

export function authorizedPickupToDict(pickup: AuthorizedPickupRow): Record<string, unknown> {
  return {
    id: pickup.id,
    full_name: pickup.fullName,
    contact_number: pickup.contactNumber,
    id_type: pickup.idType,
    id_type_label: PICKUP_ID_TYPE_LABELS[pickup.idType] ?? pickup.idType,
    notes: pickup.notes,
    sort_order: pickup.sortOrder,
    created_at: pickup.createdAt.toISOString(),
    updated_at: pickup.updatedAt.toISOString(),
  }
}
