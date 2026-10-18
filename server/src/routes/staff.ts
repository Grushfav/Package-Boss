import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
} from 'drizzle-orm'
import { Router } from 'express'
import { validate as validateUuid } from 'uuid'
import {
  MAX_RECEIVE_LBS,
  PRE_ALERT_STATUSES,
  RECEIVE_BATCH_STATUSES,
  SHIPPER_CODES,
  SHIPPERS,
  SHIPMENT_STATUSES,
  STATUS_LABELS,
  UPDATABLE_STATUSES,
} from '../constants.js'
import { db } from '../db/index.js'
import {
  packages,
  paymentCheckouts,
  preAlerts,
  users,
  type UserRow,
} from '../db/schema/index.js'
import { preAlertToDict } from '../lib/serializers/preAlert.js'
import { deliveryAddressToDict } from '../lib/serializers/deliveryAddress.js'
import { deliveryRequestToDict } from '../lib/serializers/deliveryRequest.js'
import { paymentCheckoutToDict } from '../lib/serializers/payment.js'
import { receiveBatchToDict } from '../lib/serializers/receiveBatch.js'
import { shipmentToDict } from '../lib/serializers/shipment.js'
import { customerStaffDict } from '../lib/serializers/user.js'
import { routeParam } from '../lib/routeParams.js'
import {
  adminRequired,
  getUserFromJwt,
  permissionRequired,
  warehouseRequired,
  type AuthRequest,
} from '../middleware/auth.js'
import {
  ACTION_PACKAGE_ASSIGNED,
  ACTION_PACKAGE_BILLING_UPDATED,
  ACTION_PACKAGE_INVOICE_REQUESTED,
  ACTION_PACKAGE_LABEL_UPDATED,
  ACTION_PACKAGE_PAYMENT_RECORDED,
  ACTION_PACKAGE_RECEIVED,
  ACTION_PACKAGE_RECEIVED_UNIDENTIFIED,
  ACTION_PACKAGE_STATUS_UPDATED,
  ACTION_PACKAGE_UNASSIGNED,
  logPackageAction,
} from '../services/auditService.js'
import {
  assignDeliveryAddress,
  requestPackageInvoice,
  updatePackageBilling,
} from '../services/billingService.js'
import {
  confirmTransferProof,
  getTransferProof,
  listAllTransferProofs,
  listOpenTransferProofs,
  listPendingCustomerProofs,
  listPendingTransferProofs,
  listTransferProofHistory,
  listTransferProofsByStatus,
  markTransferProofInProgress,
  proofToStaffDict,
  rejectTransferProof,
} from '../services/bankTransferProofService.js'
import { renderBillInvoiceHtml, renderCheckoutInvoiceHtml } from '../services/billInvoiceService.js'
import {
  assertStatusTransitionAllowed,
  clerkHasPermission,
} from '../services/clerkPermissionService.js'
import { bulkRequestCustomsInvoices, releasePackagesFromCustoms } from '../services/customsReleaseService.js'
import { listDeliveryAddresses } from '../services/deliveryAddressService.js'
import {
  cancelDeliveryRequest,
  completeDeliveryRequest,
  getDeliveryRequest,
  listAllDeliveryRequests,
  listDeliveryRequestHistory,
  listDeliveryRequestsByStatus,
  listOpenDeliveryRequests,
  listPendingCustomerDeliveryRequests,
  listPendingDeliveryRequests,
  loadDeliveryRequestDetails,
  markDeliveryRequestInProgress,
} from '../services/deliveryRequestService.js'
import {
  cancelLogisticsJob,
  completeLogisticsJob,
  confirmLogisticsDriver,
  getLogisticsJob,
  listAllLogisticsJobs,
  listClerkLogisticsJobs,
  listLogisticsJobHistory,
  listLogisticsJobsByStatus,
  listOpenLogisticsJobs,
  listPendingLogisticsJobs,
  markLogisticsJobInTransit,
  markLogisticsJobPickedUp,
  serializeJob,
} from '../services/logisticsJobService.js'
import { EmailServiceError, sendCheckoutInvoiceEmail } from '../services/emailService.js'
import { MIN_PACKAGE_SEARCH_QUERY_LEN, searchPackages } from '../services/packageSearchService.js'
import { findPendingPreAlertsByTracking } from '../services/preAlertService.js'
import {
  computeCustomerBillingSummary,
  getCheckoutItems,
  getPackageCheckoutItem,
  listCustomerCheckouts,
  listCustomerPackages,
  packagePaymentSummariesForPackages,
  packagePaymentSummary,
  recordPackagePayment,
  recordPaymentCheckout,
} from '../services/paymentService.js'
import {
  createReceiveBatch,
  listReceiveBatches,
} from '../services/receiveBatchService.js'
import {
  addPackageByTracking,
  addPackagesToShipment,
  batchDepartPackages,
  createShipment,
  departShipment,
  getShipment,
  listShipments,
  removePackageFromShipment,
} from '../services/shipmentService.js'
import {
  activePackageCountsByCustomerIds,
  findCustomerByShippingId,
  listCustomers,
  searchCustomers,
} from '../services/unidentifiedService.js'
import {
  assignUnidentifiedPackage,
  bulkUpdatePackageStatus,
  getWarehouseSummary,
  listClerkReceivesToday,
  listLabelLog,
  listUnidentifiedPackages,
  listWarehousePackages,
  loadPackageRelations,
  loadWarehouseListRelations,
  markLabelsPrinted,
  packageToDict,
  receivePackage,
  receiveUnidentifiedPackage,
  unassignPackageFromCustomer,
  updatePackageReceiveDetails,
  updatePackageStatus,
  warehousePackageListToDict,
  warehousePackageToDict,
} from '../services/warehousePackageService.js'

export const staffRouter = Router()

function parseReceiveWeight(
  weightRaw: unknown,
): [number | null, { body: Record<string, unknown>; status: number } | null] {
  const weight = typeof weightRaw === 'number' ? weightRaw : parseFloat(String(weightRaw ?? ''))
  if (Number.isNaN(weight)) {
    return [null, { body: { error: 'actual_weight_lbs must be a number' }, status: 400 }]
  }
  if (weight <= 0) {
    return [null, { body: { error: 'actual_weight_lbs must be greater than zero' }, status: 400 }]
  }
  if (weight > MAX_RECEIVE_LBS) {
    return [
      null,
      {
        body: {
          error: `Packages over ${MAX_RECEIVE_LBS} lbs cannot be received here. Contact support@packageboss.com.`,
        },
        status: 400,
      },
    ]
  }
  return [weight, null]
}

async function staffPreAlertDict(preAlert: typeof preAlerts.$inferSelect, customer?: UserRow | null) {
  const data = preAlertToDict(preAlert)
  if (customer) {
    data.customer = customerStaffDict(customer)
  } else {
    const [loadedCustomer] = await db
      .select()
      .from(users)
      .where(eq(users.id, preAlert.customerId))
      .limit(1)
    if (loadedCustomer) data.customer = customerStaffDict(loadedCustomer)
  }
  return data
}

async function serializeWarehousePackage(pkg: typeof packages.$inferSelect) {
  const rels = await loadPackageRelations(pkg)
  return warehousePackageToDict(pkg, rels)
}

async function serializeWarehousePackages(rows: Array<typeof packages.$inferSelect>) {
  const loaded = await loadWarehouseListRelations(rows)
  return loaded.map(({ pkg, customer, shipment }) =>
    warehousePackageListToDict(pkg, { customer, shipment }),
  )
}

async function serializeDeliveryRequests(
  requests: Array<typeof import('../db/schema/index.js').deliveryRequests.$inferSelect>,
) {
  const result = []
  for (const request of requests) {
    const details = await loadDeliveryRequestDetails(request.id)
    if (!details) continue
    result.push(
      deliveryRequestToDict(details.request, {
        includePackages: true,
        packageLinks: details.packageLinks,
        deliveryAddress: details.deliveryAddress,
        customer: details.customer,
        completedBy: details.completedBy,
        inProgressBy: details.inProgressBy,
      }),
    )
  }
  return result
}

async function serializeCheckoutsWithItems(checkouts: Array<typeof paymentCheckouts.$inferSelect>) {
  const result = []
  for (const checkout of checkouts) {
    const items = await getCheckoutItems(checkout.id)
    let recordedBy: UserRow | null = null
    if (checkout.recordedById) {
      ;[recordedBy] = await db.select().from(users).where(eq(users.id, checkout.recordedById)).limit(1)
    }
    result.push(
      paymentCheckoutToDict(checkout, {
        includeItems: true,
        items,
        recordedBy: recordedBy ?? null,
      }),
    )
  }
  return result
}

