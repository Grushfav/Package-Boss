/**
 * Repair packages that have a checkout line item but billing_status was left as ready
 * (bug: addPackageEvent overwrote paid with stale in-memory status).
 */
import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { packages, paymentCheckoutItems } from '../src/db/schema/index.js'

async function main() {
  const items = await db.select().from(paymentCheckoutItems)
  if (!items.length) {
    console.log(JSON.stringify({ repaired: 0 }))
    process.exit(0)
  }

  const packageIds = [...new Set(items.map((i) => i.packageId))]
  const stuck = await db
    .select({
      id: packages.id,
      tracking: packages.trackingNumber,
      billingStatus: packages.billingStatus,
      status: packages.status,
    })
    .from(packages)
    .where(inArray(packages.id, packageIds))

  const toFix = stuck.filter((p) => p.billingStatus !== 'paid')
  if (!toFix.length) {
    console.log(JSON.stringify({ repaired: 0, checked: stuck.length }))
    process.exit(0)
  }

  await db
    .update(packages)
    .set({ billingStatus: 'paid', updatedAt: new Date() })
    .where(
      inArray(
        packages.id,
        toFix.map((p) => p.id),
      ),
    )

  console.log(
    JSON.stringify(
      {
        repaired: toFix.length,
        packages: toFix.map((p) => ({
          tracking: p.tracking,
          was: p.billingStatus,
          status: p.status,
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
