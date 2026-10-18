import { randomBytes } from 'node:crypto'
import { and, count, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { validate as validateUuid } from 'uuid'
import { CLERK_PERMISSION_LABELS, CLERK_PERMISSIONS, JAMAICA_PARISHES } from '../constants.js'
import { db } from '../db/index.js'
import { auditLogs, users } from '../db/schema/index.js'
import { auditLogToDict } from '../lib/auditDto.js'
import { announcementToDict, broadcastJobToDict } from '../lib/announcementDto.js'
import { sendError } from '../lib/errors.js'
import { clerkToDict } from '../lib/userDto.js'
import { permissionRequired, requireAdmin, type AuthRequest } from '../middleware/auth.js'
import {
  getBankTransferProofSubmissionStats,
  getCustomerSignupStats,
  getDeliveryRequestSubmissionStats,
  getOverview,
  getPackagesByStatus,
  getPackagesTimeline,
  getPreAlertsVsReceives,
  getWeightDistribution,
} from '../services/adminStatsService.js'
import {
  broadcastAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  latestBroadcastJob,
  listAdminAnnouncements,
  updateAnnouncement,
} from '../services/announcementService.js'
import { normalizePhone } from '../services/authService.js'
import { normalizeClerkPermissions } from '../services/clerkPermissionService.js'
import { EmailServiceError, sendClerkInviteEmail } from '../services/emailService.js'
import {
  assignLogisticsClerk,
  getLogisticsJob,
  listAllLogisticsJobs,
  listLogisticsJobHistory,
  listLogisticsJobsByStatus,
  listOpenLogisticsJobs,
  listPendingLogisticsJobs,
  rejectLogisticsJob,
  serializeJob,
} from '../services/logisticsJobService.js'
import {
  getCustomerEmailNotificationSettings,
  setCustomerEmailNotificationsEnabled,
} from '../services/notificationSettingsService.js'
import { RateLimitExceeded, assertClerkInviteResendAllowed } from '../services/rateLimitService.js'
import { buildResetUrl, generateResetToken, storeInviteToken } from '../services/resetTokenService.js'
import { generateStaffShippingId } from '../services/staffIdService.js'
import { bumpTokenVersion } from '../services/tokenService.js'
import { hashPassword } from '../services/werkzeugPassword.js'

export const adminRouter = Router()

async function sendClerkInvite(user: typeof users.$inferSelect) {
  const [rawToken, tokenHash] = generateResetToken()
  await storeInviteToken(user.id, tokenHash)
  const inviteUrl = buildResetUrl(rawToken, true)
  sendClerkInviteEmail(user.email, user.firstName, inviteUrl)
}

adminRouter.get('/admin/stats/overview', requireAdmin, async (_req, res) => {
  res.json(await getOverview())
})

adminRouter.get('/admin/stats/customer-signups', requireAdmin, async (_req, res) => {
  res.json(await getCustomerSignupStats())
})

adminRouter.get('/admin/stats/delivery-requests', requireAdmin, async (_req, res) => {
  res.json(await getDeliveryRequestSubmissionStats())
})

adminRouter.get('/admin/stats/bank-transfer-proofs', requireAdmin, async (_req, res) => {
  res.json(await getBankTransferProofSubmissionStats())
})

adminRouter.get('/admin/stats/packages-timeline', requireAdmin, async (req, res) => {
  let days = parseInt(String(req.query.days ?? '30'), 10)
  if (Number.isNaN(days)) days = 30
  days = Math.max(7, Math.min(days, 90))
  res.json({ timeline: await getPackagesTimeline(days) })
})

adminRouter.get('/admin/stats/by-status', requireAdmin, async (_req, res) => {
  res.json({ statuses: await getPackagesByStatus() })
})

adminRouter.get('/admin/stats/weight-distribution', requireAdmin, async (_req, res) => {
  res.json({ distribution: await getWeightDistribution() })
})

adminRouter.get('/admin/stats/pre-alerts-vs-receives', requireAdmin, async (req, res) => {
  let days = parseInt(String(req.query.days ?? '30'), 10)
  if (Number.isNaN(days)) days = 30
  days = Math.max(7, Math.min(days, 90))
  res.json({ series: await getPreAlertsVsReceives(days) })
})

adminRouter.get('/admin/activity', permissionRequired('activity'), async (req, res) => {
  let limit = parseInt(String(req.query.limit ?? '50'), 10)
  let offset = parseInt(String(req.query.offset ?? '0'), 10)
  const action = String(req.query.action ?? '').trim()

  limit = Math.max(1, Math.min(limit, 100))
  offset = Math.max(0, offset)

  const filters = [eq(auditLogs.entityType, 'package')]
  if (action) filters.push(eq(auditLogs.action, action))

  const whereClause = and(...filters)

  const [{ value: total }] = await db.select({ value: count() }).from(auditLogs).where(whereClause)

  const logs = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .offset(offset)
    .limit(limit)

  res.json({ activity: logs.map(auditLogToDict), total })
})

adminRouter.get('/admin/clerk-permissions', requireAdmin, (_req, res) => {
  res.json({
    permissions: CLERK_PERMISSIONS.map((code) => ({
      code,
      label: CLERK_PERMISSION_LABELS[code],
    })),
  })
})

adminRouter.get('/admin/clerks', requireAdmin, async (req, res) => {
  const includeSuspended = ['1', 'true', 'yes'].includes(
    String(req.query.include_suspended ?? 'true').toLowerCase(),
  )

  const rows = await db
    .select()
    .from(users)
    .where(
      includeSuspended ? eq(users.role, 'clerk') : and(eq(users.role, 'clerk'), eq(users.isActive, true)),
    )
    .orderBy(desc(users.isActive), desc(users.createdAt))

  res.json({ clerks: rows.map(clerkToDict) })
})

adminRouter.post('/admin/clerks', requireAdmin, async (req, res) => {
  const data = req.body ?? {}
  const email = String(data.email ?? '')
    .trim()
    .toLowerCase()

  const missing = ['first_name', 'last_name', 'email'].filter((f) => !data[f])
  if (missing.length) {
    return sendError(res, `Missing required fields: ${missing.join(', ')}`)
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing) return sendError(res, 'An account with this email already exists', 409)

  let contactNumber = ''
  if (data.contact_number) {
    try {
      contactNumber = normalizePhone(String(data.contact_number))
    } catch (err) {
      return sendError(res, err instanceof Error ? err.message : 'Invalid contact number')
    }
  }

  const parish = String(data.parish ?? '').trim()
  if (parish && !(JAMAICA_PARISHES as readonly string[]).includes(parish)) {
    return sendError(res, 'Invalid parish')
  }

  const permissions = normalizeClerkPermissions(data.permissions)
  const unusableSecret = randomBytes(32).toString('base64url')

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: hashPassword(unusableSecret),
      firstName: String(data.first_name).trim(),
      lastName: String(data.last_name).trim(),
      contactNumber,
      parish: parish || null,
      trn: null,
      shippingId: await generateStaffShippingId(),
      role: 'clerk',
      clerkPermissions: permissions,
      mustSetPassword: true,
      isActive: true,
    })
    .returning()

  try {
    await sendClerkInvite(user!)
  } catch (err) {
    console.error(`Clerk invite email failed for ${email}:`, err)
    return sendError(res, 'Clerk created but invite email could not be sent', 503)
  }

  res.status(201).json({ user: clerkToDict(user!) })
})

