import { DELIVERY_REQUEST_STATUS_LABELS, STATUS_LABELS } from '../../constants.js'
import type {
  deliveryAddresses,
  deliveryRequestPackages,
  deliveryRequests,
  packages,
  users,
} from '../../db/schema/index.js'
import { utcIsoformat } from '../dates.js'
import { deliveryAddressToDict } from './deliveryAddress.js'
import { userFullName } from './user.js'

type DeliveryRequestRow = typeof deliveryRequests.$inferSelect
type DeliveryRequestPackageRow = typeof deliveryRequestPackages.$inferSelect
type PackageRow = typeof packages.$inferSelect
type DeliveryAddressRow = typeof deliveryAddresses.$inferSelect
type UserRow = typeof users.$inferSelect

export function deliveryRequestPackageToDict(
  link: DeliveryRequestPackageRow,
  pkg?: PackageRow | null,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: link.id,
    delivery_request_id: link.deliveryRequestId,
    package_id: link.packageId,
  }
  if (pkg) {
    data.tracking_number = pkg.trackingNumber
    data.total_due_jmd = pkg.totalDueJmd != null ? parseFloat(pkg.totalDueJmd) : null
    data.billing_status = pkg.billingStatus
    data.status = pkg.status
    data.status_label = STATUS_LABELS[pkg.status] ?? pkg.status
  }
  return data
}

export function deliveryRequestToDict(
  request: DeliveryRequestRow,
  opts: {
    includePackages?: boolean
    includeAddress?: boolean
    packageLinks?: Array<{ link: DeliveryRequestPackageRow; pkg?: PackageRow | null }>
    deliveryAddress?: DeliveryAddressRow | null
    customer?: UserRow | null
    completedBy?: UserRow | null
    inProgressBy?: UserRow | null
  } = {},
): Record<string, unknown> {
  const includeAddress = opts.includeAddress !== false
  const data: Record<string, unknown> = {
    id: request.id,
    customer_id: request.customerId,
    delivery_address_id: request.deliveryAddressId,
    status: request.status,
    status_label: DELIVERY_REQUEST_STATUS_LABELS[request.status] ?? request.status,
    delivery_fee_jmd: parseFloat(request.deliveryFeeJmd),
    notes: request.notes,
    requested_at: utcIsoformat(request.requestedAt),
    completed_at: utcIsoformat(request.completedAt),
    completed_by_name: opts.completedBy ? userFullName(opts.completedBy) : null,
    in_progress_at: utcIsoformat(request.inProgressAt),
    in_progress_by_name: opts.inProgressBy ? userFullName(opts.inProgressBy) : null,
    cancelled_at: utcIsoformat(request.cancelledAt),
    package_count: opts.packageLinks?.length ?? 0,
  }
  if (includeAddress && opts.deliveryAddress) {
    data.delivery_address = deliveryAddressToDict(opts.deliveryAddress)
  }
  if (opts.includePackages && opts.packageLinks) {
    data.packages = opts.packageLinks.map(({ link, pkg }) => deliveryRequestPackageToDict(link, pkg))
  }
  if (opts.customer) {
    data.customer_name = userFullName(opts.customer)
    data.shipping_id = opts.customer.shippingId
  }
  return data
}
