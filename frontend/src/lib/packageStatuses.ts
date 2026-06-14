export const PACKAGE_STATUSES = [
  { value: 'awaiting_receipt', label: 'Awaiting Receipt' },
  { value: 'received_miami', label: 'Received in Miami' },
  { value: 'processing', label: 'Processing' },
  { value: 'in_transit', label: 'In Transit to Kingston' },
  { value: 'arrived_kingston', label: 'Arrived in Kingston' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
] as const
