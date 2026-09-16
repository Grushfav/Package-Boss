import { desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import {
  ALLOWED_INVOICE_TYPES,
  CUSTOMER_BILL_VISIBLE_STATUSES,
  INVOICE_UPLOAD_EXCLUDED_STATUSES,
} from '../constants.js'
import { db } from '../db/index.js'
import { deliveryAddresses, packages } from '../db/schema/index.js'
import { packageToDict } from '../lib/serializers/package.js'
import { jwtRequired, requireAuth, type AuthRequest } from '../middleware/auth.js'
import { attachPackageInvoice } from '../services/billingService.js'
import { renderBillInvoiceHtml, renderCheckoutInvoiceHtml } from '../services/billInvoiceService.js'
import {
  ImageUploadError,
  createUploadPresign,
  isStorageConfigured,
  parsePresignFields,
} from '../services/imageUploadService.js'
import { getCheckoutItems, getPackageCheckoutItem } from '../services/paymentService.js'
import { getCustomerPackage, getPackageEvents, getPackagePhotos, getTrackingTimeline } from '../services/packageService.js'
import { packagePendingDeliverySummary } from '../services/deliveryRequestService.js'
import { routeParam } from '../lib/routeParams.js'
import { RateLimitExceeded, assertUploadPresignAllowed } from '../services/rateLimitService.js'

export const packagesRouter = Router()

packagesRouter.get('/me/packages', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(packages)
    .where(eq(packages.customerId, req.user!.id))
    .orderBy(desc(packages.createdAt))

  const result = []
  for (const pkg of rows) {
    const summary = await packagePendingDeliverySummary(pkg)
    result.push({ ...packageToDict(pkg), pending_delivery_request: summary })
  }
  return res.json({ packages: result })
})

packagesRouter.get('/me/packages/:packageId', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const pkg = await getCustomerPackage(req.user!, routeParam(req.params.packageId))
  if (!pkg) return res.status(404).json({ error: 'Package not found' })

  const events = await getPackageEvents(pkg.id)
  const photos = await getPackagePhotos(pkg.id)
  let deliveryAddress = null
  if (pkg.deliveryAddressId) {
    ;[deliveryAddress] = await db
      .select()
      .from(deliveryAddresses)
      .where(eq(deliveryAddresses.id, pkg.deliveryAddressId))
      .limit(1)
  }

  const data = packageToDict(pkg, {
    includeEvents: true,
    includePhotos: true,
    events,
    photos,
    deliveryAddress: deliveryAddress ?? null,
  })
  data.timeline = await getTrackingTimeline(pkg)
  return res.json({ package: data })
})

packagesRouter.get('/me/packages/:packageId/bill-invoice', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const pkg = await getCustomerPackage(req.user!, routeParam(req.params.packageId))
  if (!pkg) return res.status(404).json({ error: 'Package not found' })

  if (!(CUSTOMER_BILL_VISIBLE_STATUSES as readonly string[]).includes(pkg.status)) {
    return res.status(400).json({ error: 'Bill is not available for this package yet' })
  }
  if (!['ready', 'paid'].includes(pkg.billingStatus)) {
    return res.status(400).json({ error: 'Bill has not been published yet' })
  }
  if (pkg.totalDueJmd == null) return res.status(400).json({ error: 'No bill amount on this package' })

  const item = await getPackageCheckoutItem(pkg)
  const checkout = item?.checkout ?? null
  if (checkout) {
    const checkoutItems = await getCheckoutItems(checkout.id)
    const pkgs = checkoutItems.map((i) => i.pkg).filter(Boolean) as NonNullable<(typeof checkoutItems)[0]['pkg']>[]
    if (pkgs.length > 1) {
      const itemAmounts = new Map(checkoutItems.map((i) => [i.item.packageId, i.item.amountJmd]))
      const html = renderCheckoutInvoiceHtml(checkout, req.user!, pkgs, itemAmounts)
      res.type('html')
      return res.send(html)
    }
  }

  res.type('html')
  return res.send(renderBillInvoiceHtml(pkg, req.user!))
})

packagesRouter.post('/me/packages/:packageId/invoice/presign', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  try {
    assertUploadPresignAllowed(req.user!.id)
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return res.status(429).json({ error: exc.message })
    throw exc
  }

  const pkg = await getCustomerPackage(req.user!, routeParam(req.params.packageId))
  if (!pkg) return res.status(404).json({ error: 'Package not found' })
  if (!['pending', 'requested'].includes(pkg.invoiceStatus)) {
    return res.status(400).json({ error: 'Invoice upload is not required for this package' })
  }
  if (INVOICE_UPLOAD_EXCLUDED_STATUSES.has(pkg.status)) {
    return res.status(400).json({ error: 'Invoice upload is not available at this stage' })
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
    if (exc instanceof Error && exc.message) return res.status(400).json({ error: exc.message })
    return res.status(500).json({ error: `Failed to generate upload URL: ${exc}` })
  }
})

packagesRouter.post('/me/packages/:packageId/invoice', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const pkg = await getCustomerPackage(req.user!, routeParam(req.params.packageId))
  if (!pkg) return res.status(404).json({ error: 'Package not found' })
  if (INVOICE_UPLOAD_EXCLUDED_STATUSES.has(pkg.status)) {
    return res.status(400).json({ error: 'Invoice upload is not available at this stage' })
  }

  const data = req.body ?? {}
  const invoiceKey = String(data.invoice_object_key ?? '').trim()
  if (!invoiceKey) return res.status(400).json({ error: 'invoice_object_key is required' })

  let declaredValue: number | null | undefined = data.declared_value_usd
  if (declaredValue != null) {
    declaredValue = parseFloat(String(declaredValue))
    if (Number.isNaN(declaredValue)) {
      return res.status(400).json({ error: 'declared_value_usd must be a number' })
    }
  }

  try {
    const updated = await attachPackageInvoice(pkg, invoiceKey, declaredValue, req.user!)
    return res.json({ package: packageToDict(updated) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})
