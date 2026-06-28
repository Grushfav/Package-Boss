import { api } from './client'
import { presignFilePayload } from '../lib/normalizeUploadFile'
import type { Package, PresignResponse, Shipper, StaffCustomer } from '../types'

export interface WarehouseSummary {
  print_queue_pending: number
  unidentified_count: number
  received_miami_count: number
  received_count?: number
  packages_today: number
  pending_pre_alerts: number
  status_counts?: Record<string, number>
}

export async function fetchWarehouseSummary(): Promise<WarehouseSummary> {
  const { data } = await api.get<WarehouseSummary>('/staff/warehouse/summary')
  return data
}

export async function fetchShippers(): Promise<Shipper[]> {
  const { data } = await api.get<{ shippers: Shipper[] }>('/shippers')
  return data.shippers
}

export async function fetchCustomers(
  options: { q?: string; limit?: number; offset?: number } = {},
): Promise<{ customers: StaffCustomer[]; total: number }> {
  const { data } = await api.get<{ customers: StaffCustomer[]; total: number }>(
    '/warehouse/customers',
    {
      params: {
        q: options.q || undefined,
        limit: options.limit,
        offset: options.offset,
      },
    },
  )
  return data
}

export async function searchCustomers(query: string): Promise<StaffCustomer[]> {
  const { data } = await api.get<{ customers: StaffCustomer[] }>(
    '/warehouse/customers/search',
    { params: { q: query } },
  )
  return data.customers
}

export async function lookupCustomer(shippingId: string): Promise<StaffCustomer> {
  const { data } = await api.get<{ customer: StaffCustomer }>(
    `/staff/customers/${encodeURIComponent(shippingId.trim().toUpperCase())}`,
  )
  return data.customer
}

export async function presignUpload(
  shippingId: string,
  filename: string,
  contentType: string,
  contentLength: number,
): Promise<PresignResponse> {
  const { data } = await api.post<PresignResponse>('/uploads/presign', {
    shipping_id: shippingId,
    ...presignFilePayload({ filename, contentType, contentLength }),
  })
  return data
}

export async function presignUnidentifiedUpload(
  filename: string,
  contentType: string,
  contentLength: number,
): Promise<PresignResponse> {
  const { data } = await api.post<PresignResponse>('/uploads/presign-unidentified', {
    ...presignFilePayload({ filename, contentType, contentLength }),
  })
  return data
}

export async function receivePackage(payload: {
  shipping_id: string
  actual_weight_lbs: number
  shipper: string
  carrier_tracking?: string
  photo_keys?: string[]
  note?: string
}): Promise<Package> {
  const { data } = await api.post<{ package: Package }>('/staff/packages/receive', payload)
  return data.package
}

export async function receiveUnidentifiedPackage(payload: {
  actual_weight_lbs: number
  shipper: string
  carrier_tracking?: string
  label_name?: string
  label_boss_id?: string
  photo_keys?: string[]
  note?: string
}): Promise<Package> {
  const { data } = await api.post<{ package: Package }>(
    '/staff/packages/receive-unidentified',
    payload,
  )
  return data.package
}

export async function fetchUnidentifiedPackages(
  options: { limit?: number; offset?: number } = {},
): Promise<{ packages: Package[]; total: number }> {
  const { data } = await api.get<{ packages: Package[]; total: number }>(
    '/staff/packages/unidentified',
    { params: options },
  )
  return data
}

export async function assignUnidentifiedPackage(
  packageId: string,
  shippingId: string,
  note?: string,
): Promise<Package> {
  const { data } = await api.post<{ package: Package }>(
    `/staff/packages/${encodeURIComponent(packageId)}/assign`,
    { shipping_id: shippingId, note },
  )
  return data.package
}

export async function markLabelsPrinted(
  packageIds: string[],
): Promise<{ marked: number; package_ids: string[]; failed: { id: string; error: string }[] }> {
  const { data } = await api.patch<{
    marked: number
    package_ids: string[]
    failed: { id: string; error: string }[]
  }>('/staff/packages/mark-printed', { package_ids: packageIds })
  return data
}

export async function fetchPrintQueue(
  options: { days?: number; limit?: number; offset?: number } = {},
): Promise<{ packages: Package[]; total: number }> {
  const { data } = await api.get<{ packages: Package[]; total: number }>(
    '/staff/packages/print-queue',
    { params: options },
  )
  return data
}

export async function fetchPackageByTracking(trackingNumber: string): Promise<Package> {
  const { data } = await api.get<{ package: Package }>(
    `/staff/packages/lookup/${encodeURIComponent(trackingNumber.trim().toUpperCase())}`,
  )
  return data.package
}

