import { api } from './client'

export type AnnouncementAudience = 'public' | 'customers' | 'staff' | 'all'
export type AnnouncementSeverity = 'info' | 'warning' | 'urgent'
export type AnnouncementDisplayAs = 'banner' | 'modal' | 'inbox_only'
export type AnnouncementTargetMode = 'broadcast' | 'targeted'
export type AnnouncementContext = 'public' | 'customer' | 'staff'
export type BroadcastChannel = 'in_app' | 'email'

export interface AnnouncementTargetCriteria {
  package_ids?: string[]
  shipment_id?: string
  /** @deprecated Use package_statuses */
  package_status?: string
  package_statuses?: string[]
}

export interface AnnouncementRecipientPreviewCustomer {
  user_id: string
  name: string
  email: string | null
  package_count: number
  tracking_numbers: string[]
}

export interface AnnouncementRecipientPreview {
  package_count: number
  customer_count: number
  customers: AnnouncementRecipientPreviewCustomer[]
}

export interface BroadcastJob {
  id: string
  announcement_id: string
  channels: BroadcastChannel[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  sent_count: number
  failed_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  severity: AnnouncementSeverity
  audience: AnnouncementAudience
  target_mode: AnnouncementTargetMode
  target_criteria: AnnouncementTargetCriteria | null
  display_as: AnnouncementDisplayAs
  starts_at: string
  ends_at: string | null
  is_active: boolean
  dismissible: boolean
  broadcast_at: string | null
  created_by_id: string | null
  created_at: string
  updated_at: string
  is_read?: boolean
  latest_broadcast?: BroadcastJob
}

export interface AnnouncementBanner {
  id: string
  title: string
  body: string
  severity: AnnouncementSeverity
  display_as: AnnouncementDisplayAs
  dismissible: boolean
}

export interface ActiveAnnouncementsResponse {
  banner: AnnouncementBanner | null
  modals: AnnouncementBanner[]
}

export async function fetchActiveAnnouncements(
  context: AnnouncementContext,
): Promise<ActiveAnnouncementsResponse> {
  const { data } = await api.get<ActiveAnnouncementsResponse>('/announcements/active', {
    params: { context },
  })
  return data
}

export async function fetchMyAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<{ announcements: Announcement[] }>('/me/announcements')
  return data.announcements
}

export async function dismissAnnouncement(id: string): Promise<void> {
  await api.post(`/me/announcements/${id}/dismiss`)
}

export async function markAnnouncementRead(id: string): Promise<void> {
  await api.post(`/me/announcements/${id}/read`)
}

export async function fetchAdminAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<{ announcements: Announcement[] }>('/admin/announcements')
  return data.announcements
}

export async function previewAnnouncementRecipients(
  targetCriteria: AnnouncementTargetCriteria,
): Promise<AnnouncementRecipientPreview> {
  const { data } = await api.post<{ preview: AnnouncementRecipientPreview }>(
    '/admin/announcements/preview-recipients',
    { target_criteria: targetCriteria },
  )
  return data.preview
}

export async function createAnnouncement(payload: {
  title: string
  body: string
  severity: AnnouncementSeverity
  audience: AnnouncementAudience
  target_mode?: AnnouncementTargetMode
  target_criteria?: AnnouncementTargetCriteria | null
  display_as: AnnouncementDisplayAs
  starts_at?: string
  ends_at?: string | null
  is_active?: boolean
  dismissible?: boolean
}): Promise<Announcement> {
  const { data } = await api.post<{ announcement: Announcement }>('/admin/announcements', payload)
  return data.announcement
}

export async function updateAnnouncement(
  id: string,
  payload: Partial<{
    title: string
    body: string
    severity: AnnouncementSeverity
    audience: AnnouncementAudience
    target_mode?: AnnouncementTargetMode
    target_criteria?: AnnouncementTargetCriteria | null
    display_as: AnnouncementDisplayAs
    starts_at: string
    ends_at: string | null
    is_active: boolean
    dismissible: boolean
  }>,
): Promise<Announcement> {
  const { data } = await api.patch<{ announcement: Announcement }>(
    `/admin/announcements/${id}`,
    payload,
  )
  return data.announcement
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/admin/announcements/${id}`)
}

export async function broadcastAnnouncement(
  id: string,
  payload: { channels: BroadcastChannel[]; also_show_banner?: boolean },
): Promise<{ announcement: Announcement; broadcast_job: BroadcastJob }> {
  const { data } = await api.post<{ announcement: Announcement; broadcast_job: BroadcastJob }>(
    `/admin/announcements/${id}/broadcast`,
    payload,
  )
  return data
}
