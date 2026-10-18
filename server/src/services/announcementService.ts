import { and, desc, eq, gt, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  announcementDismissals,
  announcementReads,
  announcements,
  broadcastJobs,
  users,
  type UserRow,
} from '../db/schema/index.js'
import { announcementToBannerDict, announcementToDict } from '../lib/serializers/announcement.js'

const CONTEXT_AUDIENCES: Record<string, string[]> = {
  public: ['public', 'all'],
  customer: ['public', 'customers', 'all'],
  staff: ['public', 'staff', 'all'],
}

const SEVERITY_ORDER: Record<string, number> = { urgent: 3, warning: 2, info: 1 }

function audiencesForContext(context: string): string[] {
  return CONTEXT_AUDIENCES[context] ?? CONTEXT_AUDIENCES.public!
}

function activeTimeFilter() {
  const now = new Date()
  return and(
    eq(announcements.isActive, true),
    lte(announcements.startsAt, now),
    or(isNull(announcements.endsAt), gt(announcements.endsAt, now)),
  )
}

export async function listActiveBanners(context: string, user?: UserRow | null) {
  const audiences = audiencesForContext(context)
  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        activeTimeFilter(),
        inArray(announcements.audience, audiences),
        inArray(announcements.displayAs, ['banner', 'modal']),
      ),
    )

  let dismissedIds = new Set<string>()
  if (user) {
    const dismissals = await db
      .select()
      .from(announcementDismissals)
      .where(eq(announcementDismissals.userId, user.id))
    dismissedIds = new Set(dismissals.map((d) => d.announcementId))
  }

  const visible = rows.filter((a) => !dismissedIds.has(a.id))
  visible.sort((a, b) => {
    const sev = (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0)
    if (sev !== 0) return sev
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  })

  return visible.map(announcementToBannerDict)
}

export function pickPrimaryBanner(banners: Array<Record<string, unknown>>) {
  if (!banners.length) return null
  const bannerType = banners.find((b) => b.display_as === 'banner')
  return bannerType ?? banners[0] ?? null
}

export async function listUserInbox(user: UserRow) {
  let audiences = audiencesForContext(user.role === 'customer' ? 'customer' : 'staff')
  if (user.role === 'admin') audiences = ['public', 'customers', 'staff', 'all']

  const now = new Date()
  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        isNotNull(announcements.broadcastAt),
        inArray(announcements.audience, audiences),
        eq(announcements.isActive, true),
        or(isNull(announcements.endsAt), gt(announcements.endsAt, now)),
      ),
    )
    .orderBy(desc(announcements.broadcastAt))
    .limit(100)

  const reads = await db
    .select()
    .from(announcementReads)
    .where(eq(announcementReads.userId, user.id))
  const readIds = new Set(reads.map((r) => r.announcementId))

  return rows.map((a) => ({
    ...announcementToDict(a, { includeBody: true }),
    is_read: readIds.has(a.id),
  }))
}

export async function dismissAnnouncement(user: UserRow, announcementId: string): Promise<void> {
  const [announcement] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1)
  if (!announcement) throw new Error('Announcement not found')
  if (!announcement.dismissible) throw new Error('This announcement cannot be dismissed')

  const [existing] = await db
    .select()
    .from(announcementDismissals)
    .where(
      and(
        eq(announcementDismissals.userId, user.id),
        eq(announcementDismissals.announcementId, announcementId),
      ),
    )
    .limit(1)
  if (existing) return

  await db.insert(announcementDismissals).values({
    userId: user.id,
    announcementId,
  })
}

export async function markAnnouncementRead(user: UserRow, announcementId: string): Promise<void> {
  const [announcement] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1)
  if (!announcement) throw new Error('Announcement not found')

  const [existing] = await db
    .select()
    .from(announcementReads)
    .where(and(eq(announcementReads.userId, user.id), eq(announcementReads.announcementId, announcementId)))
    .limit(1)
  if (existing) return

  await db.insert(announcementReads).values({
    userId: user.id,
    announcementId,
  })
}

