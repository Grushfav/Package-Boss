import {
  BILLING_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  SHIPPER_LABELS,
  STATUS_LABELS,
  UNIDENTIFIED_HOLDER_SHIPPING_ID,
} from '../../constants.js'
import type {
  deliveryAddresses,
  packageEvents,
  packagePhotos,
  packages,
  receiveBatches,
  shipments,
  users,
} from '../../db/schema/index.js'
import { utcIsoformat } from '../dates.js'
import { deliveryAddressToDict } from './deliveryAddress.js'
import { userFullName } from './user.js'
import { resolveStoredUrl } from '../../services/imageUploadService.js'

type PackageRow = typeof packages.$inferSelect
type PackageEventRow = typeof packageEvents.$inferSelect
type PackagePhotoRow = typeof packagePhotos.$inferSelect
type DeliveryAddressRow = typeof deliveryAddresses.$inferSelect
type ReceiveBatchRow = typeof receiveBatches.$inferSelect
type ShipmentRow = typeof shipments.$inferSelect
type UserRow = typeof users.$inferSelect

export function packageEventToDict(event: PackageEventRow): Record<string, unknown> {
  return {
    id: event.id,
    status: event.status,
    status_label: STATUS_LABELS[event.status] ?? event.status,
    note: event.note,
    created_at: utcIsoformat(event.createdAt),
  }
}

export function packagePhotoToDict(photo: PackagePhotoRow): Record<string, unknown> {
  return {
    id: photo.id,
    object_key: photo.r2ObjectKey,
    url: resolveStoredUrl(photo.r2ObjectKey),
    created_at: utcIsoformat(photo.createdAt),
  }
}

export function packageToDict(
  pkg: PackageRow,
  opts: {
    includeEvents?: boolean
    includePhotos?: boolean
    events?: PackageEventRow[]
    photos?: PackagePhotoRow[]
    deliveryAddress?: DeliveryAddressRow | null
    receiveBatch?: ReceiveBatchRow | null
    shipment?: ShipmentRow | null
  } = {},
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: pkg.id,
    tracking_number: pkg.trackingNumber,
    status: pkg.status,
    status_label: STATUS_LABELS[pkg.status] ?? pkg.status,
    carrier_tracking: pkg.carrierTracking,
    item_description: pkg.itemDescription,
    label_name: pkg.labelName,
    label_boss_id: pkg.labelBossId,
    is_unidentified: pkg.status === 'unidentified',
    shipper: pkg.shipper,
    shipper_label: pkg.shipper ? (SHIPPER_LABELS[pkg.shipper] ?? pkg.shipper) : null,
    actual_weight_lbs: pkg.actualWeightLbs != null ? parseFloat(pkg.actualWeightLbs) : null,
    billable_weight_lbs: pkg.billableWeightLbs,
    estimated_freight_jmd:
      pkg.estimatedFreightJmd != null ? parseFloat(pkg.estimatedFreightJmd) : null,
    duties_jmd: pkg.dutiesJmd != null ? parseFloat(pkg.dutiesJmd) : null,
    handling_jmd: pkg.handlingJmd != null ? parseFloat(pkg.handlingJmd) : null,
    other_fees_jmd: pkg.otherFeesJmd != null ? parseFloat(pkg.otherFeesJmd) : null,
    total_due_jmd: pkg.totalDueJmd != null ? parseFloat(pkg.totalDueJmd) : null,
    currency: 'JMD',
    billing_status: pkg.billingStatus,
    billing_status_label: BILLING_STATUS_LABELS[pkg.billingStatus] ?? pkg.billingStatus,
    invoice_status: pkg.invoiceStatus,
    invoice_status_label: INVOICE_STATUS_LABELS[pkg.invoiceStatus] ?? pkg.invoiceStatus,
    invoice_object_key: pkg.invoiceObjectKey,
    invoice_url: pkg.invoiceObjectKey ? resolveStoredUrl(pkg.invoiceObjectKey) : null,
    declared_value_usd: pkg.declaredValueUsd != null ? parseFloat(pkg.declaredValueUsd) : null,
    invoice_requested_at: utcIsoformat(pkg.invoiceRequestedAt),
    invoice_requested_via: pkg.invoiceRequestedVia,
    invoice_request_note: pkg.invoiceRequestNote,
    invoice_received_at: utcIsoformat(pkg.invoiceReceivedAt),
    delivery_address_id: pkg.deliveryAddressId,
    delivery_address: opts.deliveryAddress ? deliveryAddressToDict(opts.deliveryAddress) : null,
    rate_tier_label: pkg.rateTierLabel,
    label_printed_at: utcIsoformat(pkg.labelPrintedAt),
    received_at: utcIsoformat(pkg.receivedAt),
    receive_batch_id: pkg.receiveBatchId,
    shipment_id: pkg.shipmentId,
    created_at: utcIsoformat(pkg.createdAt),
  }

  if (opts.receiveBatch) {
    data.receive_batch = {
      id: opts.receiveBatch.id,
      batch_code: opts.receiveBatch.batchCode,
      reference: opts.receiveBatch.reference,
      receive_date: opts.receiveBatch.receiveDate,
      status: opts.receiveBatch.status,
    }
  } else {
    data.receive_batch = null
  }

  if (opts.shipment) {
    data.shipment = {
      id: opts.shipment.id,
      reference: opts.shipment.reference,
      departure_date: opts.shipment.departureDate,
      status: opts.shipment.status,
    }
  } else {
    data.shipment = null
  }

  if (opts.includeEvents && opts.events) {
    data.events = opts.events.map(packageEventToDict)
  }
  if (opts.includePhotos && opts.photos) {
    data.photos = opts.photos.map(packagePhotoToDict)
  }

  return data
}

