import { api } from './client'
import type {
  AdminOverview,
  AuditLogEntry,
  BankTransferProofSubmissionStats,
  ClerkPermission,
  CustomerSignupStats,
  DeliveryRequestSubmissionStats,
  User,
} from '../types'

export interface ClerkPermissionOption {
  code: ClerkPermission
  label: string
}

export async function fetchClerkPermissionOptions(): Promise<ClerkPermissionOption[]> {
  const { data } = await api.get<{ permissions: ClerkPermissionOption[] }>(
    '/admin/clerk-permissions',
  )
  return data.permissions
}

export async function fetchClerks(): Promise<User[]> {
  const { data } = await api.get<{ clerks: User[] }>('/admin/clerks')
  return data.clerks
}

export async function createClerk(payload: {
  email: string
  first_name: string
  last_name: string
  contact_number?: string
  parish?: string
  permissions?: ClerkPermission[]
}): Promise<User> {
  const { data } = await api.post<{ user: User }>('/admin/clerks', payload)
  return data.user
}

export async function updateClerk(
  userId: string,
  payload: {
    permissions?: ClerkPermission[]
    first_name?: string
    last_name?: string
    contact_number?: string
    parish?: string
  },
): Promise<User> {
  const { data } = await api.patch<{ user: User }>(`/admin/clerks/${userId}`, payload)
  return data.user
}

export async function resendClerkInvite(userId: string): Promise<void> {
  await api.post(`/admin/clerks/${userId}/resend-invite`)
}

export async function deactivateClerk(userId: string): Promise<User> {
  const { data } = await api.delete<{ user: User }>(`/admin/clerks/${userId}`)
  return data.user
}

export async function suspendClerk(userId: string): Promise<User> {
  return deactivateClerk(userId)
}

export async function reactivateClerk(userId: string): Promise<User> {
  const { data } = await api.post<{ user: User }>(`/admin/clerks/${userId}/reactivate`)
  return data.user
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data } = await api.get<AdminOverview>('/admin/stats/overview')
  return {
    ...data,
    customers_today: data.customers_today ?? 0,
    customers_7d: data.customers_7d ?? 0,
    customers_total: data.customers_total ?? 0,
    delivery_requests_active: data.delivery_requests_active ?? 0,
    delivery_requests_today: data.delivery_requests_today ?? 0,
    delivery_requests_total: data.delivery_requests_total ?? 0,
    bank_transfer_proofs_active: data.bank_transfer_proofs_active ?? 0,
    bank_transfer_proofs_today: data.bank_transfer_proofs_today ?? 0,
    bank_transfer_proofs_total: data.bank_transfer_proofs_total ?? 0,
  }
}

export async function fetchCustomerSignupStats(): Promise<CustomerSignupStats> {
  const { data } = await api.get<CustomerSignupStats>('/admin/stats/customer-signups')
  return {
    customers_today: data.customers_today ?? 0,
    customers_7d: data.customers_7d ?? 0,
    customers_total: data.customers_total ?? 0,
  }
}

export async function fetchDeliveryRequestSubmissionStats(): Promise<DeliveryRequestSubmissionStats> {
  const { data } = await api.get<DeliveryRequestSubmissionStats>('/admin/stats/delivery-requests')
  return {
    delivery_requests_active: data.delivery_requests_active ?? 0,
    delivery_requests_today: data.delivery_requests_today ?? 0,
    delivery_requests_7d: data.delivery_requests_7d ?? 0,
    delivery_requests_total: data.delivery_requests_total ?? 0,
  }
}

export async function fetchBankTransferProofSubmissionStats(): Promise<BankTransferProofSubmissionStats> {
  const { data } = await api.get<BankTransferProofSubmissionStats>('/admin/stats/bank-transfer-proofs')
  return {
    bank_transfer_proofs_active: data.bank_transfer_proofs_active ?? 0,
    bank_transfer_proofs_today: data.bank_transfer_proofs_today ?? 0,
    bank_transfer_proofs_7d: data.bank_transfer_proofs_7d ?? 0,
    bank_transfer_proofs_total: data.bank_transfer_proofs_total ?? 0,
  }
}

export async function fetchPackagesTimeline(days = 30): Promise<{ date: string; count: number }[]> {
  const { data } = await api.get<{ timeline: { date: string; count: number }[] }>(
    '/admin/stats/packages-timeline',
    { params: { days } },
  )
  return data.timeline
}

export async function fetchPackagesByStatus(): Promise<
  { status: string; label: string; count: number }[]
> {
  const { data } = await api.get<{
    statuses: { status: string; label: string; count: number }[]
  }>('/admin/stats/by-status')
  return data.statuses
}

export async function fetchWeightDistribution(): Promise<{ label: string; count: number }[]> {
  const { data } = await api.get<{ distribution: { label: string; count: number }[] }>(
    '/admin/stats/weight-distribution',
  )
  return data.distribution
}

export async function fetchPreAlertsVsReceives(
  days = 30,
): Promise<{ date: string; pre_alerts: number; received: number }[]> {
  const { data } = await api.get<{
    series: { date: string; pre_alerts: number; received: number }[]
  }>('/admin/stats/pre-alerts-vs-receives', { params: { days } })
  return data.series
}

export async function fetchActivityLog(
  limit = 50,
  offset = 0,
  action?: string,
): Promise<{ activity: AuditLogEntry[]; total: number }> {
  const { data } = await api.get<{ activity: AuditLogEntry[]; total: number }>(
    '/admin/activity',
    { params: { limit, offset, action: action || undefined } },
  )
  return data
}

export interface CustomerEmailNotificationSettings {
  customer_email_notifications_enabled: boolean
  updated_at: string | null
  updated_by_id: string | null
}

export async function fetchCustomerEmailNotificationSettings(): Promise<CustomerEmailNotificationSettings> {
  const { data } = await api.get<CustomerEmailNotificationSettings>(
    '/admin/settings/customer-email-notifications',
  )
  return data
}

export async function updateCustomerEmailNotificationSettings(
  enabled: boolean,
): Promise<CustomerEmailNotificationSettings> {
  const { data } = await api.patch<CustomerEmailNotificationSettings>(
    '/admin/settings/customer-email-notifications',
    { enabled },
  )
  return data
}