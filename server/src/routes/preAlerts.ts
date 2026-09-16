import { desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { ALLOWED_INVOICE_TYPES, SHIPPERS } from '../constants.js'
import { db } from '../db/index.js'
import { preAlerts } from '../db/schema/index.js'
import { preAlertToDict } from '../lib/serializers/preAlert.js'
import { jwtRequired, requireAuth, type AuthRequest } from '../middleware/auth.js'
import {
  ImageUploadError,
  createUploadPresign,
  isStorageConfigured,
  parsePresignFields,
} from '../services/imageUploadService.js'
import { cancelPreAlert, createPreAlert, updatePreAlert } from '../services/preAlertService.js'
import { routeParam } from '../lib/routeParams.js'
import { RateLimitExceeded, assertUploadPresignAllowed } from '../services/rateLimitService.js'

export const preAlertsRouter = Router()

function resolveCustomerUser(req: AuthRequest, res: import('express').Response) {
  const user = req.user!
  if (user.role !== 'customer') {
    res.status(403).json({ error: 'Customer access required' })
    return null
  }
  return user
}

preAlertsRouter.get('/me/shippers', jwtRequired, requireAuth, (req: AuthRequest, res) => {
  const user = resolveCustomerUser(req, res)
  if (!user) return
  return res.json({ shippers: SHIPPERS })
})

preAlertsRouter.get('/me/pre-alerts', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const user = resolveCustomerUser(req, res)
  if (!user) return

  const alerts = await db
    .select()
    .from(preAlerts)
    .where(eq(preAlerts.customerId, user.id))
    .orderBy(desc(preAlerts.createdAt))
  return res.json({ pre_alerts: alerts.map(preAlertToDict) })
})

preAlertsRouter.post('/me/pre-alerts', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const user = resolveCustomerUser(req, res)
  if (!user) return

  const data = req.body ?? {}
  const carrierTracking = String(data.carrier_tracking ?? '')
  if (!carrierTracking.trim()) return res.status(400).json({ error: 'carrier_tracking is required' })
  if (!String(data.merchant ?? '').trim()) return res.status(400).json({ error: 'merchant is required' })
  if (!String(data.description ?? '').trim()) return res.status(400).json({ error: 'description is required' })
  if (!('declared_value_usd' in data) || data.declared_value_usd == null) {
    return res.status(400).json({ error: 'declared_value_usd is required' })
  }

  let declaredValue: number
  try {
    declaredValue = parseFloat(String(data.declared_value_usd))
    if (Number.isNaN(declaredValue)) throw new Error('nan')
  } catch {
    return res.status(400).json({ error: 'declared_value_usd must be a number' })
  }

  try {
    const alert = await createPreAlert({
      customer: user,
      carrierTracking,
      invoiceObjectKey: data.invoice_object_key as string | undefined,
      merchant: data.merchant as string,
      description: data.description as string,
      declaredValueUsd: declaredValue,
    })
    return res.status(201).json({ pre_alert: preAlertToDict(alert) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

preAlertsRouter.get('/me/pre-alerts/:alertId', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const user = resolveCustomerUser(req, res)
  if (!user) return

  const [alert] = await db
    .select()
    .from(preAlerts)
    .where(eq(preAlerts.id, routeParam(req.params.alertId)))
    .limit(1)
  if (!alert || alert.customerId !== user.id) return res.status(404).json({ error: 'Pre-alert not found' })
  return res.json({ pre_alert: preAlertToDict(alert) })
})

preAlertsRouter.patch('/me/pre-alerts/:alertId', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const user = resolveCustomerUser(req, res)
  if (!user) return

  const [alert] = await db
    .select()
    .from(preAlerts)
    .where(eq(preAlerts.id, routeParam(req.params.alertId)))
    .limit(1)
  if (!alert || alert.customerId !== user.id) return res.status(404).json({ error: 'Pre-alert not found' })

  const data = req.body ?? {}
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No updates provided' })

  const fields: Record<string, unknown> = {}
  if ('carrier_tracking' in data) fields.carrier_tracking = data.carrier_tracking ?? ''
  for (const key of ['merchant', 'description'] as const) {
    if (key in data) fields[key] = data[key] ?? null
  }
  if ('declared_value_usd' in data) {
    const declaredValue = data.declared_value_usd
    if (declaredValue == null) fields.declared_value_usd = null
    else {
      const parsed = parseFloat(String(declaredValue))
      if (Number.isNaN(parsed)) return res.status(400).json({ error: 'declared_value_usd must be a number' })
      fields.declared_value_usd = parsed
    }
  }
  if ('invoice_object_key' in data) fields.invoice_object_key = data.invoice_object_key ?? null

  try {
    const updated = await updatePreAlert(alert, fields)
    return res.json({ pre_alert: preAlertToDict(updated) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

preAlertsRouter.delete('/me/pre-alerts/:alertId', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const user = resolveCustomerUser(req, res)
  if (!user) return

  const [alert] = await db
    .select()
    .from(preAlerts)
    .where(eq(preAlerts.id, routeParam(req.params.alertId)))
    .limit(1)
  if (!alert || alert.customerId !== user.id) return res.status(404).json({ error: 'Pre-alert not found' })

  try {
    const updated = await cancelPreAlert(alert)
    return res.json({ pre_alert: preAlertToDict(updated) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

preAlertsRouter.post('/me/uploads/invoice/presign', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const user = resolveCustomerUser(req, res)
  if (!user) return

  try {
    assertUploadPresignAllowed(user.id)
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return res.status(429).json({ error: exc.message })
    throw exc
  }

  if (!isStorageConfigured()) return res.status(503).json({ error: 'Invoice storage is not configured' })

  try {
    const [, contentType, contentLength] = parsePresignFields(req.body ?? {}, {
      defaultFilename: 'invoice.pdf',
      defaultContentType: 'application/pdf',
    })
    if (!ALLOWED_INVOICE_TYPES.has(contentType)) {
      return res.status(400).json({ error: 'Only JPEG, PNG, WebP, and PDF files are allowed' })
    }
    return res.json(await createUploadPresign({ contentType, contentLength, prefix: 'invoices' }))
  } catch (exc) {
    if (exc instanceof ImageUploadError) return res.status(exc.statusCode ?? 503).json({ error: exc.message })
    if (exc instanceof Error) return res.status(400).json({ error: exc.message })
    return res.status(500).json({ error: `Failed to generate upload URL: ${exc}` })
  }
})
