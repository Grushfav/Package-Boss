import { PAYMENT_METHOD_LABELS } from '../../constants.js'
import type { packages, paymentCheckoutItems, paymentCheckouts, users } from '../../db/schema/index.js'
import { utcIsoformat } from '../dates.js'
import { userFullName } from './user.js'

type CheckoutRow = typeof paymentCheckouts.$inferSelect
type CheckoutItemRow = typeof paymentCheckoutItems.$inferSelect
type PackageRow = typeof packages.$inferSelect
type UserRow = typeof users.$inferSelect

export function paymentCheckoutItemToDict(
  item: CheckoutItemRow,
  opts: { includePackage?: boolean; pkg?: PackageRow | null } = {},
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: item.id,
    checkout_id: item.checkoutId,
    package_id: item.packageId,
    amount_jmd: parseFloat(item.amountJmd),
  }
  if (opts.includePackage && opts.pkg) {
    data.tracking_number = opts.pkg.trackingNumber
  }
  return data
}

export function paymentCheckoutToDict(
  checkout: CheckoutRow,
  opts: {
    includeItems?: boolean
    items?: Array<{ item: CheckoutItemRow; pkg?: PackageRow | null }>
    recordedBy?: UserRow | null
  } = {},
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: checkout.id,
    customer_id: checkout.customerId,
    invoice_number: checkout.invoiceNumber,
    total_jmd: parseFloat(checkout.totalJmd),
    method: checkout.method,
    method_label: PAYMENT_METHOD_LABELS[checkout.method] ?? checkout.method,
    reference: checkout.reference,
    notes: checkout.notes,
    recorded_by_id: checkout.recordedById,
    recorded_by_name: opts.recordedBy ? userFullName(opts.recordedBy) : null,
    recorded_at: utcIsoformat(checkout.recordedAt),
    delivery_request_id: checkout.deliveryRequestId,
    delivery_fee_jmd: checkout.deliveryFeeJmd != null ? parseFloat(checkout.deliveryFeeJmd) : null,
    processing_fee_jmd:
      checkout.processingFeeJmd != null ? parseFloat(checkout.processingFeeJmd) : null,
    package_count: opts.items?.length ?? 0,
  }

  if (opts.includeItems && opts.items) {
    data.items = opts.items.map(({ item, pkg }) =>
      paymentCheckoutItemToDict(item, { includePackage: true, pkg }),
    )
  }
  return data
}

export function packagePaymentSummary(
  item: CheckoutItemRow,
  checkout: CheckoutRow,
  recordedBy: UserRow | null,
): Record<string, unknown> {
  return {
    checkout_id: checkout.id,
    invoice_number: checkout.invoiceNumber,
    amount_jmd: parseFloat(item.amountJmd),
    method: checkout.method,
    method_label: PAYMENT_METHOD_LABELS[checkout.method] ?? checkout.method,
    reference: checkout.reference,
    notes: checkout.notes,
    recorded_by_name: recordedBy ? userFullName(recordedBy) : null,
    recorded_at: utcIsoformat(checkout.recordedAt),
  }
}
