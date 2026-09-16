import type { deliveryAddresses } from '../../db/schema/index.js'

type DeliveryAddressRow = typeof deliveryAddresses.$inferSelect

function formatted(address: DeliveryAddressRow): string {
  const lines = [address.line1]
  if (address.line2) lines.push(address.line2)
  const communityLine = address.community ?? ''
  if (communityLine) lines.push(`${communityLine}, ${address.parish}`)
  else lines.push(address.parish)
  return lines.join('\n')
}

export function deliveryAddressToDict(address: DeliveryAddressRow): Record<string, unknown> {
  return {
    id: address.id,
    label: address.label,
    recipient_name: address.recipientName,
    line1: address.line1,
    line2: address.line2,
    community: address.community,
    parish: address.parish,
    contact_number: address.contactNumber,
    delivery_notes: address.deliveryNotes,
    is_default: address.isDefault,
    sort_order: address.sortOrder,
    formatted: formatted(address),
    created_at: address.createdAt.toISOString(),
    updated_at: address.updatedAt.toISOString(),
  }
}
