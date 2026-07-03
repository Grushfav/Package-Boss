import { api } from './client'
import type { ShippingAddress } from '../types'

export async function fetchShippingAddress(): Promise<ShippingAddress> {
  const { data } = await api.get<{ shipping_address: ShippingAddress }>('/me/shipping-address')
  return data.shipping_address
}
