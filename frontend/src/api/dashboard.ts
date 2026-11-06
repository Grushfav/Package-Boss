import type { DashboardPackageStats } from '../lib/dashboardStats'
import type { DeliveryAddress, ShippingAddress } from '../types'
import { api } from './client'

interface CustomerDashboardPayload {
  stats?: {
    received_fort_lauderdale?: number
    in_transit?: number
    customs?: number
    ready_pickup_delivery?: number
    payable_package_count?: number
    handling_fee_jmd?: number
    total_due_jmd?: number
    invoice_action_count?: number
  }
  default_delivery_address?: DeliveryAddress | null
  shipping_address?: ShippingAddress
}

export interface CustomerDashboard {
  stats: DashboardPackageStats
  invoiceActionCount: number
  defaultDeliveryAddress: DeliveryAddress | null
  shippingAddress: ShippingAddress | null
}

export async function fetchCustomerDashboard(): Promise<CustomerDashboard> {
  const { data } = await api.get<CustomerDashboardPayload>('/me/dashboard')
  const stats = data.stats
  return {
    stats: {
      receivedFortLauderdale: stats?.received_fort_lauderdale ?? 0,
      inTransit: stats?.in_transit ?? 0,
      customs: stats?.customs ?? 0,
      readyPickupDelivery: stats?.ready_pickup_delivery ?? 0,
      payablePackageCount: stats?.payable_package_count ?? 0,
      handlingFeeJmd: stats?.handling_fee_jmd ?? 0,
      totalDueJmd: stats?.total_due_jmd ?? 0,
    },
    invoiceActionCount: stats?.invoice_action_count ?? 0,
    defaultDeliveryAddress: data.default_delivery_address ?? null,
    shippingAddress: data.shipping_address ?? null,
  }
}
