import { utcIsoformat } from './dates.js'
import type { announcements, broadcastJobs } from '../db/schema/index.js'

type AnnouncementRow = typeof announcements.$inferSelect
type BroadcastJobRow = typeof broadcastJobs.$inferSelect

export function announcementToDict(
  row: AnnouncementRow,
  opts: { includeBody?: boolean; job?: BroadcastJobRow | null } = {},
) {
  const includeBody = opts.includeBody ?? true
  const data: Record<string, unknown> = {
    id: row.id,
    title: row.title,
    severity: row.severity,
    audience: row.audience,
    display_as: row.displayAs,
    starts_at: utcIsoformat(row.startsAt),
    ends_at: utcIsoformat(row.endsAt),
    is_active: row.isActive,
    dismissible: row.dismissible,
    broadcast_at: utcIsoformat(row.broadcastAt),
    created_by_id: row.createdById,
    created_at: utcIsoformat(row.createdAt),
    updated_at: utcIsoformat(row.updatedAt),
  }
  if (includeBody) data.body = row.body
  if (opts.job) data.latest_broadcast = broadcastJobToDict(opts.job)
  return data
}

export function broadcastJobToDict(row: BroadcastJobRow) {
  return {
    id: row.id,
    announcement_id: row.announcementId,
    channels: row.channels ?? [],
    status: row.status,
    sent_count: row.sentCount,
    failed_count: row.failedCount,
    started_at: utcIsoformat(row.startedAt),
    completed_at: utcIsoformat(row.completedAt),
    created_at: utcIsoformat(row.createdAt),
  }
}

export function announcementToBannerDict(row: AnnouncementRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    display_as: row.displayAs,
    dismissible: row.dismissible,
  }
}