async function serializePendingProofs(customer: UserRow) {
  const proofs = await listPendingCustomerProofs(customer)
  return Promise.all(proofs.map((proof) => proofToStaffDict(proof)))
}

async function serializePendingDeliveryRequests(customer: UserRow) {
  const requests = await listPendingCustomerDeliveryRequests(customer)
  return serializeDeliveryRequests(requests)
}

staffRouter.get('/shippers', permissionRequired('receive'), (_req, res) => {
  res.json({ shippers: SHIPPERS })
})

staffRouter.get(
  '/staff/warehouse/summary',
  permissionRequired(
    'receive',
    'activity',
    'pre_alerts',
    'status_transit',
    'status_customs',
    'status_pickup',
    'billing',
    'invoice_request',
    'directory',
  ),
  async (_req, res) => {
    res.json(await getWarehouseSummary())
  },
)

staffRouter.get('/warehouse/customers', permissionRequired('directory'), async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  let limit = parseInt(String(req.query.limit ?? '50'), 10)
  let offset = parseInt(String(req.query.offset ?? '0'), 10)
  if (Number.isNaN(limit)) limit = 50
  if (Number.isNaN(offset)) offset = 0

  const [customerRows, total] = await listCustomers({ q, limit, offset })
  const counts = await activePackageCountsByCustomerIds(customerRows.map((u) => u.id))

  res.json({
    customers: customerRows.map((u) =>
      customerStaffDict(u, { activePackageCount: counts.get(u.id) ?? 0 }),
    ),
    total,
  })
})

staffRouter.get(
  '/warehouse/customers/search',
  permissionRequired('receive', 'directory'),
  async (req, res) => {
    const q = String(req.query.q ?? '').trim()
    if (q.length < 2) {
      return res.json({ customers: [] })
    }
    const customerRows = await searchCustomers(q, 15)
    res.json({ customers: customerRows.map((u) => customerStaffDict(u)) })
  },
)

staffRouter.get(
  '/staff/customers/:shippingId',
  permissionRequired('receive', 'directory'),
  async (req, res) => {
    const user = await findCustomerByShippingId(routeParam(req.params.shippingId))
    if (!user) return res.status(404).json({ error: 'Customer not found' })
    res.json({ customer: customerStaffDict(user) })
  },
)

staffRouter.get(
  '/staff/pre-alerts/lookup',
  permissionRequired('receive', 'pre_alerts'),
  async (req, res) => {
    const tracking = String(req.query.carrier_tracking ?? '').trim()
    if (!tracking) return res.status(400).json({ error: 'carrier_tracking is required' })

    const scored = await findPendingPreAlertsByTracking(tracking)
    const matches = []
    for (const [preAlert, score] of scored) {
      const [customer] = await db.select().from(users).where(eq(users.id, preAlert.customerId)).limit(1)
      if (!customer) continue
      matches.push({
        pre_alert: preAlertToDict(preAlert),
        customer: customerStaffDict(customer),
        match_score: score,
      })
    }
    res.json({ matches })
  },
)

staffRouter.get('/staff/pre-alerts', permissionRequired('pre_alerts'), async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  const status = String(req.query.status ?? '').trim()
  let limit = parseInt(String(req.query.limit ?? '50'), 10)
  let offset = parseInt(String(req.query.offset ?? '0'), 10)
  if (Number.isNaN(limit)) limit = 50
  if (Number.isNaN(offset)) offset = 0
  limit = Math.max(1, Math.min(limit, 100))
  offset = Math.max(0, offset)

  const conditions = []
  if (status && (PRE_ALERT_STATUSES as readonly string[]).includes(status)) {
    conditions.push(eq(preAlerts.status, status))
  }
  if (q) {
    const pattern = `%${q}%`
    const shippingPattern = `%${q.toUpperCase()}%`
    conditions.push(
      or(
        ilike(preAlerts.carrierTracking, pattern),
        ilike(preAlerts.merchant, pattern),
        ilike(preAlerts.description, pattern),
        ilike(users.shippingId, shippingPattern),
        ilike(users.firstName, pattern),
        ilike(users.lastName, pattern),
      )!,
    )
  }

  const where = conditions.length ? and(...conditions) : undefined

  const [totalRow] = await db
    .select({ value: count() })
    .from(preAlerts)
    .innerJoin(users, eq(preAlerts.customerId, users.id))
    .where(where)

  const rows = await db
    .select({ preAlert: preAlerts, customer: users })
    .from(preAlerts)
    .innerJoin(users, eq(preAlerts.customerId, users.id))
    .where(where)
    .orderBy(desc(preAlerts.createdAt))
    .limit(limit)
    .offset(offset)

  res.json({
    pre_alerts: await Promise.all(rows.map(({ preAlert, customer }) => staffPreAlertDict(preAlert, customer))),
    total: Number(totalRow?.value ?? 0),
  })
})

staffRouter.get(
  '/staff/customers/:shippingId/account',
  permissionRequired('directory', 'billing'),
  async (req, res) => {
    const user = await findCustomerByShippingId(routeParam(req.params.shippingId))
    if (!user) return res.status(404).json({ error: 'Customer not found' })

    const customerPackages = await listCustomerPackages(user)
    const actor = getUserFromJwt(req)
    const showBilling = Boolean(actor && clerkHasPermission(actor, 'billing'))

    const paymentMap = showBilling
      ? await packagePaymentSummariesForPackages(customerPackages)
      : {}

    const packageRows = customerPackages.map((pkg) => {
      const row = warehousePackageListToDict(pkg, { customer: user })
      if (showBilling) row.payment = paymentMap[pkg.id] ?? null
      return row
    })

    const payload: Record<string, unknown> = {
      customer: customerStaffDict(user),
      packages: packageRows,
    }

    if (showBilling) {
      const checkouts = await listCustomerCheckouts(user)
      payload.checkouts = await serializeCheckoutsWithItems(checkouts)
      payload.summary = await computeCustomerBillingSummary(customerPackages)
      payload.pending_transfer_proofs = await serializePendingProofs(user)
      payload.pending_delivery_requests = await serializePendingDeliveryRequests(user)
    }

    res.json(payload)
  },
)

staffRouter.post(
  '/staff/packages/release-from-customs',
  permissionRequired('status_customs', 'billing'),
  async (req: AuthRequest, res) => {
    const data = req.body ?? {}
    const items = data.items ?? []
    const note = data.note

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'items must be a non-empty array' })
    }

    const [released, failed] = await releasePackagesFromCustoms(items, { note })
    const actor = getUserFromJwt(req)

    if (actor) {
      for (const pkg of released) {
        await logPackageAction(
          actor,
          ACTION_PACKAGE_BILLING_UPDATED,
          pkg.id,
          `Released ${pkg.trackingNumber} from customs — bill published`,
          {
            tracking_number: pkg.trackingNumber,
            to_status: 'ready_for_pickup',
            total_due_jmd: pkg.totalDueJmd != null ? parseFloat(pkg.totalDueJmd) : null,
            bulk: items.length > 1,
          },
        )
      }
    }

    res.json({
      released: released.length,
      packages: await Promise.all(released.map((pkg) => serializeWarehousePackage(pkg))),
      failed,
    })
  },
)

staffRouter.post(
  '/staff/packages/bulk-request-invoice',
  permissionRequired('invoice_request'),
  async (req: AuthRequest, res) => {
    const data = req.body ?? {}
    const packageIds = data.package_ids ?? []
    const channel = String(data.channel ?? 'email').trim().toLowerCase()
    const note = data.note

    if (!['email', 'whatsapp', 'both'].includes(channel)) {
      return res.status(400).json({ error: 'Invalid channel' })
    }
    if (!Array.isArray(packageIds) || !packageIds.length) {
      return res.status(400).json({ error: 'package_ids must be a non-empty array' })
    }
    if (packageIds.length > 500) {
      return res.status(400).json({ error: 'Cannot request more than 500 invoices at once' })
    }

    const [sent, failed] = await bulkRequestCustomsInvoices(packageIds, channel, note)
    const actor = getUserFromJwt(req)

    if (actor) {
      for (const item of sent) {
        await logPackageAction(
          actor,
          ACTION_PACKAGE_INVOICE_REQUESTED,
          String(item.package_id),
          `Bulk invoice request for ${item.tracking_number} via ${channel}`,
          {
            tracking_number: item.tracking_number,
            channel,
            channels_sent: item.channels_sent,
            bulk: true,
          },
        )
      }
    }

    res.json({ sent: sent.length, results: sent, failed })
  },
)