adminRouter.patch('/admin/clerks/:userId', requireAdmin, async (req, res) => {
  const userId = String(req.params.userId)
  if (!validateUuid(userId)) return sendError(res, 'Invalid user ID')

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user || user.role !== 'clerk') return sendError(res, 'Clerk not found', 404)

  const data = req.body ?? {}
  let bumpTokens = false
  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }

  if ('permissions' in data) {
    const permissions = normalizeClerkPermissions(data.permissions)
    if (JSON.stringify(permissions) !== JSON.stringify(user.clerkPermissions ?? [])) {
      updates.clerkPermissions = permissions
      bumpTokens = true
    }
  }

  if ('first_name' in data) updates.firstName = String(data.first_name ?? '').trim()
  if ('last_name' in data) updates.lastName = String(data.last_name ?? '').trim()

  if ('contact_number' in data) {
    if (data.contact_number) {
      try {
        updates.contactNumber = normalizePhone(String(data.contact_number))
      } catch (err) {
        return sendError(res, err instanceof Error ? err.message : 'Invalid contact number')
      }
    } else {
      updates.contactNumber = ''
    }
  }

  if ('parish' in data) {
    const parishValue = String(data.parish ?? '').trim()
    if (parishValue && !(JAMAICA_PARISHES as readonly string[]).includes(parishValue)) {
      return sendError(res, 'Invalid parish')
    }
    updates.parish = parishValue || null
  }

  if ('is_active' in data) {
    const isActive = Boolean(data.is_active)
    if (isActive !== user.isActive) {
      updates.isActive = isActive
      if (!isActive) bumpTokens = true
    }
  }

  if (bumpTokens) {
    await bumpTokenVersion(user, false)
    updates.tokenVersion = (user.tokenVersion ?? 0) + 1
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning()
  res.json({ user: clerkToDict(updated!) })
})

