import { and, count, desc, eq, gte, ilike, inArray, like, lt, ne, or, sql, sum } from 'drizzle-orm'
import {
  MULTI_PACKAGE_HANDLING_FEE_JMD,
  PAYMENT_ELIGIBLE_STATUS,
  PAYMENT_METHODS,
} from '../constants.js'
import {
  packages,
  paymentCheckoutItems,
  paymentCheckouts,
  users,
  type UserRow,
} from '../db/schema/index.js'
import { db } from '../db/index.js'
import {
  packagePaymentSummary as packagePaymentSummaryDict,
  paymentCheckoutToDict,
} from '../lib/serializers/payment.js'
import { inferOptionalDeliveryFeeJmd } from './deliveryFeeService.js'
import { resolveDeliveryRequestForPayment } from './deliveryRequestService.js'
import { addPackageEvent } from './packageService.js'

type PackageRow = typeof packages.$inferSelect
type CheckoutItemRow = typeof paymentCheckoutItems.$inferSelect
type CheckoutRow = typeof paymentCheckouts.$inferSelect

export type PackageCheckoutItemWithCheckout = CheckoutItemRow & {
  checkout: CheckoutRow | null
}

function decimal(value: unknown): number {
  return Math.round(parseFloat(String(value)) * 100) / 100
}

export async function generateInvoiceNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `PB-INV-${today}-`
  const rows = await db
    .select({ id: paymentCheckouts.id })
    .from(paymentCheckouts)
    .where(like(paymentCheckouts.invoiceNumber, `${prefix}%`))
  const count = rows.length + 1
  return `${prefix}${String(count).padStart(4, '0')}`
}

export async function getPackageCheckoutItem(
  pkg: PackageRow,
): Promise<PackageCheckoutItemWithCheckout | null> {
  const [item] = await db
    .select()
    .from(paymentCheckoutItems)
    .where(eq(paymentCheckoutItems.packageId, pkg.id))
    .limit(1)
  if (!item) return null

  const [checkout] = await db
    .select()
    .from(paymentCheckouts)
    .where(eq(paymentCheckouts.id, item.checkoutId))
    .limit(1)

  return { ...item, checkout: checkout ?? null }
}

export async function packagePaymentSummariesForPackages(
  pkgs: PackageRow[],
): Promise<Record<string, Record<string, unknown>>> {
  if (!pkgs.length) return {}

  const packageIds = pkgs.map((p) => p.id)
  const items = await db
    .select()
    .from(paymentCheckoutItems)
    .where(inArray(paymentCheckoutItems.packageId, packageIds))

  const summaries: Record<string, Record<string, unknown>> = {}
  for (const item of items) {
    const [checkout] = await db
      .select()
      .from(paymentCheckouts)
      .where(eq(paymentCheckouts.id, item.checkoutId))
      .limit(1)
    if (!checkout) continue

    let recordedBy: UserRow | null = null
    if (checkout.recordedById) {
      ;[recordedBy] = await db.select().from(users).where(eq(users.id, checkout.recordedById)).limit(1)
    }

    summaries[item.packageId] = packagePaymentSummaryDict(item, checkout, recordedBy ?? null)
  }
  return summaries
}

export async function packagePaymentSummary(
  pkg: PackageRow,
): Promise<Record<string, unknown> | null> {
  const item = await getPackageCheckoutItem(pkg)
  if (!item?.checkout) return null

  let recordedBy: UserRow | null = null
  if (item.checkout.recordedById) {
    ;[recordedBy] = await db.select().from(users).where(eq(users.id, item.checkout.recordedById)).limit(1)
  }

  return packagePaymentSummaryDict(item, item.checkout, recordedBy ?? null)
}

export async function listCustomerCheckouts(customer: UserRow, limit = 100): Promise<CheckoutRow[]> {
  return db
    .select()
    .from(paymentCheckouts)
    .where(eq(paymentCheckouts.customerId, customer.id))
    .orderBy(desc(paymentCheckouts.recordedAt))
    .limit(limit)
}

