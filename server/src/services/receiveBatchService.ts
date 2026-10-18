import { and, desc, eq, like } from 'drizzle-orm'

import { db } from '../db/index.js'
import { packages, receiveBatches } from '../db/schema/index.js'
import type { packages as packagesTable, receiveBatches as receiveBatchesTable } from '../db/schema/index.js'
import type { UserRow } from '../db/schema/index.js'
import { receiveBatchToDict } from '../lib/serializers/receiveBatch.js'

type PackageRow = typeof packagesTable.$inferSelect
type ReceiveBatchRow = typeof receiveBatchesTable.$inferSelect

function nextBatchCode(receiveDate: string): string {
  const prefix = receiveDate.slice(5, 7) + receiveDate.slice(8, 10)
  return `RB-${prefix}-01`
}

export async function createReceiveBatch(options: {
  reference?: string | null
  receiveDate?: string | null
  note?: string | null
  createdBy?: UserRow | null
}): Promise<ReceiveBatchRow> {
  const receiveDate = options.receiveDate ?? new Date().toISOString().slice(0, 10)
  const pattern = `RB-${receiveDate.slice(5, 7)}${receiveDate.slice(8, 10)}-%`
  const existing = await db
    .select()
    .from(receiveBatches)
    .where(like(receiveBatches.batchCode, pattern))

  const batchCode =
    existing.length > 0
      ? `RB-${receiveDate.slice(5, 7)}${receiveDate.slice(8, 10)}-${String(existing.length + 1).padStart(2, '0')}`
      : nextBatchCode(receiveDate)

  const label = (options.reference ?? '').trim() || batchCode

  const now = new Date()
  const [batch] = await db
    .insert(receiveBatches)
    .values({
      id: crypto.randomUUID(),
      batchCode,
      reference: label,
      receiveDate,
      status: 'open',
      note: options.note?.trim() || null,
      createdById: options.createdBy?.id ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return batch
}

export async function listReceiveBatches(options?: {
  status?: string | null
  limit?: number
  offset?: number
}): Promise<[ReceiveBatchRow[], number]> {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let rows = await db.select().from(receiveBatches).orderBy(desc(receiveBatches.receiveDate), desc(receiveBatches.createdAt))

  if (options?.status) {
    rows = rows.filter((b) => b.status === options.status)
  }

  const total = rows.length
  return [rows.slice(offset, offset + limit), total]
}

export async function getReceiveBatch(batchId: string): Promise<ReceiveBatchRow | null> {
  const [batch] = await db.select().from(receiveBatches).where(eq(receiveBatches.id, batchId)).limit(1)
  return batch ?? null
}

export function assertOpenReceiveBatch(batch: ReceiveBatchRow): void {
  if (batch.status !== 'open') {
    throw new Error(`Receive batch ${batch.batchCode} is closed`)
  }
}

export function assignPackageToReceiveBatch(pkg: PackageRow, batch: ReceiveBatchRow): void {
  assertOpenReceiveBatch(batch)
  ;(pkg as { receiveBatchId?: string | null }).receiveBatchId = batch.id
  ;(pkg as { updatedAt?: Date }).updatedAt = new Date()
}

export async function resolveReceiveBatchId(rawId: string | null | undefined): Promise<ReceiveBatchRow | null> {
  if (!rawId) return null
  const batch = await getReceiveBatch(rawId)
  if (!batch) throw new Error('Receive batch not found')
  assertOpenReceiveBatch(batch)
  return batch
}

export { receiveBatchToDict }
