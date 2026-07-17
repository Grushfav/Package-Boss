import { api } from './client'
import type { DeliveryRequest, PaymentTotalSummary } from '../types'

export const DELIVERY_FEE_JMD = 800

export async function fetchMyDeliveryRequests(): Promise<DeliveryRequest[]> {
  const { data } = await api.get<{ delivery_requests: DeliveryRequest[] }>('/me/delivery-requests')
  return data.delivery_requests
}

export async function createDeliveryRequest(payload: {
  package_ids: string[]
  delivery_address_id: string
  notes?: string
}): Promise<DeliveryRequest> {
  const { data } = await api.post<{ delivery_request: DeliveryRequest }>(
    '/me/delivery-requests',
    payload,
  )
  return data.delivery_request
}

export async function cancelDeliveryRequest(id: string): Promise<DeliveryRequest> {
  const { data } = await api.delete<{ delivery_request: DeliveryRequest }>(
    `/me/delivery-requests/${id}`,
  )
  return data.delivery_request
}

export async function fetchPaymentTotal(packageIds: string[]): Promise<PaymentTotalSummary> {
  const { data } = await api.post<PaymentTotalSummary>('/me/payment-total', {
    package_ids: packageIds,
  })
  return data
}

export async function fetchStaffDeliveryRequests(
  status = 'active',
): Promise<DeliveryRequest[]> {
  const { data } = await api.get<{ delivery_requests: DeliveryRequest[] }>(
    '/staff/delivery-requests',
    { params: { status } },
  )
  return data.delivery_requests ?? []
}

export async function markStaffDeliveryInProgress(id: string): Promise<DeliveryRequest> {
  const { data } = await api.post<{ delivery_request: DeliveryRequest }>(
    `/staff/delivery-requests/${id}/in-progress`,
  )
  return data.delivery_request
}

export async function completeStaffDeliveryRequest(id: string): Promise<DeliveryRequest> {
  const { data } = await api.post<{ delivery_request: DeliveryRequest }>(
    `/staff/delivery-requests/${id}/complete`,
  )
  return data.delivery_request
}

export async function cancelStaffDeliveryRequest(id: string): Promise<DeliveryRequest> {
  const { data } = await api.post<{ delivery_request: DeliveryRequest }>(
    `/staff/delivery-requests/${id}/cancel`,
  )
  return data.delivery_request
}
