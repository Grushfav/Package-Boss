/** Clerk workflow statuses only — linear: Received → In Transit → Customs → Ready for Pickup → Delivered */
export const WORKFLOW_STATUSES = [
  { value: 'received', label: 'Received' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'customs', label: 'Customs' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'delivered', label: 'Delivered' },
] as const

/** @deprecated Use WORKFLOW_STATUSES — kept as alias for existing imports */
export const PACKAGE_STATUSES = WORKFLOW_STATUSES

export const ALL_STATUS_LABELS: Record<string, string> = {
  unidentified: 'Unidentified',
  awaiting_receipt: 'Awaiting Receipt',
  received: 'Received',
  in_transit: 'In Transit',
  customs: 'Customs',
  ready_for_pickup: 'Ready for Pickup',
  delivered: 'Delivered',
}

export const CUSTOMER_BILL_VISIBLE_STATUSES = new Set(['ready_for_pickup', 'delivered'])

export function isCustomerBillVisible(status: string): boolean {
  return CUSTOMER_BILL_VISIBLE_STATUSES.has(status)
}

export function getStatusLabel(status: string): string {
  return ALL_STATUS_LABELS[status] ?? status
}