staffRouter.post(
  '/staff/customers/:shippingId/checkouts',
  permissionRequired('billing'),
  async (req: AuthRequest, res) => {
    const user = await findCustomerByShippingId(routeParam(req.params.shippingId))
    if (!user) return res.status(404).json({ error: 'Customer not found' })

    const data = req.body ?? {}
    const packageIds = data.package_ids ?? []
    const method = String(data.method ?? '').trim().toLowerCase()
    if (!method) return res.status(400).json({ error: 'method is required' })
    if (!Array.isArray(packageIds)) return res.status(400).json({ error: 'package_ids must be an array' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    let processingFee: number | null | undefined = data.processing_fee_jmd
    if (processingFee != null) {
      processingFee = parseFloat(String(processingFee))
      if (Number.isNaN(processingFee)) {
        return res.status(400).json({ error: 'Invalid processing_fee_jmd' })
      }
      if (processingFee < 0) {
        return res.status(400).json({ error: 'processing_fee_jmd cannot be negative' })
      }
    }

    let checkout
    try {
      checkout = await recordPaymentCheckout(user, packageIds, {
        method,
        recordedBy: actor,
        reference: data.reference,
        notes: data.notes,
        processingFeeJmd: processingFee,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return res.status(400).json({ error: message })
    }

    let emailSent = false
    let emailError: string | null = null
    if (data.email_invoice) {
      const items = await getCheckoutItems(checkout.id)
      const pkgs = items.map((i) => i.pkg).filter(Boolean) as Array<typeof packages.$inferSelect>
      try {
        await sendCheckoutInvoiceEmail(user, checkout, pkgs)
        emailSent = true
      } catch (err) {
        emailError = err instanceof EmailServiceError || err instanceof Error ? err.message : String(err)
        console.warn(`Checkout invoice email failed for ${checkout.invoiceNumber}: ${emailError}`)
      }
    }

    const checkoutItems = await getCheckoutItems(checkout.id)
    for (const { item } of checkoutItems) {
      await logPackageAction(
        actor,
        ACTION_PACKAGE_PAYMENT_RECORDED,
        item.packageId,
        `Checkout ${checkout.invoiceNumber} — ${checkout.method}`,
        {
          checkout_id: checkout.id,
          invoice_number: checkout.invoiceNumber,
          amount_jmd: parseFloat(item.amountJmd),
          method: checkout.method,
          reference: checkout.reference,
          package_count: checkoutItems.length,
        },
      )
    }

    let deliveredCount = 0
    const deliveryFailed: Array<Record<string, unknown>> = []
    if (data.mark_delivered) {
      const deliveryNote = `Delivered at checkout ${checkout.invoiceNumber}`
      for (const { item, pkg } of checkoutItems) {
        if (!pkg) continue
        try {
          await updatePackageStatus(pkg, 'delivered', deliveryNote)
          deliveredCount += 1
          await logPackageAction(
            actor,
            ACTION_PACKAGE_STATUS_UPDATED,
            pkg.id,
            `Marked ${pkg.trackingNumber} delivered at checkout`,
            {
              tracking_number: pkg.trackingNumber,
              to_status: 'delivered',
              checkout_id: checkout.id,
            },
          )
        } catch (err) {
          deliveryFailed.push({
            id: pkg.id,
            tracking_number: pkg.trackingNumber,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    let recordedBy: UserRow | null = null
    if (checkout.recordedById) {
      ;[recordedBy] = await db.select().from(users).where(eq(users.id, checkout.recordedById)).limit(1)
    }

    res.status(201).json({
      checkout: paymentCheckoutToDict(checkout, {
        includeItems: true,
        items: checkoutItems,
        recordedBy: recordedBy ?? null,
      }),
      email_sent: emailSent,
      email_error: emailError,
      delivered_count: deliveredCount,
      delivery_failed: deliveryFailed,
    })
  },
)

staffRouter.get(
  '/staff/checkouts/:checkoutId/bill-invoice',
  permissionRequired('billing'),
  async (req, res) => {
    const checkoutId = routeParam(req.params.checkoutId)
    if (!validateUuid(checkoutId)) return res.status(400).json({ error: 'Invalid checkout ID' })

    const [checkout] = await db
      .select()
      .from(paymentCheckouts)
      .where(eq(paymentCheckouts.id, checkoutId))
      .limit(1)
    if (!checkout) return res.status(404).json({ error: 'Checkout not found' })

    const items = await getCheckoutItems(checkout.id)
    const pkgs = items.map((i) => i.pkg).filter(Boolean) as Array<typeof packages.$inferSelect>
    const [customer] = await db.select().from(users).where(eq(users.id, checkout.customerId)).limit(1)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    const itemAmounts = new Map(items.map((i) => [i.item.packageId, i.item.amountJmd]))
    res.type('html')
    res.send(renderCheckoutInvoiceHtml(checkout, customer, pkgs, itemAmounts))
  },
)

staffRouter.post(
  '/staff/packages/:packageId/payments',
  permissionRequired('billing'),
  async (req: AuthRequest, res) => {
    const packageId = routeParam(req.params.packageId)
    if (!validateUuid(packageId)) return res.status(400).json({ error: 'Invalid package ID' })

    const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    const data = req.body ?? {}
    const method = String(data.method ?? '').trim().toLowerCase()
    if (!method) return res.status(400).json({ error: 'method is required' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    let checkout
    try {
      checkout = await recordPackagePayment(pkg, {
        method,
        recordedBy: actor,
        reference: data.reference,
        notes: data.notes,
      })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    await logPackageAction(
      actor,
      ACTION_PACKAGE_PAYMENT_RECORDED,
      pkg.id,
      `Recorded payment for ${pkg.trackingNumber} — ${checkout.invoiceNumber} (${checkout.method})`,
      {
        tracking_number: pkg.trackingNumber,
        checkout_id: checkout.id,
        invoice_number: checkout.invoiceNumber,
        amount_jmd: parseFloat(checkout.totalJmd),
        method: checkout.method,
        reference: checkout.reference,
      },
    )

    const [fresh] = await db.select().from(packages).where(eq(packages.id, pkg.id)).limit(1)
    const pkgData = packageToDict(fresh!)
    pkgData.payment = await packagePaymentSummary(fresh!)

    const checkoutItems = await getCheckoutItems(checkout.id)
    let recordedBy: UserRow | null = null
    if (checkout.recordedById) {
      ;[recordedBy] = await db.select().from(users).where(eq(users.id, checkout.recordedById)).limit(1)
    }

    res.status(201).json({
      package: pkgData,
      checkout: paymentCheckoutToDict(checkout, {
        includeItems: true,
        items: checkoutItems,
        recordedBy: recordedBy ?? null,
      }),
    })
  },
)

staffRouter.get(
  '/staff/packages/:packageId/bill-invoice',
  permissionRequired('billing'),
  async (req, res) => {
    const packageId = routeParam(req.params.packageId)
    if (!validateUuid(packageId)) return res.status(400).json({ error: 'Invalid package ID' })

    const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    if (!['ready', 'paid'].includes(pkg.billingStatus)) {
      return res.status(400).json({ error: 'Bill has not been published yet' })
    }
    if (pkg.totalDueJmd == null) return res.status(400).json({ error: 'No bill amount on this package' })

    const item = await getPackageCheckoutItem(pkg)
    const checkout = item?.checkout ?? null
    const [customer] = await db.select().from(users).where(eq(users.id, pkg.customerId)).limit(1)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    res.type('html')
    if (checkout) {
      const checkoutItems = await getCheckoutItems(checkout.id)
      if (checkoutItems.length > 1) {
        const pkgs = checkoutItems.map((i) => i.pkg).filter(Boolean) as Array<typeof packages.$inferSelect>
        const itemAmounts = new Map(checkoutItems.map((i) => [i.item.packageId, i.item.amountJmd]))
        return res.send(renderCheckoutInvoiceHtml(checkout, customer, pkgs, itemAmounts))
      }
    }
    res.send(renderBillInvoiceHtml(pkg, customer))
  },
)

staffRouter.post(
  '/staff/packages/receive',
  permissionRequired('receive'),
  async (req: AuthRequest, res) => {
    const data = req.body ?? {}
    const shippingId = String(data.shipping_id ?? '').trim().toUpperCase()
    const weightRaw = data.actual_weight_lbs
    const shipper = String(data.shipper ?? '').trim().toLowerCase()

    if (!shippingId) return res.status(400).json({ error: 'shipping_id is required' })
    if (weightRaw == null) return res.status(400).json({ error: 'actual_weight_lbs is required' })
    if (!shipper) return res.status(400).json({ error: 'shipper is required' })
    if (!(SHIPPER_CODES as ReadonlySet<string>).has(shipper)) {
      return res.status(400).json({ error: 'Invalid shipper' })
    }

    const [weight, weightError] = parseReceiveWeight(weightRaw)
    if (weightError) return res.status(weightError.status).json(weightError.body)

    const customer = await findCustomerByShippingId(shippingId)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    const photoKeys = data.photo_keys ?? []
    if (!Array.isArray(photoKeys)) return res.status(400).json({ error: 'photo_keys must be an array' })

    let receivedPackage
    let matchedPreAlert
    try {
      ;[receivedPackage, matchedPreAlert] = await receivePackage(customer, weight!, {
        carrierTracking: data.carrier_tracking,
        shipper,
        photoKeys,
        note: data.note,
        receiveBatchId: data.receive_batch_id,
      })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    const actor = getUserFromJwt(req)
    if (actor) {
      let receiveBatchCode: string | null = null
      if (receivedPackage.receiveBatchId) {
        const rels = await loadPackageRelations(receivedPackage)
        receiveBatchCode = rels.receiveBatch?.batchCode ?? null
      }
      await logPackageAction(
        actor,
        ACTION_PACKAGE_RECEIVED,
        receivedPackage.id,
        `Received ${receivedPackage.trackingNumber} for ${customer.shippingId} (${receivedPackage.billableWeightLbs} lbs)`,
        {
          tracking_number: receivedPackage.trackingNumber,
          shipping_id: customer.shippingId,
          shipper: receivedPackage.shipper,
          carrier_tracking: receivedPackage.carrierTracking,
          billable_weight_lbs: receivedPackage.billableWeightLbs,
          estimated_freight_jmd:
            receivedPackage.estimatedFreightJmd != null
              ? parseFloat(receivedPackage.estimatedFreightJmd)
              : null,
          pre_alert_matched: matchedPreAlert != null,
          receive_batch_id: receivedPackage.receiveBatchId,
          receive_batch_code: receiveBatchCode,
        },
      )
    }

    const rels = await loadPackageRelations(receivedPackage)
    const pkgData = warehousePackageToDict(receivedPackage, rels)
    pkgData.customer = customerStaffDict(customer)

    const response: Record<string, unknown> = { package: pkgData }
    if (matchedPreAlert) response.pre_alert_matched = preAlertToDict(matchedPreAlert)
    res.status(201).json(response)
  },
)

staffRouter.post(
  '/staff/packages/receive-unidentified',
  permissionRequired('receive'),
  async (req: AuthRequest, res) => {
    const data = req.body ?? {}
    const weightRaw = data.actual_weight_lbs
    const shipper = String(data.shipper ?? '').trim().toLowerCase()

    if (weightRaw == null) return res.status(400).json({ error: 'actual_weight_lbs is required' })
    if (!shipper) return res.status(400).json({ error: 'shipper is required' })
    if (!(SHIPPER_CODES as ReadonlySet<string>).has(shipper)) {
      return res.status(400).json({ error: 'Invalid shipper' })
    }

    const [weight, weightError] = parseReceiveWeight(weightRaw)
    if (weightError) return res.status(weightError.status).json(weightError.body)

    const photoKeys = data.photo_keys ?? []
    if (!Array.isArray(photoKeys)) return res.status(400).json({ error: 'photo_keys must be an array' })

    let receivedPackage
    try {
      receivedPackage = await receiveUnidentifiedPackage(weight!, {
        carrierTracking: data.carrier_tracking,
        shipper,
        labelName: data.label_name,
        labelBossId: data.label_boss_id,
        photoKeys,
        note: data.note,
        receiveBatchId: data.receive_batch_id,
      })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    const actor = getUserFromJwt(req)
    if (actor) {
      let receiveBatchCode: string | null = null
      if (receivedPackage.receiveBatchId) {
        const rels = await loadPackageRelations(receivedPackage)
        receiveBatchCode = rels.receiveBatch?.batchCode ?? null
      }
      await logPackageAction(
        actor,
        ACTION_PACKAGE_RECEIVED_UNIDENTIFIED,
        receivedPackage.id,
        `Queued unidentified ${receivedPackage.trackingNumber} (${receivedPackage.billableWeightLbs} lbs)`,
        {
          tracking_number: receivedPackage.trackingNumber,
          label_name: receivedPackage.labelName,
          label_boss_id: receivedPackage.labelBossId,
          carrier_tracking: receivedPackage.carrierTracking,
          shipper: receivedPackage.shipper,
          billable_weight_lbs: receivedPackage.billableWeightLbs,
          receive_batch_id: receivedPackage.receiveBatchId,
          receive_batch_code: receiveBatchCode,
        },
      )
    }

    const rels = await loadPackageRelations(receivedPackage)
    res.status(201).json({ package: warehousePackageToDict(receivedPackage, rels) })
  },
)

staffRouter.get('/staff/packages/unidentified', permissionRequired('receive'), async (req, res) => {
  let limit = parseInt(String(req.query.limit ?? '50'), 10)
  let offset = parseInt(String(req.query.offset ?? '0'), 10)
  if (Number.isNaN(limit)) limit = 50
  if (Number.isNaN(offset)) offset = 0
  limit = Math.max(1, Math.min(limit, 100))
  offset = Math.max(0, offset)

  const [rows, total] = await listUnidentifiedPackages(limit, offset)
  const packagesData = await Promise.all(rows.map((pkg) => serializeWarehousePackage(pkg)))
  res.json({ packages: packagesData, total })
})

staffRouter.post(
  '/staff/packages/:packageId/assign',
  permissionRequired('receive'),
  async (req: AuthRequest, res) => {
    const data = req.body ?? {}
    const shippingId = String(data.shipping_id ?? '').trim().toUpperCase()
    if (!shippingId) return res.status(400).json({ error: 'shipping_id is required' })

    const packageId = routeParam(req.params.packageId)
    if (!validateUuid(packageId)) return res.status(400).json({ error: 'Invalid package ID' })

    const [pkg] = await db
      .select()
      .from(packages)
      .where(and(eq(packages.id, packageId), eq(packages.status, 'unidentified')))
      .limit(1)
    if (!pkg) return res.status(404).json({ error: 'Unidentified package not found' })

    const customer = await findCustomerByShippingId(shippingId)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    let updatedPackage
    let matchedPreAlert
    try {
      ;[updatedPackage, matchedPreAlert] = await assignUnidentifiedPackage(pkg, customer, data.note)
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    const actor = getUserFromJwt(req)
    if (actor) {
      await logPackageAction(
        actor,
        ACTION_PACKAGE_ASSIGNED,
        updatedPackage.id,
        `Assigned ${updatedPackage.trackingNumber} to ${customer.shippingId} (${customer.firstName} ${customer.lastName})`,
        {
          tracking_number: updatedPackage.trackingNumber,
          shipping_id: customer.shippingId,
          label_name: updatedPackage.labelName,
          label_boss_id: updatedPackage.labelBossId,
          pre_alert_matched: matchedPreAlert != null,
        },
      )
    }

    const rels = await loadPackageRelations(updatedPackage)
    const pkgData = warehousePackageToDict(updatedPackage, rels)
    pkgData.customer = customerStaffDict(customer)

    const response: Record<string, unknown> = { package: pkgData }
    if (matchedPreAlert) response.pre_alert_matched = preAlertToDict(matchedPreAlert)
    res.json(response)
  },
)

staffRouter.post(
  '/staff/packages/:packageId/unassign',
  adminRequired(),
  async (req: AuthRequest, res) => {
    const data = req.body ?? {}
    let note = String(data.note ?? '').trim() || null
    if (note && note.length > 500) {
      return res.status(400).json({ error: 'note must be 500 characters or fewer' })
    }

    const packageId = routeParam(req.params.packageId)
    if (!validateUuid(packageId)) return res.status(400).json({ error: 'Invalid package ID' })

    const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    let updatedPackage
    let previousCustomer
    try {
      ;[updatedPackage, previousCustomer] = await unassignPackageFromCustomer(pkg, { note })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    const actor = getUserFromJwt(req)
    if (actor) {
      await logPackageAction(
        actor,
        ACTION_PACKAGE_UNASSIGNED,
        updatedPackage.id,
        `Unassigned ${updatedPackage.trackingNumber} from ${previousCustomer.shippingId} (${previousCustomer.firstName} ${previousCustomer.lastName})`,
        {
          tracking_number: updatedPackage.trackingNumber,
          previous_shipping_id: previousCustomer.shippingId,
          previous_customer_id: previousCustomer.id,
        },
      )
    }

    const rels = await loadPackageRelations(updatedPackage)
    res.json({
      package: warehousePackageToDict(updatedPackage, rels),
      previous_customer: customerStaffDict(previousCustomer),
    })
  },
)

staffRouter.get(
  '/staff/packages',
  permissionRequired('status_transit', 'status_customs', 'status_pickup', 'billing', 'receive'),
  async (req, res) => {
    const fromDate = String(req.query.from ?? '').trim()
    const toDate = String(req.query.to ?? '').trim()
    const status = String(req.query.status ?? '').trim() || null
    let limit = parseInt(String(req.query.limit ?? '100'), 10)
    let offset = parseInt(String(req.query.offset ?? '0'), 10)
    if (Number.isNaN(limit)) limit = 100
    if (Number.isNaN(offset)) offset = 0
    limit = Math.max(1, Math.min(limit, 100))
    offset = Math.max(0, offset)

    if (status && !(UPDATABLE_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter' })
    }

    const [rows, total] = await listWarehousePackages({
      fromDate: fromDate || null,
      toDate: toDate || null,
      status,
      limit,
      offset,
    })

    res.json({
      packages: await serializeWarehousePackages(rows),
      total,
    })
  },
)

staffRouter.get('/staff/packages/search', warehouseRequired(), async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  let limit = parseInt(String(req.query.limit ?? '20'), 10)
  if (Number.isNaN(limit)) limit = 20

  if (q.length < MIN_PACKAGE_SEARCH_QUERY_LEN) {
    return res.json({ matches: [], truncated: false })
  }

  const [matches, truncated] = await searchPackages(q, { limit })
  res.json({ matches, truncated })
})

staffRouter.get(
  '/staff/packages/lookup/:trackingNumber',
  permissionRequired('status_transit', 'status_customs', 'status_pickup', 'billing', 'receive'),
  async (req, res) => {
    const trackingNumber = routeParam(req.params.trackingNumber).trim().toUpperCase()
    const [pkg] = await db
      .select()
      .from(packages)
      .where(eq(packages.trackingNumber, trackingNumber))
      .limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })
    res.json({ package: await serializeWarehousePackage(pkg) })
  },
)

staffRouter.get('/staff/packages/my-recent-receives', permissionRequired('receive'), async (req: AuthRequest, res) => {
  const actor = getUserFromJwt(req)
  if (!actor) return res.status(401).json({ error: 'Unauthorized' })

  let limit = parseInt(String(req.query.limit ?? '3'), 10)
  if (Number.isNaN(limit)) limit = 3
  limit = Math.max(1, Math.min(limit, 10))

  res.json({ receives: await listClerkReceivesToday(actor.id, limit) })
})

staffRouter.get('/staff/packages/print-queue', permissionRequired('receive'), async (req, res) => {
  let days = parseInt(String(req.query.days ?? '7'), 10)
  let limit = parseInt(String(req.query.limit ?? '100'), 10)
  let offset = parseInt(String(req.query.offset ?? '0'), 10)
  const pendingOnlyRaw = String(req.query.pending_only ?? 'true')
  const pendingOnly = !['0', 'false', 'no'].includes(pendingOnlyRaw.toLowerCase())
  if (Number.isNaN(days)) days = 7
  if (Number.isNaN(limit)) limit = 100
  if (Number.isNaN(offset)) offset = 0
  days = Math.max(1, Math.min(days, 30))
  limit = Math.max(1, Math.min(limit, 100))
  offset = Math.max(0, offset)

  const [rows, total] = await listLabelLog(days, limit, offset, pendingOnly)
  const packagesData = await Promise.all(rows.map((pkg) => serializeWarehousePackage(pkg)))
  res.json({ packages: packagesData, total })
})

staffRouter.patch('/staff/packages/mark-printed', permissionRequired('receive'), async (req, res) => {
  const data = req.body ?? {}
  const packageIds = data.package_ids ?? []

  if (!Array.isArray(packageIds) || !packageIds.length) {
    return res.status(400).json({ error: 'package_ids must be a non-empty array' })
  }
  if (packageIds.length > 500) {
    return res.status(400).json({ error: 'Cannot mark more than 500 packages at once' })
  }

  const [marked, failed] = await markLabelsPrinted(packageIds)
  res.json({
    marked: marked.length,
    package_ids: marked.map((p) => p.id),
    failed,
  })
})

staffRouter.patch(
  '/staff/packages/bulk-status',
  permissionRequired('status_transit', 'status_customs', 'status_pickup', 'billing'),
  async (req: AuthRequest, res) => {
    const data = req.body ?? {}
    const status = String(data.status ?? '').trim()
    const note = data.note
    const packageIds = data.package_ids ?? []

    if (!status) return res.status(400).json({ error: 'status is required' })
    if (!(UPDATABLE_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        allowed: UPDATABLE_STATUSES,
        labels: STATUS_LABELS,
      })
    }
    if (!Array.isArray(packageIds) || !packageIds.length) {
      return res.status(400).json({ error: 'package_ids must be a non-empty array' })
    }
    if (packageIds.length > 500) {
      return res.status(400).json({ error: 'Cannot update more than 500 packages at once' })
    }

    const actor = getUserFromJwt(req)
    if (actor?.role === 'clerk') {
      for (const rawId of packageIds) {
        if (!validateUuid(String(rawId))) continue
        const [pkg] = await db.select().from(packages).where(eq(packages.id, String(rawId))).limit(1)
        if (!pkg) continue
        try {
          assertStatusTransitionAllowed(actor, pkg.status, status)
        } catch (err) {
          return res.status(403).json({ error: err instanceof Error ? err.message : String(err) })
        }
      }
    }

    let updated
    let failed
    try {
      ;[updated, failed] = await bulkUpdatePackageStatus(packageIds, status, note)
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    if (actor) {
      for (const pkg of updated) {
        await logPackageAction(
          actor,
          ACTION_PACKAGE_STATUS_UPDATED,
          pkg.id,
          `Bulk update ${pkg.trackingNumber} → ${STATUS_LABELS[status] ?? status}`,
          {
            tracking_number: pkg.trackingNumber,
            to_status: status,
            note,
            bulk: true,
          },
        )
      }
    }

    res.json({
      updated: updated.length,
      packages: updated.map((pkg) => packageToDict(pkg)),
      failed,
    })
  },
)

staffRouter.patch(
  '/staff/packages/:trackingNumber/status',
  permissionRequired('status_transit', 'status_customs', 'status_pickup'),
  async (req: AuthRequest, res) => {
    const data = req.body ?? {}
    const status = String(data.status ?? '').trim()

    if (!(UPDATABLE_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        allowed: UPDATABLE_STATUSES,
        labels: STATUS_LABELS,
      })
    }

    const trackingNumber = routeParam(req.params.trackingNumber).trim().toUpperCase()
    const [pkg] = await db
      .select()
      .from(packages)
      .where(eq(packages.trackingNumber, trackingNumber))
      .limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    if (pkg.status === 'unidentified') {
      return res.status(400).json({
        error: 'Unidentified packages must be assigned to a customer before updating status',
      })
    }

    const oldStatus = pkg.status
    const actor = getUserFromJwt(req)
    if (actor) {
      try {
        assertStatusTransitionAllowed(actor, oldStatus, status)
      } catch (err) {
        return res.status(403).json({ error: err instanceof Error ? err.message : String(err) })
      }
    }

    const updated = await updatePackageStatus(pkg, status, data.note)

    if (actor) {
      await logPackageAction(
        actor,
        ACTION_PACKAGE_STATUS_UPDATED,
        updated.id,
        `Updated ${updated.trackingNumber}: ${STATUS_LABELS[oldStatus] ?? oldStatus} → ${STATUS_LABELS[status] ?? status}`,
        {
          tracking_number: updated.trackingNumber,
          from_status: oldStatus,
          to_status: status,
          note: data.note,
        },
      )
    }

    const rels = await loadPackageRelations(updated)
    res.json({ package: packageToDict(updated, { includeEvents: true, events: rels.events }) })
  },
)

staffRouter.get(
  '/staff/customers/:shippingId/delivery-addresses',
  permissionRequired('billing', 'directory'),
  async (req, res) => {
    const user = await findCustomerByShippingId(routeParam(req.params.shippingId))
    if (!user) return res.status(404).json({ error: 'Customer not found' })

    const addresses = await listDeliveryAddresses(user)
    res.json({ addresses: addresses.map(deliveryAddressToDict) })
  },
)

staffRouter.post(
  '/staff/packages/:packageId/request-invoice',
  permissionRequired('invoice_request'),
  async (req: AuthRequest, res) => {
    const packageId = routeParam(req.params.packageId)
    if (!validateUuid(packageId)) return res.status(400).json({ error: 'Invalid package ID' })

    const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    const data = req.body ?? {}
    const channel = String(data.channel ?? 'email').trim().toLowerCase()
    const note = data.note

    let result
    try {
      result = await requestPackageInvoice(pkg, channel, note)
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    const actor = getUserFromJwt(req)
    if (actor) {
      await logPackageAction(
        actor,
        ACTION_PACKAGE_INVOICE_REQUESTED,
        pkg.id,
        `Requested invoice for ${pkg.trackingNumber} via ${channel}`,
        {
          tracking_number: pkg.trackingNumber,
          channel,
          channels_sent: result.channels_sent,
          note,
        },
      )
    }

    const [fresh] = await db.select().from(packages).where(eq(packages.id, pkg.id)).limit(1)
    res.json({ package: packageToDict(fresh!), ...result })
  },
)

staffRouter.patch(
  '/staff/packages/:packageId/billing',
  permissionRequired('billing'),
  async (req: AuthRequest, res) => {
    const packageId = routeParam(req.params.packageId)
    if (!validateUuid(packageId)) return res.status(400).json({ error: 'Invalid package ID' })

    const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    const data = req.body ?? {}

    let updated
    try {
      updated = await updatePackageBilling(pkg, {
        estimatedFreightJmd: data.estimated_freight_jmd ?? data.estimated_freight_usd,
        dutiesJmd: data.duties_jmd ?? data.duties_usd,
        handlingJmd: data.handling_jmd ?? data.handling_usd,
        otherFeesJmd: data.other_fees_jmd ?? data.other_fees_usd,
        declaredValueUsd: data.declared_value_usd,
        billingStatus: data.billing_status,
        publish: Boolean(data.publish),
      })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    const actor = getUserFromJwt(req)
    if (actor) {
      await logPackageAction(
        actor,
        ACTION_PACKAGE_BILLING_UPDATED,
        updated.id,
        `Updated billing for ${updated.trackingNumber}`,
        {
          tracking_number: updated.trackingNumber,
          total_due_jmd: updated.totalDueJmd != null ? parseFloat(updated.totalDueJmd) : null,
          billing_status: updated.billingStatus,
          publish: Boolean(data.publish),
        },
      )
    }

    res.json({ package: packageToDict(updated) })
  },
)

staffRouter.patch(
  '/staff/packages/:packageId/receive-details',
  permissionRequired('receive'),
  async (req: AuthRequest, res) => {
    const packageId = routeParam(req.params.packageId)
    if (!validateUuid(packageId)) return res.status(400).json({ error: 'Invalid package ID' })

    const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    const data = req.body ?? {}
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' })

    let weight: number | null | undefined
    if ('actual_weight_lbs' in data) {
      const [parsed, weightError] = parseReceiveWeight(data.actual_weight_lbs)
      if (weightError) return res.status(weightError.status).json(weightError.body)
      weight = parsed
    }

    let shipper: string | null | undefined
    if ('shipper' in data) {
      shipper = String(data.shipper ?? '').trim().toLowerCase()
      if (!shipper) return res.status(400).json({ error: 'shipper is required' })
      if (!(SHIPPER_CODES as ReadonlySet<string>).has(shipper)) {
        return res.status(400).json({ error: 'Invalid shipper' })
      }
    }

    let updated
    try {
      updated = await updatePackageReceiveDetails(pkg, {
        actualWeightLbs: weight,
        shipper,
        carrierTracking: 'carrier_tracking' in data ? data.carrier_tracking : undefined,
        labelName: 'label_name' in data ? data.label_name : undefined,
        labelBossId: 'label_boss_id' in data ? data.label_boss_id : undefined,
        carrierTrackingProvided: 'carrier_tracking' in data,
        labelNameProvided: 'label_name' in data,
        labelBossIdProvided: 'label_boss_id' in data,
        requeuePrint: Boolean(data.requeue_print),
      })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    const actor = getUserFromJwt(req)
    if (actor) {
      await logPackageAction(
        actor,
        ACTION_PACKAGE_LABEL_UPDATED,
        updated.id,
        `Updated label details for ${updated.trackingNumber}`,
        {
          tracking_number: updated.trackingNumber,
          requeue_print: Boolean(data.requeue_print),
        },
      )
    }

    const rels = await loadPackageRelations(updated)
    res.json({ package: warehousePackageToDict(updated, rels) })
  },
)

staffRouter.patch(
  '/staff/packages/:packageId/delivery-address',
  permissionRequired('billing'),
  async (req, res) => {
    const packageId = routeParam(req.params.packageId)
    if (!validateUuid(packageId)) return res.status(400).json({ error: 'Invalid package ID' })

    const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    const data = req.body ?? {}
    const addressId = data.delivery_address_id
    if (!addressId) return res.status(400).json({ error: 'delivery_address_id is required' })
    if (!validateUuid(String(addressId))) return res.status(400).json({ error: 'Invalid delivery address ID' })

    const [customer] = await db.select().from(users).where(eq(users.id, pkg.customerId)).limit(1)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    let updated
    try {
      updated = await assignDeliveryAddress(pkg, String(addressId), customer)
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    res.json({ package: packageToDict(updated) })
  },
)

staffRouter.get('/staff/shipments', permissionRequired('status_transit'), async (req, res) => {
  const status = String(req.query.status ?? '').trim() || null
  if (status && !(SHIPMENT_STATUSES as readonly string[]).includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  let limit: number
  let offset: number
  try {
    limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200)
    offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10), 0)
    if (Number.isNaN(limit) || Number.isNaN(offset)) throw new Error('Invalid pagination')
  } catch {
    return res.status(400).json({ error: 'Invalid pagination' })
  }

  const [shipmentRows, total] = await listShipments({ status, limit, offset })
  const shipmentIds = shipmentRows.map((s) => s.id)
  const shipmentPackages =
    shipmentIds.length > 0
      ? await db.select().from(packages).where(inArray(packages.shipmentId, shipmentIds))
      : []
  const packagesByShipment = new Map<string, Array<typeof packages.$inferSelect>>()
  for (const pkg of shipmentPackages) {
    if (!pkg.shipmentId) continue
    const list = packagesByShipment.get(pkg.shipmentId) ?? []
    list.push(pkg)
    packagesByShipment.set(pkg.shipmentId, list)
  }

  res.json({
    shipments: shipmentRows.map((shipment) =>
      shipmentToDict(shipment, { packages: packagesByShipment.get(shipment.id) ?? [] }),
    ),
    total,
  })
})

staffRouter.post('/staff/shipments', permissionRequired('status_transit'), async (req: AuthRequest, res) => {
  const data = req.body ?? {}
  const reference = String(data.reference ?? '').trim()
  const note = data.note
  const rawDate = String(data.departure_date ?? '').trim()

  if (!reference) return res.status(400).json({ error: 'reference is required' })
  if (!rawDate) return res.status(400).json({ error: 'departure_date is required' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return res.status(400).json({ error: 'departure_date must be YYYY-MM-DD' })
  }

  const actor = getUserFromJwt(req)
  let shipment
  try {
    shipment = await createShipment({
      reference,
      departureDate: rawDate,
      note,
      createdBy: actor ?? null,
    })
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
  }

  res.status(201).json({ shipment: shipmentToDict(shipment) })
})

staffRouter.get('/staff/shipments/:shipmentId', permissionRequired('status_transit'), async (req, res) => {
  const shipmentId = routeParam(req.params.shipmentId)
  if (!validateUuid(shipmentId)) return res.status(400).json({ error: 'Invalid shipment ID' })

  const shipment = await getShipment(shipmentId)
  if (!shipment) return res.status(404).json({ error: 'Departure not found' })

  const shipmentPackages = await db.select().from(packages).where(eq(packages.shipmentId, shipment.id))
  res.json({
    shipment: shipmentToDict(shipment, { includePackages: true, packages: shipmentPackages }),
  })
})

staffRouter.post(
  '/staff/shipments/:shipmentId/packages',
  permissionRequired('status_transit'),
  async (req: AuthRequest, res) => {
    const shipmentId = routeParam(req.params.shipmentId)
    if (!validateUuid(shipmentId)) return res.status(400).json({ error: 'Invalid shipment ID' })

    const shipment = await getShipment(shipmentId)
    if (!shipment) return res.status(404).json({ error: 'Departure not found' })

    const data = req.body ?? {}
    const tracking = String(data.tracking_number ?? '').trim()
    const packageIds = data.package_ids ?? []
    const actor = getUserFromJwt(req)

    try {
      if (tracking) {
        const pkg = await addPackageByTracking(shipment, tracking, { actor: actor ?? null })
        const rels = await loadPackageRelations(pkg)
        return res.json({ package: warehousePackageToDict(pkg, rels) })
      }
      if (!Array.isArray(packageIds) || !packageIds.length) {
        return res.status(400).json({ error: 'tracking_number or package_ids is required' })
      }
      const [added, failed] = await addPackagesToShipment(shipment, packageIds, { actor: actor ?? null })
      const packagesData = await Promise.all(added.map((pkg) => serializeWarehousePackage(pkg)))
      return res.json({ added: added.length, packages: packagesData, failed })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.delete(
  '/staff/shipments/:shipmentId/packages/:packageId',
  permissionRequired('status_transit'),
  async (req: AuthRequest, res) => {
    const shipmentId = routeParam(req.params.shipmentId)
    const packageId = routeParam(req.params.packageId)
    if (!validateUuid(shipmentId) || !validateUuid(packageId)) {
      return res.status(400).json({ error: 'Invalid ID' })
    }

    const shipment = await getShipment(shipmentId)
    if (!shipment) return res.status(404).json({ error: 'Departure not found' })

    const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1)
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    const actor = getUserFromJwt(req)
    try {
      await removePackageFromShipment(shipment, pkg, { actor: actor ?? null })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }

    res.json({ ok: true })
  },
)

staffRouter.post(
  '/staff/shipments/:shipmentId/depart',
  permissionRequired('status_transit'),
  async (req: AuthRequest, res) => {
    const shipmentId = routeParam(req.params.shipmentId)
    if (!validateUuid(shipmentId)) return res.status(400).json({ error: 'Invalid shipment ID' })

    const shipment = await getShipment(shipmentId)
    if (!shipment) return res.status(404).json({ error: 'Departure not found' })

    const data = req.body ?? {}
    const note = data.note
    const actor = getUserFromJwt(req)

    if (actor?.role === 'clerk') {
      try {
        assertStatusTransitionAllowed(actor, 'received', 'in_transit')
      } catch (err) {
        return res.status(403).json({ error: err instanceof Error ? err.message : String(err) })
      }
    }

    try {
      const [updated, failed] = await departShipment(shipment, { actor: actor ?? null, note })
      const freshShipment = (await getShipment(shipment.id))!
      const shipmentPackages = await db
        .select()
        .from(packages)
        .where(eq(packages.shipmentId, freshShipment.id))
      const packagesData = await Promise.all(updated.map((pkg) => serializeWarehousePackage(pkg)))
      res.json({
        shipment: shipmentToDict(freshShipment, { includePackages: true, packages: shipmentPackages }),
        updated: updated.length,
        packages: packagesData,
        failed,
      })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.post(
  '/staff/shipments/batch-depart',
  permissionRequired('status_transit'),
  async (req: AuthRequest, res) => {
    const data = req.body ?? {}
    const packageIds = data.package_ids ?? []
    const note = data.note
    const rawShipmentId = String(data.shipment_id ?? '').trim()
    const reference = String(data.reference ?? '').trim()
    const rawDate = String(data.departure_date ?? '').trim()

    if (!Array.isArray(packageIds) || !packageIds.length) {
      return res.status(400).json({ error: 'package_ids must be a non-empty array' })
    }

    let shipmentId: string | null = null
    if (rawShipmentId) {
      if (!validateUuid(rawShipmentId)) return res.status(400).json({ error: 'Invalid shipment_id' })
      shipmentId = rawShipmentId
    }

    let departureDate: string | null = null
    if (rawDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        return res.status(400).json({ error: 'departure_date must be YYYY-MM-DD' })
      }
      departureDate = rawDate
    }

    const actor = getUserFromJwt(req)
    if (actor?.role === 'clerk') {
      try {
        assertStatusTransitionAllowed(actor, 'received', 'in_transit')
      } catch (err) {
        return res.status(403).json({ error: err instanceof Error ? err.message : String(err) })
      }
    }

    try {
      const [shipment, updated] = await batchDepartPackages(packageIds, {
        shipmentId,
        reference: reference || null,
        departureDate,
        note,
        actor: actor ?? null,
      })
      const shipmentPackages = await db
        .select()
        .from(packages)
        .where(eq(packages.shipmentId, shipment.id))
      const packagesData = await Promise.all(updated.map((pkg) => serializeWarehousePackage(pkg)))
      res.json({
        shipment: shipmentToDict(shipment, { includePackages: true, packages: shipmentPackages }),
        updated: updated.length,
        packages: packagesData,
        failed: [],
      })
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.get('/staff/receive-batches', permissionRequired('receive'), async (req, res) => {
  const status = String(req.query.status ?? '').trim() || null
  if (status && !(RECEIVE_BATCH_STATUSES as readonly string[]).includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  let limit: number
  let offset: number
  try {
    limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200)
    offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10), 0)
    if (Number.isNaN(limit) || Number.isNaN(offset)) throw new Error('Invalid pagination')
  } catch {
    return res.status(400).json({ error: 'Invalid pagination' })
  }

  const [batches, total] = await listReceiveBatches({ status, limit, offset })
  const batchIds = batches.map((b) => b.id)
  const batchPackages =
    batchIds.length > 0
      ? await db.select().from(packages).where(inArray(packages.receiveBatchId, batchIds))
      : []
  const countsByBatch = new Map<string, number>()
  for (const pkg of batchPackages) {
    if (!pkg.receiveBatchId) continue
    countsByBatch.set(pkg.receiveBatchId, (countsByBatch.get(pkg.receiveBatchId) ?? 0) + 1)
  }

  res.json({
    receive_batches: batches.map((batch) =>
      receiveBatchToDict(batch, { packageCount: countsByBatch.get(batch.id) ?? 0 }),
    ),
    total,
  })
})

staffRouter.post('/staff/receive-batches', permissionRequired('receive'), async (req: AuthRequest, res) => {
  const data = req.body ?? {}
  const reference = String(data.reference ?? '').trim() || null
  const note = data.note
  const rawDate = String(data.receive_date ?? '').trim()

  let receiveDate: string | null = null
  if (rawDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return res.status(400).json({ error: 'receive_date must be YYYY-MM-DD' })
    }
    receiveDate = rawDate
  }

  const actor = getUserFromJwt(req)
  try {
    const batch = await createReceiveBatch({
      reference,
      receiveDate,
      note,
      createdBy: actor ?? null,
    })
    res.status(201).json({ receive_batch: receiveBatchToDict(batch) })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

staffRouter.get(
  '/staff/delivery-requests',
  permissionRequired('status_pickup', 'billing'),
  async (req, res) => {
    const status = String(req.query.status ?? 'active').trim().toLowerCase()
    let requests
    if (status === 'pending') {
      requests = await listPendingDeliveryRequests()
    } else if (status === 'active') {
      requests = await listOpenDeliveryRequests()
    } else if (status === 'all') {
      requests = await listAllDeliveryRequests()
    } else if (status === 'history') {
      requests = await listDeliveryRequestHistory()
    } else if (status === 'in_progress') {
      requests = await listDeliveryRequestsByStatus('in_progress')
    } else {
      requests = await listDeliveryRequestsByStatus(status)
    }

    res.json({ delivery_requests: await serializeDeliveryRequests(requests) })
  },
)

staffRouter.post(
  '/staff/delivery-requests/:requestId/in-progress',
  permissionRequired('status_pickup', 'billing'),
  async (req: AuthRequest, res) => {
    const requestId = routeParam(req.params.requestId)
    const deliveryRequest = await getDeliveryRequest(requestId)
    if (!deliveryRequest) return res.status(404).json({ error: 'Delivery request not found' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const updated = await markDeliveryRequestInProgress(deliveryRequest, actor)
      const details = await loadDeliveryRequestDetails(updated.id)
      if (!details) return res.status(404).json({ error: 'Delivery request not found' })
      res.json({
        delivery_request: deliveryRequestToDict(details.request, {
          includePackages: true,
          packageLinks: details.packageLinks,
          deliveryAddress: details.deliveryAddress,
          customer: details.customer,
          completedBy: details.completedBy,
          inProgressBy: details.inProgressBy,
        }),
      })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.post(
  '/staff/delivery-requests/:requestId/complete',
  permissionRequired('status_pickup'),
  async (req: AuthRequest, res) => {
    const requestId = routeParam(req.params.requestId)
    const deliveryRequest = await getDeliveryRequest(requestId)
    if (!deliveryRequest) return res.status(404).json({ error: 'Delivery request not found' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const updated = await completeDeliveryRequest(deliveryRequest, actor)
      const details = await loadDeliveryRequestDetails(updated.id)
      if (!details) return res.status(404).json({ error: 'Delivery request not found' })
      res.json({
        delivery_request: deliveryRequestToDict(details.request, {
          includePackages: true,
          packageLinks: details.packageLinks,
          deliveryAddress: details.deliveryAddress,
          customer: details.customer,
          completedBy: details.completedBy,
          inProgressBy: details.inProgressBy,
        }),
      })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.post(
  '/staff/delivery-requests/:requestId/cancel',
  permissionRequired('status_pickup', 'billing'),
  async (req, res) => {
    const requestId = routeParam(req.params.requestId)
    const deliveryRequest = await getDeliveryRequest(requestId)
    if (!deliveryRequest) return res.status(404).json({ error: 'Delivery request not found' })

    try {
      await cancelDeliveryRequest(deliveryRequest, false)
      const details = await loadDeliveryRequestDetails(requestId)
      if (!details) return res.status(404).json({ error: 'Delivery request not found' })
      res.json({
        delivery_request: deliveryRequestToDict(details.request, {
          includePackages: true,
          packageLinks: details.packageLinks,
          deliveryAddress: details.deliveryAddress,
          customer: details.customer,
          completedBy: details.completedBy,
          inProgressBy: details.inProgressBy,
        }),
      })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.get(
  '/staff/bank-transfer-proofs',
  permissionRequired('billing'),
  async (req, res) => {
    const status = String(req.query.status ?? 'active').trim().toLowerCase()
    let proofs
    if (status === 'pending') {
      proofs = await listPendingTransferProofs()
    } else if (status === 'active') {
      proofs = await listOpenTransferProofs()
    } else if (status === 'all') {
      proofs = await listAllTransferProofs()
    } else if (status === 'history') {
      proofs = await listTransferProofHistory()
    } else if (status === 'in_progress') {
      proofs = await listTransferProofsByStatus('in_progress')
    } else {
      proofs = await listTransferProofsByStatus(status)
    }

    res.json({ proofs: await Promise.all(proofs.map((proof) => proofToStaffDict(proof))) })
  },
)

staffRouter.post(
  '/staff/bank-transfer-proofs/:proofId/in-progress',
  permissionRequired('billing'),
  async (req: AuthRequest, res) => {
    const proofId = routeParam(req.params.proofId)
    const proof = await getTransferProof(proofId)
    if (!proof) return res.status(404).json({ error: 'Transfer proof not found' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const updated = await markTransferProofInProgress(proof, actor)
      res.json({ proof: await proofToStaffDict(updated) })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.post(
  '/staff/bank-transfer-proofs/:proofId/confirm',
  permissionRequired('billing'),
  async (req: AuthRequest, res) => {
    const proofId = routeParam(req.params.proofId)
    const proof = await getTransferProof(proofId)
    if (!proof) return res.status(404).json({ error: 'Transfer proof not found' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const updated = await confirmTransferProof(proof, actor)
      res.json({ proof: await proofToStaffDict(updated) })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.post(
  '/staff/bank-transfer-proofs/:proofId/reject',
  permissionRequired('billing'),
  async (req: AuthRequest, res) => {
    const proofId = routeParam(req.params.proofId)
    const proof = await getTransferProof(proofId)
    if (!proof) return res.status(404).json({ error: 'Transfer proof not found' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const updated = await rejectTransferProof(proof, actor)
      res.json({ proof: await proofToStaffDict(updated) })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.get(
  '/staff/me/logistics-jobs',
  permissionRequired(
    'receive',
    'activity',
    'pre_alerts',
    'status_transit',
    'status_customs',
    'status_pickup',
    'billing',
    'invoice_request',
    'directory',
  ),
  async (req: AuthRequest, res) => {
    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    const status = String(req.query.status ?? 'active').trim().toLowerCase()
    const jobs = await listClerkLogisticsJobs(actor, status)
    res.json({
      logistics_jobs: await Promise.all(jobs.map((job) => serializeJob(job))),
    })
  },
)

staffRouter.get(
  '/staff/logistics-jobs',
  permissionRequired('status_pickup', 'billing'),
  async (req: AuthRequest, res) => {
    const status = String(req.query.status ?? 'active').trim().toLowerCase()
    let jobs
    if (status === 'pending') jobs = await listPendingLogisticsJobs()
    else if (status === 'active') jobs = await listOpenLogisticsJobs()
    else if (status === 'all') jobs = await listAllLogisticsJobs()
    else if (status === 'history') jobs = await listLogisticsJobHistory()
    else if (status === 'in_progress') jobs = await listLogisticsJobsByStatus('in_transit')
    else if (status === 'picked_up') jobs = await listLogisticsJobsByStatus('picked_up')
    else if (status === 'in_transit') jobs = await listLogisticsJobsByStatus('in_transit')
    else jobs = await listLogisticsJobsByStatus(status)

    res.json({
      logistics_jobs: await Promise.all(jobs.map((job) => serializeJob(job))),
    })
  },
)

staffRouter.post(
  '/staff/logistics-jobs/:jobId/confirm-driver',
  permissionRequired('status_pickup', 'billing'),
  async (req: AuthRequest, res) => {
    const job = await getLogisticsJob(routeParam(req.params.jobId))
    if (!job) return res.status(404).json({ error: 'Local delivery request not found' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    const data = req.body ?? {}
    try {
      const updated = await confirmLogisticsDriver(job, actor, {
        driverName: data.driver_name || '',
        driverContactNumber: data.driver_contact_number || '',
      })
      res.json({ logistics_job: await serializeJob(updated) })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.post(
  '/staff/logistics-jobs/:jobId/picked-up',
  permissionRequired('status_pickup', 'billing'),
  async (req: AuthRequest, res) => {
    const job = await getLogisticsJob(routeParam(req.params.jobId))
    if (!job) return res.status(404).json({ error: 'Local delivery request not found' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const updated = await markLogisticsJobPickedUp(job, actor)
      res.json({ logistics_job: await serializeJob(updated) })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.post(
  '/staff/logistics-jobs/:jobId/in-transit',
  permissionRequired('status_pickup', 'billing'),
  async (req: AuthRequest, res) => {
    const job = await getLogisticsJob(routeParam(req.params.jobId))
    if (!job) return res.status(404).json({ error: 'Local delivery request not found' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const updated = await markLogisticsJobInTransit(job, actor)
      res.json({ logistics_job: await serializeJob(updated) })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.post(
  '/staff/logistics-jobs/:jobId/complete',
  permissionRequired('status_pickup', 'billing'),
  async (req: AuthRequest, res) => {
    const job = await getLogisticsJob(routeParam(req.params.jobId))
    if (!job) return res.status(404).json({ error: 'Local delivery request not found' })

    const actor = getUserFromJwt(req)
    if (!actor) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const updated = await completeLogisticsJob(job, actor)
      res.json({ logistics_job: await serializeJob(updated) })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)

staffRouter.post(
  '/staff/logistics-jobs/:jobId/cancel',
  permissionRequired('status_pickup', 'billing'),
  async (req: AuthRequest, res) => {
    const job = await getLogisticsJob(routeParam(req.params.jobId))
    if (!job) return res.status(404).json({ error: 'Local delivery request not found' })

    try {
      const updated = await cancelLogisticsJob(job, { byCustomer: false })
      res.json({ logistics_job: await serializeJob(updated) })
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
    }
  },
)