export function warehousePackageListToDict(
  pkg: PackageRow,
  opts: {
    customer?: UserRow | null
    shipment?: ShipmentRow | null
  } = {},
): Record<string, unknown> {
  const customer = opts.customer
  const customerData =
    customer && customer.shippingId !== UNIDENTIFIED_HOLDER_SHIPPING_ID
      ? {
          id: customer.id,
          full_name: userFullName(customer),
          shipping_id: customer.shippingId,
        }
      : null

  const shipmentData = opts.shipment
    ? {
        id: opts.shipment.id,
        reference: opts.shipment.reference,
        departure_date: opts.shipment.departureDate,
        status: opts.shipment.status,
      }
    : null

  return {
    id: pkg.id,
    tracking_number: pkg.trackingNumber,
    carrier_tracking: pkg.carrierTracking,
    item_description: pkg.itemDescription,
    status: pkg.status,
    status_label: STATUS_LABELS[pkg.status] ?? pkg.status,
    invoice_status: pkg.invoiceStatus,
    invoice_status_label: INVOICE_STATUS_LABELS[pkg.invoiceStatus] ?? pkg.invoiceStatus,
    invoice_url: pkg.invoiceObjectKey ? resolveStoredUrl(pkg.invoiceObjectKey) : null,
    billing_status: pkg.billingStatus,
    billing_status_label: BILLING_STATUS_LABELS[pkg.billingStatus] ?? pkg.billingStatus,
    total_due_jmd: pkg.totalDueJmd != null ? parseFloat(pkg.totalDueJmd) : null,
    actual_weight_lbs: pkg.actualWeightLbs != null ? parseFloat(pkg.actualWeightLbs) : null,
    billable_weight_lbs: pkg.billableWeightLbs,
    received_at: utcIsoformat(pkg.receivedAt),
    customer: customerData,
    shipment: shipmentData,
  }
}

export function warehousePackageToDict(
  pkg: PackageRow,
  opts: {
    customer?: UserRow | null
    deliveryAddress?: DeliveryAddressRow | null
    receiveBatch?: ReceiveBatchRow | null
    shipment?: ShipmentRow | null
    events?: PackageEventRow[]
    photos?: PackagePhotoRow[]
  } = {},
): Record<string, unknown> {
  const data = packageToDict(pkg, {
    includeEvents: true,
    includePhotos: true,
    events: opts.events,
    photos: opts.photos,
    deliveryAddress: opts.deliveryAddress,
    receiveBatch: opts.receiveBatch,
    shipment: opts.shipment,
  })

  const customer = opts.customer
  if (customer && customer.shippingId !== UNIDENTIFIED_HOLDER_SHIPPING_ID) {
    data.customer = {
      id: customer.id,
      full_name: userFullName(customer),
      email: customer.email,
      shipping_id: customer.shippingId,
      parish: customer.parish,
    }
  } else {
    data.customer = null
  }
  return data
}
