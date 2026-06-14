import type { ShippingAddress } from '../types'

const CACHE_KEY = 'package-boss-shipping-address'

export function cacheShippingAddress(address: ShippingAddress) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(address))
}

export function getCachedShippingAddress(): ShippingAddress | null {
  const raw = localStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ShippingAddress
  } catch {
    return null
  }
}

export function clearCachedShippingAddress() {
  localStorage.removeItem(CACHE_KEY)
}