adminRouter.post('/admin/clerks/:userId/resend-invite', requireAdmin, async (req: AuthRequest, res) => {
  const admin = req.user!
  try {
    assertClerkInviteResendAllowed(admin.id)
  } catch (err) {
    if (err instanceof RateLimitExceeded) return sendError(res, err.message, 429)
    throw err
  }

  const userId = String(req.params.userId)
  if (!validateUuid(userId)) return sendError(res, 'Invalid user ID')

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user || user.role !== 'clerk' || !user.isActive) {
    return sendError(res, 'Clerk not found', 404)
  }

  try {
    await sendClerkInvite(user)
  } catch (err) {
    console.error(`Clerk invite resend failed for ${user.email}:`, err)
    if (err instanceof EmailServiceError) {
      return sendError(res, 'Invite email could not be sent', 503)
    }
    return sendError(res, 'Invite email could not be sent', 503)
  }

  res.json({ message: 'Invite email sent' })
})

adminRouter.post('/admin/clerks/:userId/reactivate', requireAdmin, async (req, res) => {
  const userId = String(req.params.userId)
  if (!validateUuid(userId)) return sendError(res, 'Invalid user ID')

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user || user.role !== 'clerk') return sendError(res, 'Clerk not found', 404)

  const [updated] = await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()

  res.json({ user: clerkToDict(updated!) })
})

adminRouter.delete('/admin/clerks/:userId', requireAdmin, async (req, res) => {
  const userId = String(req.params.userId)
  if (!validateUuid(userId)) return sendError(res, 'Invalid user ID')

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return sendError(res, 'User not found', 404)
  if (user.role !== 'clerk') return sendError(res, 'User is not a clerk')

  await bumpTokenVersion(user, false)
  const [updated] = await db
    .update(users)
    .set({ isActive: false, tokenVersion: (user.tokenVersion ?? 0) + 1, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()

  res.json({ user: clerkToDict(updated!) })
})

adminRouter.get('/admin/announcements', requireAdmin, async (_req, res) => {
  const rows = await listAdminAnnouncements()
  const result = await Promise.all(
    rows.map(async (a) => announcementToDict(a, { job: await latestBroadcastJob(a) })),
  )
  res.json({ announcements: result })
})

adminRouter.post('/admin/announcements', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const announcement = await createAnnouncement(req.user!, req.body ?? {})
    const job = await latestBroadcastJob(announcement)
    res.status(201).json({ announcement: announcementToDict(announcement, { job }) })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Invalid request')
  }
})

adminRouter.patch('/admin/announcements/:announcementId', requireAdmin, async (req: AuthRequest, res) => {
  const announcementId = String(req.params.announcementId)
  if (!validateUuid(announcementId)) return sendError(res, 'Invalid announcement ID')

  const announcement = await getAnnouncement(announcementId)
  if (!announcement) return sendError(res, 'Announcement not found', 404)

  try {
    const updated = await updateAnnouncement(announcement, req.user!, req.body ?? {})
    const job = await latestBroadcastJob(updated)
    res.json({ announcement: announcementToDict(updated, { job }) })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Invalid request')
  }
})

