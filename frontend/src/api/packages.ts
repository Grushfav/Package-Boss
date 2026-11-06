import { api } from './client'
import { presignFilePayload } from '../lib/normalizeUploadFile'
import type { InvoicePresignResponse, Package } from '../types'

export type PackageListScope = 'active' | 'completed' | 'payable'

export interface PackagePage {
  packages: Package[]
  total: number
  limit: number
  offset: number
  readyForPickupCount: number
}

export async function fetchMyPackagePage(
  scope: PackageListScope,
  limit: number,
  offset: number,
): Promise<PackagePage> {
  const { data } = await api.get<{
    packages?: Package[]
    total?: number
    limit?: number
    offset?: number
    ready_for_pickup_count?: number
  }>('/me/packages', { params: { scope, limit, offset } })
  return {
    packages: data.packages ?? [],
    total: data.total ?? 0,
    limit: data.limit ?? limit,
    offset: data.offset ?? offset,
    readyForPickupCount: data.ready_for_pickup_count ?? 0,
  }
}

export async function fetchMyPackage(id: string): Promise<Package> {
  const { data } = await api.get<{ package: Package }>(`/me/packages/${id}`)
  return data.package
}

export async function fetchMyPackageBillInvoiceHtml(packageId: string): Promise<string> {
  const { data } = await api.get<string>(`/me/packages/${packageId}/bill-invoice`, {
    responseType: 'text',
    transformResponse: [(value) => value],
  })
  return data
}

export async function presignPackageInvoice(
  packageId: string,
  filename: string,
  contentType: string,
  contentLength: number,
): Promise<InvoicePresignResponse> {
  const { data } = await api.post<InvoicePresignResponse>(
    `/me/packages/${packageId}/invoice/presign`,
    presignFilePayload({ filename, contentType, contentLength }),
  )
  return data
}

export async function submitPackageInvoice(
  packageId: string,
  payload: { invoice_object_key: string; declared_value_usd?: number },
): Promise<Package> {
  const { data } = await api.post<{ package: Package }>(
    `/me/packages/${packageId}/invoice`,
    payload,
  )
  return data.package
}