export async function fetchWarehousePackages(options: {
  from?: string
  to?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ packages: Package[]; total: number }> {
  const { data } = await api.get<{ packages: Package[]; total: number }>('/staff/packages', {
    params: {
      from: options.from || undefined,
      to: options.to || undefined,
      status: options.status || undefined,
      limit: options.limit,
      offset: options.offset,
    },
  })
  return data
}

export interface BulkStatusResult {
  updated: number
  packages: Package[]
  failed: { id: string; tracking_number?: string; error: string }[]
}

export async function bulkUpdatePackageStatus(payload: {
  packageIds: string[]
  status: string
  note?: string
}): Promise<BulkStatusResult> {
  const { data } = await api.patch<BulkStatusResult>('/staff/packages/bulk-status', {
    package_ids: payload.packageIds,
    status: payload.status,
    note: payload.note,
  })
  return data
}

export async function updatePackageStatus(
  trackingNumber: string,
  status: string,
  note?: string,
): Promise<Package> {
  const { data } = await api.patch<{ package: Package }>(
    `/staff/packages/${encodeURIComponent(trackingNumber)}/status`,
    { status, note },
  )
  return data.package
}

export async function requestPackageInvoice(
  packageId: string,
  payload: { channel: 'email' | 'whatsapp' | 'both'; note?: string },
): Promise<{ package: Package; channels_sent: string[]; email_recipient?: string | null; email_request_id?: string | null }> {
  const { data } = await api.post<{
    package: Package
    channels_sent: string[]
    email_recipient?: string | null
    email_request_id?: string | null
  }>(
    `/staff/packages/${packageId}/request-invoice`,
    payload,
  )
  return data
}

export async function updatePackageBilling(
  packageId: string,
  payload: {
    estimated_freight_jmd?: number
    duties_jmd?: number
    handling_jmd?: number
    other_fees_jmd?: number
    declared_value_usd?: number
    billing_status?: 'pending' | 'ready' | 'paid'
    publish?: boolean
  },
): Promise<Package> {
  const { data } = await api.patch<{ package: Package }>(
    `/staff/packages/${packageId}/billing`,
    payload,
  )
  return data.package
}

export async function fetchCustomerDeliveryAddresses(
  shippingId: string,
): Promise<import('../types').DeliveryAddress[]> {
  const { data } = await api.get<{ addresses: import('../types').DeliveryAddress[] }>(
    `/staff/customers/${encodeURIComponent(shippingId)}/delivery-addresses`,
  )
  return data.addresses
}

export async function setPackageDeliveryAddress(
  packageId: string,
  deliveryAddressId: string,
): Promise<Package> {
  const { data } = await api.patch<{ package: Package }>(
    `/staff/packages/${packageId}/delivery-address`,
    { delivery_address_id: deliveryAddressId },
  )
  return data.package
}

export async function fetchCustomerAccount(shippingId: string): Promise<import('../types').CustomerAccount> {
  const { data } = await api.get<import('../types').CustomerAccount>(
    `/staff/customers/${encodeURIComponent(shippingId.trim().toUpperCase())}/account`,
  )
  return data
}

export async function recordPackagePayment(
  packageId: string,
  payload: {
    method: 'cash' | 'card' | 'bank_transfer'
    reference?: string
    notes?: string
  },
): Promise<{ package: Package; checkout: import('../types').PaymentCheckout }> {
  const { data } = await api.post<{ package: Package; checkout: import('../types').PaymentCheckout }>(
    `/staff/packages/${packageId}/payments`,
    payload,
  )
  return data
}

export interface ReleaseFromCustomsResult {
  released: number
  packages: Package[]
  failed: { id: string; tracking_number?: string; error: string }[]
}

export async function releasePackagesFromCustoms(payload: {
  items: Array<{
    package_id: string
    duties_jmd?: number
    handling_jmd?: number
    other_fees_jmd?: number
    note?: string
  }>
  note?: string
}): Promise<ReleaseFromCustomsResult> {
  const { data } = await api.post<ReleaseFromCustomsResult>(
    '/staff/packages/release-from-customs',
    payload,
  )
  return data
}

export interface BulkInvoiceRequestResult {
  sent: number
  results: Array<{
    package_id: string
    tracking_number: string
    channels_sent?: string[]
    email_recipient?: string
  }>
  failed: { id: string; tracking_number?: string; error: string }[]
}

export async function bulkRequestPackageInvoices(payload: {
  packageIds: string[]
  channel: 'email' | 'whatsapp' | 'both'
  note?: string
}): Promise<BulkInvoiceRequestResult> {
  const { data } = await api.post<BulkInvoiceRequestResult>(
    '/staff/packages/bulk-request-invoice',
    {
      package_ids: payload.packageIds,
      channel: payload.channel,
      note: payload.note,
    },
  )
  return data
}

export async function recordCustomerCheckout(
  shippingId: string,
  payload: {
    package_ids: string[]
    method: 'cash' | 'card' | 'bank_transfer'
    reference?: string
    notes?: string
  },
): Promise<import('../types').PaymentCheckout> {
  const { data } = await api.post<{ checkout: import('../types').PaymentCheckout }>(
    `/staff/customers/${encodeURIComponent(shippingId.trim().toUpperCase())}/checkouts`,
    payload,
  )
  return data.checkout
}

async function fetchAuthedHtml(path: string): Promise<string> {
  const token = localStorage.getItem('access_token')
  const base = import.meta.env.VITE_API_URL || '/api'
  const response = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to load invoice')
  }
  return response.text()
}

function openHtmlInNewTab(html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function openPackageBillInvoice(packageId: string): Promise<void> {
  const html = await fetchAuthedHtml(`/staff/packages/${packageId}/bill-invoice`)
  openHtmlInNewTab(html)
}

export async function openCheckoutBillInvoice(checkoutId: string): Promise<void> {
  const html = await fetchAuthedHtml(`/staff/checkouts/${checkoutId}/bill-invoice`)
  openHtmlInNewTab(html)
}
