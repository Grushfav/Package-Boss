import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import {
  packages,
  paymentCheckoutItems,
  paymentCheckouts,
  users,
} from '../src/db/schema/index.js'

async function main() {
  const trackings = [
    'PB-2026-000008',
    'PB-2026-000007',
    'PB-2026-000006',
    'PB-2026-000005',
    'PB-2026-000004',
  ]

  const byTracking = await db
    .select()
    .from(packages)
    .where(inArray(packages.trackingNumber, trackings))

  const packageIds = byTracking.map((p) => p.id)
  const items = packageIds.length
    ? await db
        .select()
        .from(paymentCheckoutItems)
        .where(inArray(paymentCheckoutItems.packageId, packageIds))
    : []

  const checkoutIds = [...new Set(items.map((i) => i.checkoutId))]
  const checkouts = checkoutIds.length
    ? await db.select().from(paymentCheckouts).where(inArray(paymentCheckouts.id, checkoutIds))
    : []

  const [customer] = byTracking[0]
    ? await db.select().from(users).where(eq(users.id, byTracking[0].customerId)).limit(1)
    : [null]

  let allCheckouts: Array<typeof paymentCheckouts.$inferSelect> = []
  if (customer) {
    allCheckouts = await db
      .select()
      .from(paymentCheckouts)
      .where(eq(paymentCheckouts.customerId, customer.id))
      .orderBy(desc(paymentCheckouts.recordedAt))
      .limit(5)
  }

  console.log(
    JSON.stringify(
      {
        customer: customer
          ? { id: customer.id, email: customer.email, shippingId: customer.shippingId }
          : null,
        packages: byTracking.map((p) => ({
          id: p.id,
          tracking: p.trackingNumber,
          status: p.status,
          billingStatus: p.billingStatus,
          totalDue: p.totalDueJmd,
        })),
        checkoutItems: items,
        relatedCheckouts: checkouts.map((c) => ({
          id: c.id,
          invoice: c.invoiceNumber,
          total: c.totalJmd,
          method: c.method,
          recordedAt: c.recordedAt,
        })),
        customerCheckouts: allCheckouts.map((c) => ({
          id: c.id,
          invoice: c.invoiceNumber,
          total: c.totalJmd,
          method: c.method,
          recordedAt: c.recordedAt,
        })),
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
