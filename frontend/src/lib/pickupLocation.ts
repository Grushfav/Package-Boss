export const PICKUP_LOCATION_LABEL = 'Tropical Plaza parking lot, Half Way Tree'
export const PICKUP_HOURS_SUMMARY = 'Thursdays to Saturdays'
export const PICKUP_SUMMARY = `${PICKUP_LOCATION_LABEL} · ${PICKUP_HOURS_SUMMARY} · Free`

export type FulfillmentType = 'delivery' | 'pickup'

export const FULFILLMENT_TYPE_LABELS: Record<FulfillmentType, string> = {
  delivery: 'Home delivery',
  pickup: 'Pickup',
}

export function pendingFulfillmentBadge(
  request: { fulfillment_type?: FulfillmentType; status: string },
): string {
  const isPickup = request.fulfillment_type === 'pickup'
  if (request.status === 'in_progress') {
    return isPickup ? 'Pickup in progress' : 'Delivery in progress'
  }
  return isPickup ? 'Pickup requested' : 'Delivery requested'
}
