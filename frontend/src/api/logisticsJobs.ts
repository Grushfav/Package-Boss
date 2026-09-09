import { api } from './client'
import type { DeliveryAddress, LogisticsJob } from '../types'

export const LOGISTICS_IN_HOUSE_FEE_JMD = 800
export const LOGISTICS_ISLAND_FEE_JMD = 1500

export const LOGISTICS_ITEM_CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'documents', label: 'Documents' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'other', label: 'Other' },
] as const

export type LogisticsItemCategory = (typeof LOGISTICS_ITEM_CATEGORIES)[number]['value']

export const LOGISTICS_VEHICLE_TYPES = [
  { value: 'bike', label: 'Bike rider', weightLabel: '1–10 lbs' },
  { value: 'car', label: 'Car', weightLabel: '10+ lbs' },
  { value: 'truck', label: 'Truck', weightLabel: 'Heavy / bulk' },
] as const

export type LogisticsVehicleType = (typeof LOGISTICS_VEHICLE_TYPES)[number]['value']

export const LOGISTICS_DELIVERY_SPEEDS = [
  { value: 'immediate', label: 'Immediate', description: 'As soon as possible' },
  { value: 'next_day', label: 'Next day', description: 'Following business day' },
] as const

export type LogisticsDeliverySpeed = (typeof LOGISTICS_DELIVERY_SPEEDS)[number]['value']

export const LOGISTICS_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', description: 'Pay the driver in cash on delivery' },
  {
    value: 'online',
    label: 'Online payment',
    description: 'Coming soon',
    disabled: true,
  },
] as const

export type LogisticsPaymentMethod = (typeof LOGISTICS_PAYMENT_METHODS)[number]['value']

export type InlineAddressPayload = Partial<DeliveryAddress> & {
  label: string
  line1: string
  parish: string
  contact_number: string
}

export async function fetchMyLogisticsJobs(): Promise<LogisticsJob[]> {
  const { data } = await api.get<{ logistics_jobs: LogisticsJob[] }>('/me/logistics-jobs')
  return data.logistics_jobs ?? []
}

export async function createLogisticsJob(payload: {
  pickup_address_id?: string
  pickup_address?: InlineAddressPayload
  dropoff_address_id?: string
  dropoff_address?: InlineAddressPayload
  item_category?: LogisticsItemCategory
  item_other_detail?: string
  item_description?: string
  vehicle_type: LogisticsVehicleType
  delivery_speed?: LogisticsDeliverySpeed
  payment_method?: LogisticsPaymentMethod
  weight_lbs?: number | null
  notes?: string
}): Promise<LogisticsJob> {
  const { data } = await api.post<{ logistics_job: LogisticsJob }>('/me/logistics-jobs', payload)
  return data.logistics_job
}

export async function cancelLogisticsJob(id: string): Promise<LogisticsJob> {
  const { data } = await api.delete<{ logistics_job: LogisticsJob }>(`/me/logistics-jobs/${id}`)
  return data.logistics_job
}

export async function updateLogisticsJobNotes(id: string, notes: string): Promise<LogisticsJob> {
  const { data } = await api.patch<{ logistics_job: LogisticsJob }>(
    `/me/logistics-jobs/${id}/notes`,
    { notes },
  )
  return data.logistics_job
}

export async function confirmLogisticsJobReceipt(id: string): Promise<LogisticsJob> {
  const { data } = await api.post<{ logistics_job: LogisticsJob }>(
    `/me/logistics-jobs/${id}/confirm-receipt`,
  )
  return data.logistics_job
}

export async function confirmStaffLogisticsDriver(
  id: string,
  payload: { driver_name: string; driver_contact_number: string },
): Promise<LogisticsJob> {
  const { data } = await api.post<{ logistics_job: LogisticsJob }>(
    `/staff/logistics-jobs/${id}/confirm-driver`,
    payload,
  )
  return data.logistics_job
}

export async function fetchMyStaffLogisticsJobs(
  status = 'active',
): Promise<LogisticsJob[]> {
  const { data } = await api.get<{ logistics_jobs: LogisticsJob[] }>('/staff/me/logistics-jobs', {
    params: { status },
  })
  return data.logistics_jobs ?? []
}

export async function fetchStaffLogisticsJobs(status = 'active'): Promise<LogisticsJob[]> {
  const { data } = await api.get<{ logistics_jobs: LogisticsJob[] }>('/staff/logistics-jobs', {
    params: { status },
  })
  return data.logistics_jobs ?? []
}

export async function markStaffLogisticsPickedUp(id: string): Promise<LogisticsJob> {
  const { data } = await api.post<{ logistics_job: LogisticsJob }>(
    `/staff/logistics-jobs/${id}/picked-up`,
  )
  return data.logistics_job
}

export async function markStaffLogisticsInTransit(id: string): Promise<LogisticsJob> {
  const { data } = await api.post<{ logistics_job: LogisticsJob }>(
    `/staff/logistics-jobs/${id}/in-transit`,
  )
  return data.logistics_job
}

export async function completeStaffLogisticsJob(id: string): Promise<LogisticsJob> {
  const { data } = await api.post<{ logistics_job: LogisticsJob }>(
    `/staff/logistics-jobs/${id}/complete`,
  )
  return data.logistics_job
}

export async function cancelStaffLogisticsJob(id: string): Promise<LogisticsJob> {
  const { data } = await api.post<{ logistics_job: LogisticsJob }>(
    `/staff/logistics-jobs/${id}/cancel`,
  )
  return data.logistics_job
}

export function estimateLogisticsFee(
  pickupParish: string,
  dropoffParish: string,
  inHouseParishes: string[] = ['Kingston', 'St. Andrew', 'St. Catherine'],
): { feeJmd: number | null; feePendingQuote: boolean } {
  const pickupInHouse = inHouseParishes.includes(pickupParish)
  const dropoffInHouse = inHouseParishes.includes(dropoffParish)
  if (pickupInHouse && dropoffInHouse) {
    return { feeJmd: LOGISTICS_IN_HOUSE_FEE_JMD, feePendingQuote: false }
  }
  if (pickupInHouse || dropoffInHouse) {
    return { feeJmd: LOGISTICS_ISLAND_FEE_JMD, feePendingQuote: false }
  }
  return { feeJmd: null, feePendingQuote: true }
}