export async function listCustomerPackages(customer: UserRow, limit = 100): Promise<PackageRow[]> {
  return db
    .select()
    .from(packages)
    .where(and(eq(packages.customerId, customer.id), ne(packages.status, 'unidentified')))
    .orderBy(desc(packages.receivedAt), desc(packages.trackingNumber))
    .limit(limit)
}

export async function computeCustomerBillingSummary(pkgs: PackageRow[]) {
  let totalDueJmd = 0
  let readyCount = 0
  let paidCount = 0

  for (const pkg of pkgs) {
    if (
      pkg.status === PAYMENT_ELIGIBLE_STATUS &&
      pkg.billingStatus === 'ready' &&
      pkg.totalDueJmd != null
    ) {
      totalDueJmd += parseFloat(pkg.totalDueJmd)
      readyCount += 1
    } else if (pkg.billingStatus === 'paid') {
      paidCount += 1
    }
  }

  return {
    total_due_jmd: Math.round(totalDueJmd * 100) / 100,
    ready_count: readyCount,
    paid_count: paidCount,
    package_count: pkgs.length,
    currency: 'JMD',
  }
}

async function validateCheckoutPackages(
  customer: UserRow,
  packageIds: unknown[],
): Promise<PackageRow[]> {
  if (!packageIds.length) throw new Error('Select at least one package to checkout')
  if (packageIds.length > 50) throw new Error('Cannot checkout more than 50 packages at once')

  const pkgs: PackageRow[] = []
  const seen = new Set<string>()

  for (const rawId of packageIds) {
    const pid = String(rawId)
    if (seen.has(pid)) continue
    seen.add(pid)

    const [pkg] = await db
      .select()
      .from(packages)
      .where(and(eq(packages.id, pid), eq(packages.customerId, customer.id)))
      .limit(1)
    if (!pkg) throw new Error('One or more packages were not found for this customer')
    if (pkg.status !== PAYMENT_ELIGIBLE_STATUS) {
      throw new Error(`${pkg.trackingNumber} must be ready for pickup before payment`)
    }
    if (pkg.billingStatus !== 'ready') {
      throw new Error(`${pkg.trackingNumber} is not ready for payment (${pkg.billingStatus})`)
    }
    if (pkg.totalDueJmd == null) throw new Error(`${pkg.trackingNumber} has no bill amount`)
    if (await getPackageCheckoutItem(pkg)) {
      throw new Error(`${pkg.trackingNumber} is already paid`)
    }
    pkgs.push(pkg)
  }

  if (!pkgs.length) throw new Error('Select at least one package to checkout')
  return pkgs
}

