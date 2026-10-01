import type { DeliveryAddress } from '../types'

export const DELIVERY_FEE_KINGSTON_JMD = 800
export const DELIVERY_FEE_PORTMORE_JMD = 1000

/** Legacy default (Kingston & St. Andrew). Prefer parish-based helpers below. */
export const DELIVERY_FEE_JMD = DELIVERY_FEE_KINGSTON_JMD

export const DELIVERY_FEE_SUMMARY =
  'Kingston & St. Andrew: $800 JMD · Portmore (St. Catherine): $1,000 JMD'

export function deliveryFeeForParish(parish: string): number {
  if (parish.trim().toLowerCase() === 'st. catherine') {
    return DELIVERY_FEE_PORTMORE_JMD
  }
  return DELIVERY_FEE_KINGSTON_JMD
}

export function deliveryFeeAreaForParish(parish: string): string {
  if (parish.trim().toLowerCase() === 'st. catherine') {
    return 'Portmore'
  }
  return 'Kingston & St. Andrew'
}

export function deliveryFeeForAddress(address: Pick<DeliveryAddress, 'parish' | 'delivery_fee_jmd'>): number {
  if (address.delivery_fee_jmd != null && address.delivery_fee_jmd > 0) {
    return address.delivery_fee_jmd
  }
  return deliveryFeeForParish(address.parish)
}
