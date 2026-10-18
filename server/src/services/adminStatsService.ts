import { and, count, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm'
import {
  BANK_TRANSFER_PROOF_OPEN_STATUSES,
  DELIVERY_REQUEST_OPEN_STATUSES,
  LOGISTICS_JOB_OPEN_STATUSES,
  STATUS_LABELS,
  UNIDENTIFIED_HOLDER_SHIPPING_ID,
} from '../constants.js'
import { db } from '../db/index.js'
import {
  bankTransferProofs,
  deliveryRequests,
  logisticsJobs,
  packages,
  preAlerts,
  users,
} from '../db/schema/index.js'

function utcNow(): Date {
  return new Date()
}

function startOfDay(dt: Date): Date {
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()))
}

function customerSignupsFilter() {
  return and(eq(users.role, 'customer'), sql`${users.shippingId} != ${UNIDENTIFIED_HOLDER_SHIPPING_ID}`)
}

export async function getCustomerSignupStats() {
  const now = utcNow()
  const todayStart = startOfDay(now)
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const base = customerSignupsFilter()

  const [customersToday] = await db
    .select({ value: count() })
    .from(users)
    .where(and(base, gte(users.createdAt, todayStart)))

  const [customers7d] = await db
    .select({ value: count() })
    .from(users)
    .where(and(base, gte(users.createdAt, weekStart)))

  const [customersTotal] = await db.select({ value: count() }).from(users).where(base)

  return {
    customers_today: customersToday?.value ?? 0,
    customers_7d: customers7d?.value ?? 0,
    customers_total: customersTotal?.value ?? 0,
  }
}

export async function getDeliveryRequestSubmissionStats() {
  const now = utcNow()
  const todayStart = startOfDay(now)
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [active] = await db
    .select({ value: count() })
    .from(deliveryRequests)
    .where(inArray(deliveryRequests.status, [...DELIVERY_REQUEST_OPEN_STATUSES]))

  const [today] = await db
    .select({ value: count() })
    .from(deliveryRequests)
    .where(gte(deliveryRequests.requestedAt, todayStart))

  const [week] = await db
    .select({ value: count() })
    .from(deliveryRequests)
    .where(gte(deliveryRequests.requestedAt, weekStart))

  const [total] = await db.select({ value: count() }).from(deliveryRequests)

  return {
    delivery_requests_active: active?.value ?? 0,
    delivery_requests_today: today?.value ?? 0,
    delivery_requests_7d: week?.value ?? 0,
    delivery_requests_total: total?.value ?? 0,
  }
}

export async function getLogisticsJobSubmissionStats() {
  const now = utcNow()
  const todayStart = startOfDay(now)
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [active] = await db
    .select({ value: count() })
    .from(logisticsJobs)
    .where(inArray(logisticsJobs.status, [...LOGISTICS_JOB_OPEN_STATUSES]))

  const [today] = await db
    .select({ value: count() })
    .from(logisticsJobs)
    .where(gte(logisticsJobs.requestedAt, todayStart))

  const [week] = await db
    .select({ value: count() })
    .from(logisticsJobs)
    .where(gte(logisticsJobs.requestedAt, weekStart))

  const [total] = await db.select({ value: count() }).from(logisticsJobs)

  return {
    logistics_jobs_active: active?.value ?? 0,
    logistics_jobs_today: today?.value ?? 0,
    logistics_jobs_7d: week?.value ?? 0,
    logistics_jobs_total: total?.value ?? 0,
  }
}

export async function getBankTransferProofSubmissionStats() {
  const now = utcNow()
  const todayStart = startOfDay(now)
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [active] = await db
    .select({ value: count() })
    .from(bankTransferProofs)
    .where(inArray(bankTransferProofs.status, [...BANK_TRANSFER_PROOF_OPEN_STATUSES]))

  const [today] = await db
    .select({ value: count() })
    .from(bankTransferProofs)
    .where(gte(bankTransferProofs.submittedAt, todayStart))

  const [week] = await db
    .select({ value: count() })
    .from(bankTransferProofs)
    .where(gte(bankTransferProofs.submittedAt, weekStart))

  const [total] = await db.select({ value: count() }).from(bankTransferProofs)

  return {
    bank_transfer_proofs_active: active?.value ?? 0,
    bank_transfer_proofs_today: today?.value ?? 0,
    bank_transfer_proofs_7d: week?.value ?? 0,
    bank_transfer_proofs_total: total?.value ?? 0,
  }
}