export async function recordPaymentCheckout(
  customer: UserRow,
  packageIds: unknown[],
  opts: {
    method: string
    recordedBy: UserRow
    reference?: string | null
    notes?: string | null
    processingFeeJmd?: number | null
    includeDeliveryFee?: boolean
  },
): Promise<CheckoutRow> {
  if (!(PAYMENT_METHODS as readonly string[]).includes(opts.method)) {
    throw new Error('Invalid payment method')
  }

  const pkgs = await validateCheckoutPackages(customer, packageIds)
  let [deliveryRequest, deliveryFee] = await resolveDeliveryRequestForPayment(customer, pkgs)
  if (deliveryFee <= 0 && opts.includeDeliveryFee) {
    deliveryFee = await inferOptionalDeliveryFeeJmd(customer, pkgs)
  }

  let total = 0
  const lineAmounts: Array<[PackageRow, number]> = []

  for (const pkg of pkgs) {
    const amount = decimal(pkg.totalDueJmd)
    if (amount <= 0) throw new Error(`${pkg.trackingNumber} has an invalid bill amount`)
    total += amount
    lineAmounts.push([pkg, amount])
  }

  if (deliveryFee > 0) total += deliveryFee

  let processingFee = 0
  if (pkgs.length > 1) {
    if (opts.processingFeeJmd == null) {
      processingFee = parseFloat(MULTI_PACKAGE_HANDLING_FEE_JMD)
    } else {
      processingFee = decimal(opts.processingFeeJmd)
      if (processingFee < 0) throw new Error('Handling fee cannot be negative')
    }
  } else if (opts.processingFeeJmd != null) {
    processingFee = decimal(opts.processingFeeJmd)
    if (processingFee < 0) throw new Error('Handling fee cannot be negative')
  }
  if (processingFee > 0) total += processingFee

  const invoiceNumber = await generateInvoiceNumber()
  const methodLabel = opts.method.replace(/_/g, ' ')

  const [checkout] = await db
    .insert(paymentCheckouts)
    .values({
      customerId: customer.id,
      invoiceNumber,
      totalJmd: total.toFixed(2),
      method: opts.method,
      reference: (opts.reference ?? '').trim() || null,
      notes: (opts.notes ?? '').trim() || null,
      recordedById: opts.recordedBy.id,
      recordedAt: new Date(),
      deliveryRequestId: deliveryRequest?.id ?? null,
      deliveryFeeJmd: deliveryFee > 0 ? deliveryFee.toFixed(2) : null,
      processingFeeJmd: processingFee > 0 ? processingFee.toFixed(2) : null,
    })
    .returning()

  for (const [pkg, amount] of lineAmounts) {
    await db.insert(paymentCheckoutItems).values({
      checkoutId: checkout!.id,
      packageId: pkg.id,
      amountJmd: amount.toFixed(2),
    })
    // Persist paid on the row and keep the in-memory object in sync. addPackageEvent
    // for a same-status note must not rewrite billing columns (see warehousePackageService).
    pkg.billingStatus = 'paid'
    await db
      .update(packages)
      .set({ billingStatus: 'paid', updatedAt: sql`now()` })
      .where(eq(packages.id, pkg.id))
    await addPackageEvent(
      pkg,
      pkg.status,
      `Payment recorded (${methodLabel}) — invoice ${checkout!.invoiceNumber}`,
    )
  }

  const { autoConfirmOpenTransferProofs } = await import('./bankTransferProofService.js')
  await autoConfirmOpenTransferProofs(customer, opts.recordedBy)

  return checkout!
}

export async function recordPackagePayment(
  pkg: PackageRow,
  opts: {
    method: string
    recordedBy: UserRow
    reference?: string | null
    notes?: string | null
  },
): Promise<CheckoutRow> {
  const [customer] = await db.select().from(users).where(eq(users.id, pkg.customerId)).limit(1)
  if (!customer) throw new Error('Package customer not found')
  return recordPaymentCheckout(customer, [pkg.id], opts)
}

export async function getCheckoutItems(checkoutId: string): Promise<
  Array<{
    item: CheckoutItemRow
    pkg: PackageRow | null
  }>
> {
  const items = await db
    .select()
    .from(paymentCheckoutItems)
    .where(eq(paymentCheckoutItems.checkoutId, checkoutId))

  if (!items.length) return []

  const packageIds = [...new Set(items.map((item) => item.packageId))]
  const pkgs = await db.select().from(packages).where(inArray(packages.id, packageIds))
  const byId = new Map(pkgs.map((pkg) => [pkg.id, pkg]))

  return items.map((item) => ({ item, pkg: byId.get(item.packageId) ?? null }))
}

async function loadCheckoutItemsForCheckouts(
  checkoutIds: string[],
): Promise<Map<string, Array<{ item: CheckoutItemRow; pkg: PackageRow | null }>>> {
  const byCheckout = new Map<string, Array<{ item: CheckoutItemRow; pkg: PackageRow | null }>>()
  for (const id of checkoutIds) byCheckout.set(id, [])
  if (!checkoutIds.length) return byCheckout

  const items = await db
    .select()
    .from(paymentCheckoutItems)
    .where(inArray(paymentCheckoutItems.checkoutId, checkoutIds))

  const packageIds = [...new Set(items.map((item) => item.packageId))]
  const pkgs = packageIds.length
    ? await db.select().from(packages).where(inArray(packages.id, packageIds))
    : []
  const pkgById = new Map(pkgs.map((pkg) => [pkg.id, pkg]))

  for (const item of items) {
    const list = byCheckout.get(item.checkoutId)
    if (list) list.push({ item, pkg: pkgById.get(item.packageId) ?? null })
  }
  return byCheckout
}

export async function getCheckoutCustomer(customerId: string): Promise<UserRow | null> {
  const [customer] = await db.select().from(users).where(eq(users.id, customerId)).limit(1)
  return customer ?? null
}

