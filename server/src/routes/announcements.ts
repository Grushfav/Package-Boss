import { Router } from 'express'
import { jwtOptional, jwtRequired, requireAuth, resolveJwtUser, type AuthRequest } from '../middleware/auth.js'
import { routeParam } from '../lib/routeParams.js'
import {
  dismissAnnouncement,
  listActiveBanners,
  listUserInbox,
  markAnnouncementRead,
  pickPrimaryBanner,
} from '../services/announcementService.js'

export const announcementsRouter = Router()

const VALID_CONTEXTS = new Set(['public', 'customer', 'staff'])

announcementsRouter.get('/announcements/active', jwtOptional, async (req: AuthRequest, res) => {
  const context = String(req.query.context ?? 'public')
    .trim()
    .toLowerCase()
  if (!VALID_CONTEXTS.has(context)) return res.status(400).json({ error: 'Invalid context' })

  let user = null
  if (req.jwtClaims) {
    try {
      user = await resolveJwtUser(req, res, { requireActive: true })
      if (!user && res.headersSent) return
    } catch {
      user = null
    }
  }

  const banners = await listActiveBanners(context, user)
  const primary = pickPrimaryBanner(banners)
  const modals = banners.filter((b) => b.display_as === 'modal')

  res.set('Cache-Control', 'public, max-age=60')
  return res.json({
    banner: primary && primary.display_as === 'banner' ? primary : null,
    modals,
  })
})

announcementsRouter.get('/me/announcements', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  return res.json({ announcements: await listUserInbox(req.user!) })
})

announcementsRouter.post('/me/announcements/:announcementId/dismiss', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  try {
    await dismissAnnouncement(req.user!, routeParam(req.params.announcementId))
    return res.json({ message: 'Dismissed' })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

announcementsRouter.post('/me/announcements/:announcementId/read', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  try {
    await markAnnouncementRead(req.user!, routeParam(req.params.announcementId))
    return res.json({ message: 'Marked as read' })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})
