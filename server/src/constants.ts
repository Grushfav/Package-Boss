export const JAMAICA_PARISHES = [
  'Kingston',
  'St. Andrew',
  'St. Thomas',
  'Portland',
  'St. Mary',
  'St. Ann',
  'Trelawny',
  'St. James',
  'Hanover',
  'Westmoreland',
  'St. Elizabeth',
  'Manchester',
  'Clarendon',
  'St. Catherine',
] as const

export const UNIDENTIFIED_HOLDER_EMAIL = 'unidentified@package-boss.internal'
export const UNIDENTIFIED_HOLDER_SHIPPING_ID = 'BOSS-00000'
export const MAX_RECEIVE_LBS = 750

export const WORKFLOW_STATUSES = [
  'received',
  'in_transit',
  'customs',
  'ready_for_pickup',
  'delivered',
] as const

export const WORKFLOW_TRANSITIONS = new Set([
  'unidentified->received',
  'received->in_transit',
  'in_transit->customs',
  'ready_for_pickup->delivered',
])

export const PACKAGE_STATUSES = ['unidentified', 'awaiting_receipt', ...WORKFLOW_STATUSES] as const

export const UPDATABLE_STATUSES = [...WORKFLOW_STATUSES]

export const LABEL_EDITABLE_STATUSES = new Set(['received', 'unidentified', 'in_transit'])

export const STATUS_LABELS: Record<string, string> = {
  unidentified: 'Unidentified — Awaiting Owner',
  awaiting_receipt: 'Awaiting Receipt',
  received: 'Received',
  in_transit: 'In Transit',
  customs: 'Customs',
  ready_for_pickup: 'Ready for Pickup',
  delivered: 'Delivered',
}

export const CUSTOMER_BILL_VISIBLE_STATUSES = ['ready_for_pickup', 'delivered'] as const
export const PAYMENT_ELIGIBLE_STATUS = 'ready_for_pickup'

export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const ALLOWED_INVOICE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024

export const PRE_ALERT_STATUSES = ['pending', 'matched', 'received', 'cancelled'] as const
export const PRE_ALERT_STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting Receipt',
  matched: 'Matched',
  received: 'Received',
  cancelled: 'Cancelled',
}

export const WAREHOUSE_ROLES = ['clerk', 'admin'] as const
export const ADMIN_ROLES = ['admin'] as const

export const SHIPPERS = [
  { code: 'usps', label: 'USPS' },
  { code: 'ups', label: 'UPS' },
  { code: 'fedex', label: 'FedEx' },
  { code: 'dhl', label: 'DHL' },
  { code: 'amazon', label: 'Amazon' },
  { code: 'gofo_express', label: 'GoFo Express' },
  { code: 'lasership', label: 'Lasership' },
  { code: 'uniuni', label: 'UniUni' },
  { code: 'swift', label: 'Swift' },
  { code: 'veho', label: 'Veho' },
  { code: 'yanwen', label: 'Yanwen' },
  { code: 'other', label: 'Other' },
] as const

export const SHIPPER_CODES = new Set(SHIPPERS.map((s) => s.code))
export const SHIPPER_LABELS = Object.fromEntries(SHIPPERS.map((s) => [s.code, s.label]))

export const DELIVERY_PARISHES = ['Kingston', 'St. Andrew', 'St. Catherine'] as const
export const MAX_DELIVERY_ADDRESSES = 4
export const DELIVERY_FEE_JMD = '800.00'

export const DELIVERY_REQUEST_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const
export const DELIVERY_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Delivered',
  cancelled: 'Cancelled',
}
export const DELIVERY_REQUEST_OPEN_STATUSES = ['pending', 'in_progress'] as const

export const MAX_AUTHORIZED_PICKUPS = 5
export const PICKUP_RELATIONSHIPS = ['spouse', 'family', 'friend', 'colleague', 'other'] as const
export const PICKUP_RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: 'Spouse',
  family: 'Family member',
  friend: 'Friend',
  colleague: 'Colleague',
  other: 'Other',
}
export const PICKUP_ID_TYPES = ['drivers_license', 'passport', 'national_id', 'voter_id'] as const
export const PICKUP_ID_TYPE_LABELS: Record<string, string> = {
  drivers_license: "Driver's licence",
  passport: 'Passport',
  national_id: 'National ID',
  voter_id: 'Voter ID',
}

export const INVOICE_UPLOAD_EXCLUDED_STATUSES = new Set(['received', 'ready_for_pickup', 'delivered'])
export const INVOICE_STATUSES = ['not_required', 'pending', 'requested', 'received'] as const
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  not_required: 'Not Required',
  pending: 'Awaiting Invoice',
  requested: 'Invoice Requested',
  received: 'Invoice Received',
}

export const BILLING_CURRENCY = 'JMD'
export const BILLING_CURRENCY_SYMBOL = 'J$'
export const BILLING_STATUSES = ['pending', 'ready', 'paid'] as const
export const BILLING_STATUS_LABELS: Record<string, string> = {
  pending: 'Bill Pending',
  ready: 'Amount Due',
  paid: 'Paid',
}

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer'] as const
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
}

