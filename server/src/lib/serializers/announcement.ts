import type { announcements } from '../../db/schema/index.js'
import { utcIsoformat } from '../dates.js'

type AnnouncementRow = typeof announcements.$inferSelect

export function announcementToDict(
  announcement: AnnouncementRow,
  opts: { includeBody?: boolean } = {},
): Record<string, unknown> {
  const includeBody = opts.includeBody !== false
  const data: Record<string, unknown> = {
    id: announcement.id,
    title: announcement.title,
    severity: announcement.severity,
    audience: announcement.audience,
    display_as: announcement.displayAs,
    starts_at: utcIsoformat(announcement.startsAt),
    ends_at: utcIsoformat(announcement.endsAt),
    is_active: announcement.isActive,
    dismissible: announcement.dismissible,
    broadcast_at: utcIsoformat(announcement.broadcastAt),
    created_by_id: announcement.createdById,
    created_at: utcIsoformat(announcement.createdAt),
    updated_at: utcIsoformat(announcement.updatedAt),
  }
  if (includeBody) data.body = announcement.body
  return data
}

export function announcementToBannerDict(announcement: AnnouncementRow): Record<string, unknown> {
  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    severity: announcement.severity,
    display_as: announcement.displayAs,
    dismissible: announcement.dismissible,
  }
}
