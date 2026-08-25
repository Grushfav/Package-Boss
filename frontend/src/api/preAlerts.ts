import { api } from './client'
import { presignFilePayload } from '../lib/normalizeUploadFile'
import type { InvoicePresignResponse, PreAlert, Shipper } from '../types'

export async function fetchPreAlertShippers(): Promise<Shipper[]> {
  const { data } = await api.get<{ shippers: Shipper[] }>('/me/shippers')
  return data.shippers
}

export async function fetchMyPreAlerts(): Promise<PreAlert[]> {
  const { data } = await api.get<{ pre_alerts: PreAlert[] }>('/me/pre-alerts')
  return data.pre_alerts
}

export async function createPreAlert(payload: {
  carrier_tracking: string
  merchant: string
  description: string
  declared_value_usd: number
  invoice_object_key?: string
}): Promise<PreAlert> {
  const { data } = await api.post<{ pre_alert: PreAlert }>('/me/pre-alerts', payload)
  return data.pre_alert
}

export async function fetchPreAlert(id: string): Promise<PreAlert> {
  const { data } = await api.get<{ pre_alert: PreAlert }>(`/me/pre-alerts/${id}`)
  return data.pre_alert
}

export async function updatePreAlert(
  id: string,
  payload: {
    carrier_tracking?: string
    invoice_object_key?: string | null
    merchant?: string | null
    description?: string | null
    declared_value_usd?: number | null
  },
): Promise<PreAlert> {
  const { data } = await api.patch<{ pre_alert: PreAlert }>(`/me/pre-alerts/${id}`, payload)
  return data.pre_alert
}

export async function deletePreAlert(id: string): Promise<PreAlert> {
  const { data } = await api.delete<{ pre_alert: PreAlert }>(`/me/pre-alerts/${id}`)
  return data.pre_alert
}

/** @deprecated Use deletePreAlert */
export const cancelPreAlert = deletePreAlert

export async function presignInvoiceUpload(
  filename: string,
  contentType: string,
  contentLength: number,
): Promise<InvoicePresignResponse> {
  const { data } = await api.post<InvoicePresignResponse>('/me/uploads/invoice/presign', {
    ...presignFilePayload({ filename, contentType, contentLength }),
  })
  return data
}