const ANNOUNCEMENT_AUDIENCES = ['public', 'customers', 'staff', 'all'] as const
const ANNOUNCEMENT_SEVERITIES = ['info', 'warning', 'urgent'] as const
const ANNOUNCEMENT_DISPLAY_TYPES = ['banner', 'modal', 'inbox_only'] as const
const BROADCAST_CHANNELS = ['in_app', 'email'] as const

function parseDt(value: unknown, fieldName: string): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return value
  try {
    return new Date(String(value).replace('Z', '+00:00'))
  } catch {
    throw new Error(`Invalid ${fieldName}`)
  }
}

function validateAnnouncementData(data: Record<string, unknown>, partial = false) {
  const cleaned: Record<string, unknown> = {}

  if ('title' in data || !partial) {
    const title = String(data.title ?? '').trim()
    if (!title) throw new Error('Title is required')
    if (title.length > 120) throw new Error('Title must be 120 characters or fewer')
    cleaned.title = title
  }
  if ('body' in data || !partial) {
    const body = String(data.body ?? '').trim()
    if (!body) throw new Error('Message body is required')
    if (body.length > 5000) throw new Error('Message body must be 5000 characters or fewer')
    cleaned.body = body
  }
  if ('severity' in data || !partial) {
    const severity = String(data.severity ?? 'info').trim().toLowerCase()
    if (!(ANNOUNCEMENT_SEVERITIES as readonly string[]).includes(severity)) throw new Error('Invalid severity')
    cleaned.severity = severity
  }
  if ('audience' in data || !partial) {
    const audience = String(data.audience ?? 'customers').trim().toLowerCase()
    if (!(ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(audience)) throw new Error('Invalid audience')
    cleaned.audience = audience
  }
  if ('display_as' in data || !partial) {
    const displayAs = String(data.display_as ?? 'banner').trim().toLowerCase()
    if (!(ANNOUNCEMENT_DISPLAY_TYPES as readonly string[]).includes(displayAs)) {
      throw new Error('Invalid display type')
    }
    cleaned.display_as = displayAs
  }
  if ('starts_at' in data) cleaned.starts_at = parseDt(data.starts_at, 'starts_at') ?? new Date()
  else if (!partial) cleaned.starts_at = new Date()
  if ('ends_at' in data) cleaned.ends_at = parseDt(data.ends_at, 'ends_at')
  if ('is_active' in data) cleaned.is_active = Boolean(data.is_active)
  if ('dismissible' in data) cleaned.dismissible = Boolean(data.dismissible)

  const startsAt = cleaned.starts_at as Date | undefined
  const endsAt = cleaned.ends_at as Date | null | undefined
  if (endsAt && startsAt && endsAt <= startsAt) throw new Error('End date must be after start date')

  return cleaned
}

export async function listAdminAnnouncements() {
  return db.select().from(announcements).orderBy(desc(announcements.createdAt))
}

export async function getAnnouncement(announcementId: string) {
  const [row] = await db.select().from(announcements).where(eq(announcements.id, announcementId)).limit(1)
  return row ?? null
}

export async function createAnnouncement(actor: UserRow, data: Record<string, unknown>) {
  const cleaned = validateAnnouncementData(data)
  const dismissible = cleaned.dismissible !== false
  const [announcement] = await db
    .insert(announcements)
    .values({
      title: cleaned.title as string,
      body: cleaned.body as string,
      severity: (cleaned.severity as string) ?? 'info',
      audience: (cleaned.audience as string) ?? 'customers',
      displayAs: (cleaned.display_as as string) ?? 'banner',
      startsAt: (cleaned.starts_at as Date) ?? new Date(),
      endsAt: (cleaned.ends_at as Date | null) ?? null,
      isActive: cleaned.is_active !== false,
      dismissible,
      createdById: actor.id,
    })
    .returning()
  return announcement!
}

export async function updateAnnouncement(
  announcement: typeof announcements.$inferSelect,
  _actor: UserRow,
  data: Record<string, unknown>,
) {
  const cleaned = validateAnnouncementData(data, true)
  const updates: Partial<typeof announcements.$inferInsert> = { updatedAt: new Date() }
  if (cleaned.title != null) updates.title = cleaned.title as string
  if (cleaned.body != null) updates.body = cleaned.body as string
  if (cleaned.severity != null) updates.severity = cleaned.severity as string
  if (cleaned.audience != null) updates.audience = cleaned.audience as string
  if (cleaned.display_as != null) updates.displayAs = cleaned.display_as as string
  if (cleaned.starts_at != null) updates.startsAt = cleaned.starts_at as Date
  if ('ends_at' in cleaned) updates.endsAt = (cleaned.ends_at as Date | null) ?? null
  if (cleaned.is_active != null) updates.isActive = Boolean(cleaned.is_active)
  if (cleaned.dismissible != null) updates.dismissible = Boolean(cleaned.dismissible)

  const [updated] = await db
    .update(announcements)
    .set(updates)
    .where(eq(announcements.id, announcement.id))
    .returning()
  return updated!
}

export async function deleteAnnouncement(
  announcement: typeof announcements.$inferSelect,
  _actor: UserRow,
): Promise<void> {
  await db.delete(announcements).where(eq(announcements.id, announcement.id))
}

export async function latestBroadcastJob(announcement: typeof announcements.$inferSelect) {
  const [job] = await db
    .select()
    .from(broadcastJobs)
    .where(eq(broadcastJobs.announcementId, announcement.id))
    .orderBy(desc(broadcastJobs.createdAt))
    .limit(1)
  return job ?? null
}

export async function broadcastAnnouncement(
  announcement: typeof announcements.$inferSelect,
  _actor: UserRow,
  opts: { channels: string[]; alsoShowBanner?: boolean },
) {
  const normalized = opts.channels.map((c) => c.trim().toLowerCase()).filter(Boolean)
  for (const channel of normalized) {
    if (!(BROADCAST_CHANNELS as readonly string[]).includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`)
    }
  }
  if (!normalized.length) throw new Error('Select at least one broadcast channel')

  if (opts.alsoShowBanner && announcement.displayAs === 'inbox_only') {
    await db.update(announcements).set({ displayAs: 'banner' }).where(eq(announcements.id, announcement.id))
  }

  await db
    .update(announcements)
    .set({ broadcastAt: new Date() })
    .where(eq(announcements.id, announcement.id))

  const [job] = await db
    .insert(broadcastJobs)
    .values({
      announcementId: announcement.id,
      channels: normalized,
      status: normalized.includes('email') ? 'pending' : 'completed',
      startedAt: normalized.includes('email') ? null : new Date(),
      completedAt: normalized.includes('email') ? null : new Date(),
    })
    .returning()

  if (normalized.includes('email')) {
    void runEmailBroadcast(job!.id, announcement.id)
  }

  return job!
}

async function runEmailBroadcast(jobId: string, announcementId: string) {
  const { sendAnnouncementEmail } = await import('./emailService.js')
  const [job] = await db.select().from(broadcastJobs).where(eq(broadcastJobs.id, jobId)).limit(1)
  const [announcement] = await db.select().from(announcements).where(eq(announcements.id, announcementId)).limit(1)
  if (!job || !announcement) return

  await db.update(broadcastJobs).set({ status: 'running', startedAt: new Date() }).where(eq(broadcastJobs.id, jobId))

  const recipients = await db
    .select()
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.role, 'customer')))

  let sent = 0
  let failed = 0
  for (const user of recipients) {
    try {
      await sendAnnouncementEmail(user.email, user.firstName, announcement.title, announcement.body)
      sent += 1
    } catch (err) {
      failed += 1
      console.warn(`Broadcast email failed for ${user.email}:`, err)
    }
  }

  await db
    .update(broadcastJobs)
    .set({ sentCount: sent, failedCount: failed, status: 'completed', completedAt: new Date() })
    .where(eq(broadcastJobs.id, jobId))
}
