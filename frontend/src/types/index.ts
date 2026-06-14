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
  trn_masked?: string
  trn_on_file?: boolean
  created_at: string
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
  shipper?: string | null
  shipper_label?: string | null
  customer?: StaffCustomer
  actual_weight_lbs?: number | null
  billable_weight_lbs?: number | null
  shipping_cost_usd?: number | null
  rate_tier_label?: string | null
  received_at?: string | null
  created_at: string
  events?: PackageEvent[]
  photos?: PackagePhoto[]
  timeline?: PackageEvent[]
  origin?: string
  destination?: string
}

export interface StaffCustomer {
  id: string
  full_name: string
  email: string
  contact_number: string
  parish: string
  shipping_id: string
  trn: string
}

export interface PresignResponse {
  upload_url: string
  object_key: string
  public_url: string | null
  shipping_id: string
}

export interface InvoicePresignResponse {
  upload_url: string
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
