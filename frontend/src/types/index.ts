export type ClerkPermission =
  | 'receive'
  | 'activity'
  | 'directory'
  | 'status_transit'
  | 'status_customs'
  | 'status_pickup'
  | 'billing'
  | 'invoice_request'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  contact_number: string
  parish: string
  shipping_id: string
  role?: 'customer' | 'clerk' | 'admin'
  permissions?: ClerkPermission[]
  clerk_permissions?: ClerkPermission[]
  must_set_password?: boolean
  is_active?: boolean
  trn_masked?: string
  trn_on_file?: boolean
  whatsapp_opt_in?: boolean
  created_at: string
}

export interface DeliveryAddress {
  id: string
  label: string
  recipient_name?: string | null
  line1: string
  line2?: string | null
  community?: string | null
  parish: string
  contact_number: string
  delivery_notes?: string | null
  is_default: boolean
  sort_order: number
  formatted: string
  created_at: string
  updated_at: string
}

export interface AuthorizedPickupPerson {
  id: string
  full_name: string
  contact_number: string
  id_type: string
  id_type_label: string
  notes?: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PickupOption {
  value: string
  label: string
}

export interface ShippingAddress {
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  country: string
  formatted: string
}

export interface AuthResponse {
  access_token: string
  user: User
  shipping_address?: ShippingAddress
}

export interface RegisterPayload {
  first_name: string
  last_name: string
  email: string
  password: string
  contact_number: string
  trn: string
  parish: string
  accept_terms: boolean
}

export interface PackageEvent {
  id: string
  status: string
  status_label: string
  note?: string
  created_at: string
  is_current?: boolean
}

export interface PackagePhoto {
  id: string
  object_key: string
  url: string | null
  created_at: string
}

export interface Shipper {
  code: string
  label: string
}

export interface Package {
  id: string
  tracking_number: string
  status: string
  status_label: string
  carrier_tracking?: string | null
  label_name?: string | null
  label_boss_id?: string | null
  is_unidentified?: boolean
  shipper?: string | null
  shipper_label?: string | null
  customer?: StaffCustomer
  actual_weight_lbs?: number | null
  billable_weight_lbs?: number | null
  estimated_freight_jmd?: number | null
  duties_jmd?: number | null
  handling_jmd?: number | null
  other_fees_jmd?: number | null
  total_due_jmd?: number | null
  currency?: 'JMD'
  billing_status?: 'pending' | 'ready' | 'paid'
  billing_status_label?: string
  invoice_status?: 'not_required' | 'pending' | 'requested' | 'received'
  invoice_status_label?: string
  invoice_url?: string | null
  invoice_request_note?: string | null
  declared_value_usd?: number | null
  delivery_address_id?: string | null
  delivery_address?: DeliveryAddress | null
  rate_tier_label?: string | null
  label_printed_at?: string | null
  received_at?: string | null
  created_at: string
  events?: PackageEvent[]
  photos?: PackagePhoto[]
  timeline?: PackageEvent[]
  origin?: string
  destination?: string
  payment?: PackagePaymentSummary | null
}

export interface PackagePaymentSummary {
  checkout_id: string
  invoice_number: string
  amount_jmd: number
  method: 'cash' | 'card' | 'bank_transfer'
  method_label?: string
  reference?: string | null
  notes?: string | null
  recorded_by_name?: string | null
  recorded_at?: string
}

export interface PaymentCheckoutItem {
  id: string
  checkout_id: string
  package_id: string
  amount_jmd: number
  tracking_number?: string
}

export interface PaymentCheckout {
  id: string
  customer_id: string
  invoice_number: string
  total_jmd: number
  method: 'cash' | 'card' | 'bank_transfer'
  method_label: string
  reference?: string | null
  notes?: string | null
  recorded_by_name?: string | null
  recorded_at: string
  package_count: number
  items?: PaymentCheckoutItem[]
}

export interface CustomerAccountSummary {
  total_due_jmd: number
  ready_count: number
  paid_count: number
  package_count: number
  currency: 'JMD'
}

export interface CustomerAccount {
  customer: StaffCustomer
  packages: Package[]
  checkouts: PaymentCheckout[]
  summary: CustomerAccountSummary
}

/** @deprecated use PackagePaymentSummary */
export interface PackagePayment {
  id: string
  package_id: string
  customer_id: string
  invoice_number: string
  amount_usd: number
  method: 'cash' | 'card' | 'bank_transfer'
  method_label: string
  reference?: string | null
  notes?: string | null
  recorded_by_id?: string | null
  recorded_by_name?: string | null
  recorded_at: string
  tracking_number?: string
}

export interface StaffCustomer {
  id: string
  full_name: string
  email: string
  contact_number: string
  parish: string
  shipping_id: string
  active_package_count?: number
}

export interface PresignResponse {
  upload_url: string
  upload_headers?: Record<string, string>
  object_key: string
  public_url: string | null
  shipping_id?: string
}

export interface InvoicePresignResponse {
  upload_url: string
  upload_headers?: Record<string, string>
  object_key: string
  public_url: string | null
}

export interface AuditLogEntry {
  id: string
  actor_id?: string | null
  actor_name: string
  actor_role: string
  action: string
  entity_type: string
  entity_id?: string | null
  summary: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AdminOverview {
  packages_today: number
  packages_7d: number
  packages_30d: number
  pending_pre_alerts: number
  in_transit: number
  revenue_30d_usd: number
}

export interface PreAlert {
  id: string
  carrier_tracking: string
  merchant?: string | null
  description?: string | null
  declared_value_usd?: number | null
  invoice_object_key?: string | null
  invoice_url?: string | null
  status: 'pending' | 'matched' | 'received' | 'cancelled'
  status_label: string
  package_id?: string | null
  created_at: string
  updated_at: string
}
