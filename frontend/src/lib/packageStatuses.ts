export const PACKAGE_STATUSES = [
  { value: 'awaiting_receipt', label: 'Awaiting Receipt' },
  { value: 'received', label: 'Received — Fort Lauderdale' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'customs', label: 'Customs' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup / Delivery' },
  { value: 'delivered', label: 'Delivered' },
] as const

export const CUSTOMER_BILL_VISIBLE_STATUSES = new Set(['ready_for_pickup', 'delivered'])

export function isCustomerBillVisible(status: string): boolean {
  return CUSTOMER_BILL_VISIBLE_STATUSES.has(status)
}
