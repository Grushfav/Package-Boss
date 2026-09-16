import { like } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema/index.js'

export async function generateStaffShippingId(): Promise<string> {
  const rows = await db
    .select({ shippingId: users.shippingId })
    .from(users)
    .where(like(users.shippingId, 'STAFF-%'))

  let maxSeq = 0
  for (const row of rows) {
    const match = /^STAFF-(\d+)$/.exec(row.shippingId)
    if (match) {
      maxSeq = Math.max(maxSeq, parseInt(match[1]!, 10))
    }
  }
  return `STAFF-${String(maxSeq + 1).padStart(5, '0')}`
}
