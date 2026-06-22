import { api } from './client'
import type { DeliveryAddress } from '../types'

export async function fetchDeliveryAddresses(): Promise<{
  addresses: DeliveryAddress[]
  max_addresses: number
}> {
  const { data } = await api.get<{ addresses: DeliveryAddress[]; max_addresses: number }>(
    '/me/delivery-addresses',
  )
  return data
}

export async function createDeliveryAddress(
  payload: Partial<DeliveryAddress> & { label: string; line1: string; parish: string; contact_number: string },
): Promise<DeliveryAddress> {
  const { data } = await api.post<{ address: DeliveryAddress }>('/me/delivery-addresses', payload)
  return data.address
}

export async function updateDeliveryAddress(
  id: string,
  payload: Partial<DeliveryAddress>,
): Promise<DeliveryAddress> {
  const { data } = await api.patch<{ address: DeliveryAddress }>(
    `/me/delivery-addresses/${id}`,
    payload,
  )
  return data.address
}

export async function deleteDeliveryAddress(id: string): Promise<void> {
  await api.delete(`/me/delivery-addresses/${id}`)
}

export async function setDefaultDeliveryAddress(id: string): Promise<DeliveryAddress> {
  const { data } = await api.post<{ address: DeliveryAddress }>(
    `/me/delivery-addresses/${id}/set-default`,
  )
  return data.address
}

export async function updateWhatsappOptIn(optIn: boolean): Promise<void> {
  await api.patch('/me', { whatsapp_opt_in: optIn })
}
