import type { Shipper } from '../types'

/** Map stored merchant (code or legacy free text) to a shipper dropdown value. */
export function resolveMerchantCode(
  merchant: string | null | undefined,
  shippers: Shipper[],
): string {
  if (!merchant?.trim()) return ''
  const trimmed = merchant.trim()
  const byCode = shippers.find((item) => item.code === trimmed)
  if (byCode) return byCode.code
  const lowered = trimmed.toLowerCase()
  const byLabel = shippers.find((item) => item.label.toLowerCase() === lowered)
  if (byLabel) return byLabel.code
  return shippers.some((item) => item.code === 'other') ? 'other' : ''
}

export function merchantDisplayLabel(
  alert: { merchant?: string | null; merchant_label?: string | null },
  shippers: Shipper[],
): string | null {
  if (alert.merchant_label) return alert.merchant_label
  if (!alert.merchant) return null
  return shippers.find((item) => item.code === alert.merchant)?.label ?? alert.merchant
}
