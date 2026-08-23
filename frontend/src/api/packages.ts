import { api } from './client'
import { presignFilePayload } from '../lib/normalizeUploadFile'
import type { InvoicePresignResponse, Package } from '../types'

export async function fetchMyPackages(): Promise<Package[]> {
  const { data } = await api.get<{ packages: Package[] }>('/me/packages')
  return data.packages
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