adminRouter.delete('/admin/announcements/:announcementId', requireAdmin, async (req: AuthRequest, res) => {
  const announcementId = String(req.params.announcementId)
  if (!validateUuid(announcementId)) return sendError(res, 'Invalid announcement ID')

  const announcement = await getAnnouncement(announcementId)
  if (!announcement) return sendError(res, 'Announcement not found', 404)

  await deleteAnnouncement(announcement, req.user!)
  res.json({ message: 'Deleted' })
})

adminRouter.post(
  '/admin/announcements/:announcementId/broadcast',
  requireAdmin,
  async (req: AuthRequest, res) => {
    const announcementId = String(req.params.announcementId)
    if (!validateUuid(announcementId)) return sendError(res, 'Invalid announcement ID')

    const announcement = await getAnnouncement(announcementId)
    if (!announcement) return sendError(res, 'Announcement not found', 404)

    const data = req.body ?? {}
    const channels = (data.channels as string[] | undefined) ?? ['in_app']
    const alsoShowBanner = Boolean(data.also_show_banner)

    try {
      const job = await broadcastAnnouncement(announcement, req.user!, {
        channels,
        alsoShowBanner,
      })
      res.json({
        announcement: announcementToDict(announcement, { job }),
        broadcast_job: broadcastJobToDict(job),
      })
    } catch (err) {
      return sendError(res, err instanceof Error ? err.message : 'Invalid request')
    }
  },
)

adminRouter.get('/admin/settings/customer-email-notifications', requireAdmin, async (_req, res) => {
  res.json(await getCustomerEmailNotificationSettings())
})

adminRouter.patch('/admin/settings/customer-email-notifications', requireAdmin, async (req: AuthRequest, res) => {
  const data = req.body ?? {}
  if (!('enabled' in data)) return sendError(res, 'enabled is required')
  if (typeof data.enabled !== 'boolean') return sendError(res, 'enabled must be a boolean')

  const settings = await setCustomerEmailNotificationsEnabled(data.enabled, req.user!)
  res.json(settings)
})

adminRouter.get('/admin/logistics-jobs', requireAdmin, async (req: AuthRequest, res) => {
  const status = String(req.query.status ?? 'active').trim().toLowerCase()
  let jobs
  if (status === 'pending') jobs = await listPendingLogisticsJobs()
  else if (status === 'active') jobs = await listOpenLogisticsJobs()
  else if (status === 'all') jobs = await listAllLogisticsJobs()
  else if (status === 'history') jobs = await listLogisticsJobHistory()
  else jobs = await listLogisticsJobsByStatus(status)

  res.json({
    logistics_jobs: await Promise.all(jobs.map((job) => serializeJob(job))),
  })
})

adminRouter.post(
  '/admin/logistics-jobs/:jobId/assign-clerk',
  requireAdmin,
  async (req: AuthRequest, res) => {
    const jobId = String(req.params.jobId)
    const job = await getLogisticsJob(jobId)
    if (!job) return sendError(res, 'Local delivery request not found', 404)

    const data = req.body ?? {}
    const clerkId = data.clerk_id
    if (!clerkId) return sendError(res, 'clerk_id is required')

    try {
      const updated = await assignLogisticsClerk(job, req.user!, { clerkId })
      res.json({ logistics_job: await serializeJob(updated) })
    } catch (err) {
      return sendError(res, err instanceof Error ? err.message : String(err))
    }
  },
)

adminRouter.post(
  '/admin/logistics-jobs/:jobId/reject',
  requireAdmin,
  async (req: AuthRequest, res) => {
    const jobId = String(req.params.jobId)
    const job = await getLogisticsJob(jobId)
    if (!job) return sendError(res, 'Local delivery request not found', 404)

    const data = req.body ?? {}
    try {
      const updated = await rejectLogisticsJob(job, req.user!, { reason: data.reason })
      res.json({ logistics_job: await serializeJob(updated) })
    } catch (err) {
      return sendError(res, err instanceof Error ? err.message : String(err))
    }
  },
)
