import { api } from './client'
import type { Package, PresignResponse, Shipper, StaffCustomer } from '../types'

export interface WarehouseSummary {
  print_queue_pending: number
  unidentified_count: number
  received_miami_count: number
  packages_today: number
  pending_pre_alerts: number
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
): Promise<PresignResponse> {
  const { data } = await api.post<PresignResponse>('/uploads/presign', {
    shipping_id: shippingId,
    filename,
    content_type: contentType,
  })
  return data
}

export async function presignUnidentifiedUpload(
  filename: string,
  contentType: string,
): Promise<PresignResponse> {
  const { data } = await api.post<PresignResponse>('/uploads/presign-unidentified', {
    filename,
    content_type: contentType,
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
): Promise<{ package: Package; channels_sent: string[] }> {
  const { data } = await api.post<{ package: Package; channels_sent: string[] }>(
    `/staff/packages/${packageId}/request-invoice`,
    payload,
  )
  return data
}

export async function updatePackageBilling(
  packageId: string,
  payload: {
    estimated_freight_usd?: number
    duties_usd?: number
    handling_usd?: number
    other_fees_usd?: number
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
