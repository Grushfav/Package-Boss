/**
 * Remove delivery_request_packages rows for cancelled requests so packages
 * can be requested again (unique package_id constraint).
 */
import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { deliveryRequestPackages, deliveryRequests } from '../src/db/schema/index.js'

async function main() {
  const cancelled = await db
    .select({ id: deliveryRequests.id })
    .from(deliveryRequests)
    .where(eq(deliveryRequests.status, 'cancelled'))

  if (!cancelled.length) {
    console.log(JSON.stringify({ deleted: 0, cancelled_requests: 0 }))
    process.exit(0)
  }

  const ids = cancelled.map((r) => r.id)
  const deleted = await db
    .delete(deliveryRequestPackages)
    .where(inArray(deliveryRequestPackages.deliveryRequestId, ids))
    .returning({ id: deliveryRequestPackages.id, packageId: deliveryRequestPackages.packageId })

  console.log(
    JSON.stringify(
      {
        cancelled_requests: ids.length,
        deleted: deleted.length,
        package_ids: deleted.map((d) => d.packageId),
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
