import { like } from 'drizzle-orm'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { users } from '../db/schema/index.js'

export async function generateShippingId(): Promise<string> {
  const start = config.bossIdSeqStart
  const rows = await db.select({ shippingId: users.shippingId }).from(users).where(like(users.shippingId, 'BOSS-%'))
  let maxSeq = start - 1
  for (const row of rows) {
    const match = /^BOSS-(\d+)$/.exec(row.shippingId)
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1]!, 10))
  }
  return `BOSS-${String(maxSeq + 1).padStart(5, '0')}`
}