export const BANK_TRANSFER_PROOF_STATUSES = ['pending', 'in_progress', 'confirmed', 'rejected'] as const
export const BANK_TRANSFER_PROOF_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending review',
  in_progress: 'In progress',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
}
export const BANK_TRANSFER_PROOF_OPEN_STATUSES = ['pending', 'in_progress'] as const

export const SENDER_BANKS = [
  'ncb',
  'scotiabank',
  'jmmb',
  'sagicor',
  'cibc',
  'jn_bank',
  'vm_building_society',
  'other',
] as const
export const SENDER_BANK_LABELS: Record<string, string> = {
  ncb: 'NCB',
  scotiabank: 'Scotiabank',
  jmmb: 'JMMB',
  sagicor: 'Sagicor Bank',
  cibc: 'CIBC FirstCaribbean',
  jn_bank: 'JN Bank',
  vm_building_society: 'Victoria Mutual',
  other: 'Other',
}

export const INVOICE_REQUEST_CHANNELS = ['email', 'whatsapp', 'both'] as const

export const CLERK_PERMISSIONS = [
  'receive',
  'activity',
  'pre_alerts',
  'directory',
  'status_transit',
  'status_customs',
  'status_pickup',
  'billing',
  'invoice_request',
] as const

export const CLERK_PERMISSION_LABELS: Record<string, string> = {
  receive: 'Receive packages',
  activity: 'Activity log',
  pre_alerts: 'View pre-alerts',
  directory: 'Customer directory',
  status_transit: 'Status: received → in transit + departures (Fort Lauderdale)',
  status_customs: 'Status: customs updates',
  status_pickup: 'Status: ready for pickup / delivered',
  billing: 'Billing & payments',
  invoice_request: 'Request customer invoices',
}

export const DEFAULT_CLERK_PERMISSIONS = ['receive', 'activity', 'pre_alerts'] as const

export const RECEIVE_BATCH_STATUSES = ['open', 'closed'] as const
export const RECEIVE_BATCH_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  closed: 'Closed',
}

export const SHIPMENT_STATUSES = ['open', 'departed'] as const
export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  departed: 'Departed',
}

export const STATUS_TRANSITIONS_BY_PERMISSION: Record<string, Set<string>> = {
  status_transit: new Set(['received->in_transit']),
  status_customs: new Set(['in_transit->customs']),
  status_pickup: new Set(['ready_for_pickup->delivered']),
  billing: new Set(['ready_for_pickup->delivered']),
}

export const INVITE_TOKEN_TTL_SECONDS = 86400

export const LOGISTICS_JOB_OPEN_STATUSES = ['pending', 'picked_up', 'in_transit'] as const
export const LOGISTICS_JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Searching for driver',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  completed: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}
export const LOGISTICS_IN_HOUSE_PARISHES = DELIVERY_PARISHES
export const LOGISTICS_IN_HOUSE_FEE_JMD = '800.00'
export const LOGISTICS_ISLAND_FEE_JMD = '1500.00'
export const LOGISTICS_ITEM_CATEGORIES = [
  'food',
  'clothing',
  'electronics',
  'documents',
  'medicine',
  'other',
] as const
export const LOGISTICS_ITEM_CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  clothing: 'Clothing',
  electronics: 'Electronics',
  documents: 'Documents',
  medicine: 'Medicine',
  other: 'Other',
}
export const LOGISTICS_VEHICLE_TYPES = ['bike', 'car', 'truck'] as const
export const LOGISTICS_VEHICLE_TYPE_LABELS: Record<string, string> = {
  bike: 'Bike rider',
  car: 'Car',
  truck: 'Truck',
}
export const LOGISTICS_VEHICLE_TYPE_WEIGHT_LABELS: Record<string, string> = {
  bike: '1–10 lbs',
  car: '10+ lbs',
  truck: 'Heavy / bulk',
}
export const LOGISTICS_DELIVERY_SPEEDS = ['immediate', 'next_day'] as const
export const LOGISTICS_DELIVERY_SPEED_LABELS: Record<string, string> = {
  immediate: 'Immediate',
  next_day: 'Next day',
}
export const LOGISTICS_PAYMENT_METHODS = ['cash', 'online'] as const
export const LOGISTICS_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  online: 'Online payment',
}
export const LOGISTICS_ENABLED_PAYMENT_METHODS = ['cash'] as const

export const CUSTOMER_EMAIL_NOTIFICATIONS_KEY = 'customer_email_notifications_enabled'

export const ANNOUNCEMENT_AUDIENCES = ['public', 'customers', 'staff', 'all'] as const
export const ANNOUNCEMENT_SEVERITIES = ['info', 'warning', 'urgent'] as const
export const ANNOUNCEMENT_DISPLAY_TYPES = ['banner', 'modal', 'inbox_only'] as const
export const BROADCAST_CHANNELS = ['in_app', 'email'] as const

export const SEVERITY_ORDER: Record<string, number> = {
  urgent: 3,
  warning: 2,
  info: 1,
}