export async function getOverview() {
  const now = utcNow()
  const todayStart = startOfDay(now)
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [packagesToday] = await db
    .select({ value: count() })
    .from(packages)
    .where(gte(packages.receivedAt, todayStart))

  const [packages7d] = await db
    .select({ value: count() })
    .from(packages)
    .where(gte(packages.receivedAt, weekStart))

  const [packages30d] = await db
    .select({ value: count() })
    .from(packages)
    .where(gte(packages.receivedAt, monthStart))

  const [pendingPreAlerts] = await db
    .select({ value: count() })
    .from(preAlerts)
    .where(eq(preAlerts.status, 'pending'))

  const [inTransit] = await db
    .select({ value: count() })
    .from(packages)
    .where(eq(packages.status, 'in_transit'))

  const customerStats = await getCustomerSignupStats()
  const deliveryRequestStats = await getDeliveryRequestSubmissionStats()
  const logisticsJobStats = await getLogisticsJobSubmissionStats()
  const bankTransferProofStats = await getBankTransferProofSubmissionStats()

  const [revenueRow] = await db
    .select({
      total: sql<string>`coalesce(sum(case when ${packages.billingStatus} in ('ready', 'paid') then ${packages.totalDueJmd} else ${packages.estimatedFreightJmd} end), 0)`,
    })
    .from(packages)
    .where(gte(packages.receivedAt, monthStart))

  const revenue = parseFloat(revenueRow?.total ?? '0')

  return {
    packages_today: packagesToday?.value ?? 0,
    packages_7d: packages7d?.value ?? 0,
    packages_30d: packages30d?.value ?? 0,
    pending_pre_alerts: pendingPreAlerts?.value ?? 0,
    in_transit: inTransit?.value ?? 0,
    ...customerStats,
    ...deliveryRequestStats,
    ...logisticsJobStats,
    ...bankTransferProofStats,
    revenue_30d_jmd: revenue,
    revenue_30d_usd: revenue,
  }
}

export async function getPackagesTimeline(days = 30) {
  const now = utcNow()
  const start = new Date(startOfDay(now).getTime() - (days - 1) * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      day: sql<string>`date(${packages.receivedAt})`.as('day'),
      count: count(),
    })
    .from(packages)
    .where(gte(packages.receivedAt, start))
    .groupBy(sql`date(${packages.receivedAt})`)
    .orderBy(sql`date(${packages.receivedAt})`)

  const countsByDay = Object.fromEntries(rows.map((r) => [r.day, r.count]))
  const timeline = []
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    const key = day.toISOString().slice(0, 10)
    timeline.push({ date: key, count: countsByDay[key] ?? 0 })
  }
  return timeline
}

export async function getPackagesByStatus() {
  const rows = await db
    .select({ status: packages.status, count: count() })
    .from(packages)
    .groupBy(packages.status)

  return rows.map(({ status, count: c }) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    count: c,
  }))
}

export async function getWeightDistribution() {
  const pkgs = await db
    .select({ weight: packages.billableWeightLbs })
    .from(packages)
    .where(isNotNull(packages.billableWeightLbs))

  const buckets = [
    { label: '1–5 lbs', min: 1, max: 5, count: 0 },
    { label: '6–10 lbs', min: 6, max: 10, count: 0 },
    { label: '11–20 lbs', min: 11, max: 20, count: 0 },
    { label: '21–50 lbs', min: 21, max: 50, count: 0 },
    { label: '51+ lbs', min: 51, max: 9999, count: 0 },
  ]

  for (const pkg of pkgs) {
    const w = pkg.weight ?? 0
    for (const bucket of buckets) {
      if (w >= bucket.min && w <= bucket.max) {
        bucket.count += 1
        break
      }
    }
  }

  return buckets.map(({ label, count: c }) => ({ label, count: c }))
}

export async function getPreAlertsVsReceives(days = 30) {
  const now = utcNow()
  const start = new Date(startOfDay(now).getTime() - (days - 1) * 24 * 60 * 60 * 1000)

  const alertRows = await db
    .select({
      day: sql<string>`date(${preAlerts.createdAt})`.as('day'),
      count: count(),
    })
    .from(preAlerts)
    .where(gte(preAlerts.createdAt, start))
    .groupBy(sql`date(${preAlerts.createdAt})`)

  const packageRows = await db
    .select({
      day: sql<string>`date(${packages.receivedAt})`.as('day'),
      count: count(),
    })
    .from(packages)
    .where(gte(packages.receivedAt, start))
    .groupBy(sql`date(${packages.receivedAt})`)

  const alertsByDay = Object.fromEntries(alertRows.map((r) => [r.day, r.count]))
  const receivesByDay = Object.fromEntries(packageRows.map((r) => [r.day, r.count]))

  const series = []
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    const key = day.toISOString().slice(0, 10)
    series.push({
      date: key,
      pre_alerts: alertsByDay[key] ?? 0,
      received: receivesByDay[key] ?? 0,
    })
  }
  return series
}
