import { api } from './client'
import { presignFilePayload } from '../lib/normalizeUploadFile'
import type { Package, PresignResponse, Shipper, StaffCustomer, PreAlert, BankTransferProof } from '../types'

export interface WarehouseSummary {
  print_queue_pending: number
  unidentified_count: number
  received_count: number
  packages_today: number
  pending_pre_alerts: number
  pending_delivery_requests?: number
  pending_transfer_proofs?: number
  pending_customer_requests?: number
  open_shipments?: number
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

export interface PreAlertLookupMatch {
  pre_alert: PreAlert
  customer: StaffCustomer
  match_score: number
}

export async function lookupPreAlertByTracking(
  carrierTracking: string,
): Promise<PreAlertLookupMatch[]> {
  const { data } = await api.get<{ matches: PreAlertLookupMatch[] }>(
    '/staff/pre-alerts/lookup',
    { params: { carrier_tracking: carrierTracking.trim() } },
  )
  return data.matches
}

export async function fetchStaffPreAlerts(
  options: { q?: string; status?: PreAlert['status']; limit?: number; offset?: number } = {},
): Promise<{ pre_alerts: PreAlert[]; total: number }> {
  const { data } = await api.get<{ pre_alerts: PreAlert[]; total: number }>('/staff/pre-alerts', {
    params: {
      q: options.q || undefined,
      status: options.status || undefined,
      limit: options.limit,
      offset: options.offset,
    },
  })
  return data
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

export async function fetchMyRecentReceives(
  limit = 3,
): Promise<ClerkRecentReceive[]> {
  const { data } = await api.get<{ receives: ClerkRecentReceive[] }>(
    '/staff/packages/my-recent-receives',
    { params: { limit } },
  )
  return data.receives
}

export interface ClerkRecentReceive {
  received_at: string
  action: string
  tracking_number?: string | null
  shipping_id?: string | null
  customer_name?: string | null
  billable_weight_lbs?: number | null
  is_unidentified?: boolean
  label_name?: string | null
  package_id?: string | null
}

export async function receivePackage(payload: {
  shipping_id: string
  actual_weight_lbs: number
  shipper: string
  carrier_tracking?: string
  photo_keys?: string[]
  note?: string
  receive_batch_id?: string
}): Promise<{ package: Package; pre_alert_matched?: PreAlert }> {
  const { data } = await api.post<{ package: Package; pre_alert_matched?: PreAlert }>(
    '/staff/packages/receive',
    payload,
  )
  return data
}

export async function receiveUnidentifiedPackage(payload: {
  actual_weight_lbs: number
  shipper: string
  carrier_tracking?: string
  label_name?: string
  label_boss_id?: string
  photo_keys?: string[]
  note?: string
  receive_batch_id?: string
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
): Promise<{ package: Package; pre_alert_matched?: PreAlert }> {
  const { data } = await api.post<{ package: Package; pre_alert_matched?: PreAlert }>(
    `/staff/packages/${encodeURIComponent(packageId)}/assign`,
    { shipping_id: shippingId, note },
  )
  return data
}

export async function unassignPackageFromCustomer(
  packageId: string,
  note?: string,
): Promise<{ package: Package; previous_customer: StaffCustomer }> {
  const { data } = await api.post<{
    package: Package
    previous_customer: StaffCustomer
  }>(`/staff/packages/${encodeURIComponent(packageId)}/unassign`, { note })
  return data
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
  options: { days?: number; limit?: number; offset?: number; pending_only?: boolean } = {},
): Promise<{ packages: Package[]; total: number }> {
  const { data } = await api.get<{ packages: Package[]; total: number }>(
    '/staff/packages/print-queue',
    {
      params: {
        days: options.days,
        limit: options.limit,
        offset: options.offset,
        pending_only: options.pending_only ?? true,
      },
    },
  )
  return data
}

export async function fetchPackageByTracking(trackingNumber: string): Promise<Package> {
  const { data } = await api.get<{ package: Package }>(
    `/staff/packages/lookup/${encodeURIComponent(trackingNumber.trim().toUpperCase())}`,
  )
  return data.package
}

export interface PackageSearchMatch {
  package: Package
  match_score: number
  match_field: 'tracking_number' | 'carrier_tracking'
  match_type: 'exact' | 'prefix' | 'partial'
  matched_value: string
}

export const PACKAGE_SEARCH_MIN_LENGTH = 5

export async function searchPackages(
  query: string,
  limit = 20,
): Promise<{ matches: PackageSearchMatch[]; truncated: boolean }> {
  const { data } = await api.get<{ matches: PackageSearchMatch[]; truncated: boolean }>(
    '/staff/packages/search',
    { params: { q: query, limit } },
  )
  return data
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
    estimated_freight_jmd?: number
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
    processing_fee_jmd?: number
    email_invoice?: boolean
    mark_delivered?: boolean
  },
): Promise<{
  checkout: import('../types').PaymentCheckout
  email_sent?: boolean
  email_error?: string | null
  delivered_count?: number
  delivery_failed?: Array<{ id: string; tracking_number?: string; error: string }>
}> {
  const { data } = await api.post<{
    checkout: import('../types').PaymentCheckout
    email_sent?: boolean
    email_error?: string | null
    delivered_count?: number
    delivery_failed?: Array<{ id: string; tracking_number?: string; error: string }>
  }>(
    `/staff/customers/${encodeURIComponent(shippingId.trim().toUpperCase())}/checkouts`,
    payload,
  )
  return data
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
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) {
    throw new Error('Pop-up blocked — allow pop-ups to view the invoice.')
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}

export async function openPackageBillInvoice(packageId: string): Promise<void> {
  const html = await fetchAuthedHtml(`/staff/packages/${packageId}/bill-invoice`)
  openHtmlInNewTab(html)
}

export async function openCheckoutBillInvoice(checkoutId: string): Promise<void> {
  const html = await fetchAuthedHtml(`/staff/checkouts/${checkoutId}/bill-invoice`)
  openHtmlInNewTab(html)
}

export interface ShipmentSummary {
  id: string
  reference: string
  departure_date: string
  status: 'open' | 'departed'
  status_label: string
  note?: string | null
  created_by_id?: string | null
  created_by_name?: string | null
  departed_at?: string | null
  package_count: number
  total_weight_lbs: number
  created_at: string
  updated_at: string
  packages?: Package[]
}

export async function fetchShipments(options: {
  status?: 'open' | 'departed'
  limit?: number
  offset?: number
} = {}): Promise<{ shipments: ShipmentSummary[]; total: number }> {
  const { data } = await api.get<{ shipments: ShipmentSummary[]; total: number }>(
    '/staff/shipments',
    {
      params: {
        status: options.status || undefined,
        limit: options.limit,
        offset: options.offset,
      },
    },
  )
  return data
}

export async function createShipment(payload: {
  reference: string
  departure_date: string
  note?: string
}): Promise<ShipmentSummary> {
  const { data } = await api.post<{ shipment: ShipmentSummary }>('/staff/shipments', payload)
  return data.shipment
}

export async function fetchShipment(shipmentId: string): Promise<ShipmentSummary> {
  const { data } = await api.get<{ shipment: ShipmentSummary }>(
    `/staff/shipments/${shipmentId}`,
  )
  return data.shipment
}

export async function addPackageToShipment(
  shipmentId: string,
  trackingNumber: string,
): Promise<Package> {
  const { data } = await api.post<{ package: Package }>(
    `/staff/shipments/${shipmentId}/packages`,
    { tracking_number: trackingNumber },
  )
  return data.package
}

export async function removePackageFromShipment(
  shipmentId: string,
  packageId: string,
): Promise<void> {
  await api.delete(`/staff/shipments/${shipmentId}/packages/${packageId}`)
}

export interface DepartShipmentResult {
  shipment: ShipmentSummary
  updated: number
  packages: Package[]
  failed: { id: string; tracking_number?: string; error: string }[]
}

export async function departShipment(
  shipmentId: string,
  note?: string,
): Promise<DepartShipmentResult> {
  const { data } = await api.post<DepartShipmentResult>(
    `/staff/shipments/${shipmentId}/depart`,
    { note },
  )
  return data
}

export async function batchDepartPackages(payload: {
  packageIds: string[]
  shipmentId?: string
  reference?: string
  departureDate?: string
  note?: string
}): Promise<DepartShipmentResult> {
  const { data } = await api.post<DepartShipmentResult>('/staff/shipments/batch-depart', {
    package_ids: payload.packageIds,
    shipment_id: payload.shipmentId,
    reference: payload.reference,
    departure_date: payload.departureDate,
    note: payload.note,
  })
  return data
}

export interface ReceiveBatchSummary {
  id: string
  batch_code: string
  reference: string
  receive_date: string
  status: 'open' | 'closed'
  status_label: string
  note?: string | null
  package_count: number
  created_by_name?: string | null
  created_at: string
}

export async function fetchReceiveBatches(options: {
  status?: 'open' | 'closed'
  limit?: number
} = {}): Promise<{ receive_batches: ReceiveBatchSummary[]; total: number }> {
  const { data } = await api.get<{ receive_batches: ReceiveBatchSummary[]; total: number }>(
    '/staff/receive-batches',
    {
      params: {
        status: options.status || undefined,
        limit: options.limit,
      },
    },
  )
  return data
}

export async function createReceiveBatch(payload: {
  reference?: string
  receive_date?: string
  note?: string
}): Promise<ReceiveBatchSummary> {
  const { data } = await api.post<{ receive_batch: ReceiveBatchSummary }>(
    '/staff/receive-batches',
    payload,
  )
  return data.receive_batch
}

export async function fetchStaffBankTransferProofs(
  status = 'active',
): Promise<BankTransferProof[]> {
  const { data } = await api.get<{ proofs: BankTransferProof[] }>(
    '/staff/bank-transfer-proofs',
    { params: { status } },
  )
  return data.proofs ?? []
}

export async function markStaffTransferInProgress(id: string): Promise<BankTransferProof> {
  const { data } = await api.post<{ proof: BankTransferProof }>(
    `/staff/bank-transfer-proofs/${id}/in-progress`,
  )
  return data.proof
}

export async function confirmStaffBankTransferProof(id: string): Promise<BankTransferProof> {
  const { data } = await api.post<{ proof: BankTransferProof }>(
    `/staff/bank-transfer-proofs/${id}/confirm`,
  )
  return data.proof
}

export async function rejectStaffBankTransferProof(id: string): Promise<BankTransferProof> {
  const { data } = await api.post<{ proof: BankTransferProof }>(
    `/staff/bank-transfer-proofs/${id}/reject`,
  )
  return data.proof
}
