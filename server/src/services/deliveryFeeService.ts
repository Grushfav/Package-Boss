/**
 * Parish-based home delivery fees (Kingston metro vs Portmore).
 * Mirrors Flask app.services.delivery_fee_service.
 */
import { eq } from 'drizzle-orm'

import { DELIVERY_FEE_KINGSTON_JMD, DELIVERY_FEE_PORTMORE_JMD } from '../constants.js'
import { db } from '../db/index.js'
import { deliveryAddresses, packages, type UserRow } from '../db/schema/index.js'

type PackageRow = typeof packages.$inferSelect

function normalizeParish(parish: string): string {
  return (parish || '').trim().toLowerCase()
}

export function deliveryFeeForParish(parish: string): number {
  if (normalizeParish(parish) === 'st. catherine') {
    return parseFloat(DELIVERY_FEE_PORTMORE_JMD)
  }
  return parseFloat(DELIVERY_FEE_KINGSTON_JMD)
}

export function deliveryFeeAreaForParish(parish: string): string {
  if (normalizeParish(parish) === 'st. catherine') return 'Portmore'
  return 'Kingston & St. Andrew'
}

export function deliveryFeeLabelForParish(parish: string): string {
  const fee = deliveryFeeForParish(parish)
  const area = deliveryFeeAreaForParish(parish)
  const amount = Number.isInteger(fee) ? fee.toLocaleString() : fee.toFixed(2)
  return `Delivery fee (${area}) — J$${amount}`
}

/** Best-effort fee when checkout adds delivery without an open delivery request. */
export async function inferOptionalDeliveryFeeJmd(
  customer: UserRow,
  pkgs: PackageRow[],
): Promise<number> {
  const addressIds = new Set(
    pkgs.map((pkg) => pkg.deliveryAddressId).filter((id): id is string => Boolean(id)),
  )
  if (addressIds.size === 1) {
    const addressId = [...addressIds][0]!
    const [address] = await db
      .select()
      .from(deliveryAddresses)
      .where(eq(deliveryAddresses.id, addressId))
      .limit(1)
    if (address && address.customerId === customer.id) {
      return deliveryFeeForParish(address.parish)
    }
  }
  return parseFloat(DELIVERY_FEE_KINGSTON_JMD)
}
