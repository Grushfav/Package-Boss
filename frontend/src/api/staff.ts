import { api } from './client'
import type { Package, PresignResponse, Shipper, StaffCustomer } from '../types'

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
