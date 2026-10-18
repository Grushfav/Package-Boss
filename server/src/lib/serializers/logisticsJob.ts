import {
  LOGISTICS_DELIVERY_SPEED_LABELS,
  LOGISTICS_JOB_STATUS_LABELS,
  LOGISTICS_PAYMENT_METHOD_LABELS,
  LOGISTICS_VEHICLE_TYPE_LABELS,
  LOGISTICS_VEHICLE_TYPE_WEIGHT_LABELS,
} from '../../constants.js'
import type { deliveryAddresses, logisticsJobs, users } from '../../db/schema/index.js'
import { utcIsoformat } from '../dates.js'
import { deliveryAddressToDict } from './deliveryAddress.js'
import { userFullName } from '../user.js'

type JobRow = typeof logisticsJobs.$inferSelect
type AddressRow = typeof deliveryAddresses.$inferSelect
type UserRow = typeof users.$inferSelect

function handlerName(job: JobRow, assignedClerk?: UserRow | null): string | null {
  if (assignedClerk) return userFullName(assignedClerk)
  return job.driverName
}

function displayStatusLabel(job: JobRow, assignedClerk?: UserRow | null): string {
  if (job.status === 'pending' && handlerName(job, assignedClerk)) return 'Driver assigned'
  if (job.status === 'completed' && !job.customerReceiptConfirmedAt) {
    return 'Delivered — confirm receipt'
  }
  return LOGISTICS_JOB_STATUS_LABELS[job.status] ?? job.status
}

function numOrNull(value: string | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function logisticsJobToDict(
  job: JobRow,
  opts: {
    customer?: UserRow | null
    pickupAddress?: AddressRow | null
    dropoffAddress?: AddressRow | null
    assignedClerk?: UserRow | null
    assignedBy?: UserRow | null
    rejectedBy?: UserRow | null
    inProgressBy?: UserRow | null
    pickedUpBy?: UserRow | null
    inTransitBy?: UserRow | null
    completedBy?: UserRow | null
    includeAddresses?: boolean
  } = {},
): Record<string, unknown> {
  const includeAddresses = opts.includeAddresses !== false
  const data: Record<string, unknown> = {
    id: job.id,
    reference: job.reference,
    customer_id: job.customerId,
    pickup_address_id: job.pickupAddressId,
    dropoff_address_id: job.dropoffAddressId,
    item_description: job.itemDescription,
    vehicle_type: job.vehicleType,
    vehicle_type_label: LOGISTICS_VEHICLE_TYPE_LABELS[job.vehicleType ?? ''] ?? job.vehicleType,
    vehicle_weight_label: LOGISTICS_VEHICLE_TYPE_WEIGHT_LABELS[job.vehicleType ?? ''] ?? null,
    delivery_speed: job.deliverySpeed,
    delivery_speed_label:
      LOGISTICS_DELIVERY_SPEED_LABELS[job.deliverySpeed ?? ''] ?? job.deliverySpeed,
    weight_lbs: numOrNull(job.weightLbs),
    notes: job.notes,
    driver_name: job.driverName,
    driver_contact_number: job.driverContactNumber,
    driver_confirmed_at: utcIsoformat(job.driverConfirmedAt),
    payment_method: job.paymentMethod,
    payment_method_label:
      LOGISTICS_PAYMENT_METHOD_LABELS[job.paymentMethod ?? ''] ?? job.paymentMethod,
    assigned_clerk_id: job.assignedClerkId,
    assigned_clerk_name: handlerName(job, opts.assignedClerk),
    assigned_at: utcIsoformat(job.assignedAt),
    assigned_by_name: opts.assignedBy ? userFullName(opts.assignedBy) : null,
    rejected_at: utcIsoformat(job.rejectedAt),
    rejected_by_name: opts.rejectedBy ? userFullName(opts.rejectedBy) : null,
    rejection_reason: job.rejectionReason,
    status: job.status,
    status_label: displayStatusLabel(job, opts.assignedClerk),
    quoted_fee_jmd: numOrNull(job.quotedFeeJmd),
    fee_pending_quote: job.feePendingQuote,
    requested_at: utcIsoformat(job.requestedAt),
    in_progress_at: utcIsoformat(job.inProgressAt),
    in_progress_by_name: opts.inProgressBy ? userFullName(opts.inProgressBy) : null,
    picked_up_at: utcIsoformat(job.pickedUpAt),
    picked_up_by_name: opts.pickedUpBy ? userFullName(opts.pickedUpBy) : null,
    in_transit_at: utcIsoformat(job.inTransitAt),
    in_transit_by_name: opts.inTransitBy ? userFullName(opts.inTransitBy) : null,
    completed_at: utcIsoformat(job.completedAt),
    completed_by_name: opts.completedBy ? userFullName(opts.completedBy) : null,
    customer_receipt_confirmed_at: utcIsoformat(job.customerReceiptConfirmedAt),
    cancelled_at: utcIsoformat(job.cancelledAt),
  }

  if (opts.customer) {
    data.customer_name = userFullName(opts.customer)
    data.shipping_id = opts.customer.shippingId
  }
  if (includeAddresses) {
    if (opts.pickupAddress) data.pickup_address = deliveryAddressToDict(opts.pickupAddress)
    if (opts.dropoffAddress) data.dropoff_address = deliveryAddressToDict(opts.dropoffAddress)
  }
  return data
}
