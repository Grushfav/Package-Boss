import { RECEIVE_BATCH_STATUS_LABELS } from '../../constants.js'
import type { receiveBatches } from '../../db/schema/index.js'
import { utcIsoformat } from '../dates.js'

type ReceiveBatchRow = typeof receiveBatches.$inferSelect

export function receiveBatchToDict(
  batch: ReceiveBatchRow,
  opts: { packageCount?: number; createdByName?: string | null } = {},
): Record<string, unknown> {
  return {
    id: batch.id,
    batch_code: batch.batchCode,
    reference: batch.reference,
    receive_date: batch.receiveDate,
    status: batch.status,
    status_label: RECEIVE_BATCH_STATUS_LABELS[batch.status] ?? batch.status,
    note: batch.note,
    created_by_id: batch.createdById,
    created_by_name: opts.createdByName ?? null,
    closed_at: utcIsoformat(batch.closedAt),
    package_count: opts.packageCount ?? 0,
    created_at: utcIsoformat(batch.createdAt),
    updated_at: utcIsoformat(batch.updatedAt),
  }
}
