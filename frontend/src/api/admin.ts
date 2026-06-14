import { api } from './client'
import type { AdminOverview, AuditLogEntry, User } from '../types'

export async function fetchClerks(): Promise<User[]> {
  const { data } = await api.get<{ clerks: User[] }>('/admin/clerks')
  return data.clerks
}

export async function promoteToClerk(email: string): Promise<User> {
  const { data } = await api.post<{ user: User }>('/admin/clerks', { email })
  return data.user
}

export async function createClerk(payload: {
  email: string
  first_name: string
  last_name: string
  password: string
  contact_number: string
  trn: string
  parish: string
}): Promise<User> {
  const { data } = await api.post<{ user: User }>('/admin/clerks', payload)
  return data.user
}

export async function demoteClerk(userId: string): Promise<User> {
  const { data } = await api.delete<{ user: User }>(`/admin/clerks/${userId}`)
  return data.user
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data } = await api.get<AdminOverview>('/admin/stats/overview')
  return data
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