export async function listAdminInvoices(opts: {
  dateFrom?: Date | null
  dateTo?: Date | null
  method?: string | null
  query?: string | null
  limit?: number
  offset?: number
}) {
  const limit = opts.limit ?? 25
  const offset = opts.offset ?? 0
  const filters = []
  if (opts.dateFrom) filters.push(gte(paymentCheckouts.recordedAt, opts.dateFrom))
  if (opts.dateTo) filters.push(lt(paymentCheckouts.recordedAt, opts.dateTo))
  if (opts.method) filters.push(eq(paymentCheckouts.method, opts.method))

  const needle = (opts.query || '').trim()
  if (needle) {
    const pattern = `%${needle}%`
    const customerRows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        or(
          ilike(users.shippingId, pattern),
          ilike(users.firstName, pattern),
          ilike(users.lastName, pattern),
          ilike(users.email, pattern),
          sql`concat(${users.firstName}, ' ', ${users.lastName}) ilike ${pattern}`,
        ),
      )
    const customerIds = customerRows.map((r) => r.id)
    const queryFilter =
      customerIds.length > 0
        ? or(ilike(paymentCheckouts.invoiceNumber, pattern), inArray(paymentCheckouts.customerId, customerIds))
        : ilike(paymentCheckouts.invoiceNumber, pattern)
    filters.push(queryFilter!)
  }

  const whereClause = filters.length ? and(...filters) : undefined

  const [agg] = await db
    .select({
      count: count(paymentCheckouts.id),
      totalJmd: sum(paymentCheckouts.totalJmd),
      deliveryJmd: sum(paymentCheckouts.deliveryFeeJmd),
      processingJmd: sum(paymentCheckouts.processingFeeJmd),
    })
    .from(paymentCheckouts)
    .where(whereClause)

  const rows = await db
    .select()
    .from(paymentCheckouts)
    .where(whereClause)
    .orderBy(desc(paymentCheckouts.recordedAt), desc(paymentCheckouts.id))
    .offset(offset)
    .limit(limit)

  // Batch-load relations (Flask selectinload equivalent) — avoids N+1 round-trips to Neon.
  const userIds = [
    ...new Set(
      rows.flatMap((checkout) =>
        [checkout.customerId, checkout.recordedById].filter((id): id is string => Boolean(id)),
      ),
    ),
  ]
  const userRows = userIds.length
    ? await db.select().from(users).where(inArray(users.id, userIds))
    : []
  const userById = new Map(userRows.map((user) => [user.id, user]))

  const itemsByCheckout = await loadCheckoutItemsForCheckouts(rows.map((checkout) => checkout.id))

  const invoices = rows.map((checkout) => {
    const items = itemsByCheckout.get(checkout.id) ?? []
    const customer = userById.get(checkout.customerId) ?? null
    const recordedBy = checkout.recordedById ? (userById.get(checkout.recordedById) ?? null) : null
    const data = paymentCheckoutToDict(checkout, {
      includeItems: true,
      items,
      recordedBy,
    })
    const delivery = checkout.deliveryFeeJmd != null ? parseFloat(checkout.deliveryFeeJmd) : 0
    const processing = checkout.processingFeeJmd != null ? parseFloat(checkout.processingFeeJmd) : 0
    const total = parseFloat(checkout.totalJmd)
    data.packages_jmd = Math.round((total - delivery - processing) * 100) / 100
    if (customer) {
      data.customer_name = `${customer.firstName} ${customer.lastName}`.trim()
      data.shipping_id = customer.shippingId
    }
    return data
  })

  const total = parseFloat(String(agg?.totalJmd ?? 0))
  const delivery = parseFloat(String(agg?.deliveryJmd ?? 0))
  const processing = parseFloat(String(agg?.processingJmd ?? 0))
  const totalCount = Number(agg?.count ?? 0)

  return {
    invoices,
    summary: {
      count: totalCount,
      total_jmd: total,
      packages_jmd: Math.round((total - delivery - processing) * 100) / 100,
      delivery_fee_jmd: delivery,
      processing_fee_jmd: processing,
    },
    total: totalCount,
    limit,
    offset,
  }
}
