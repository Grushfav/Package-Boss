import { utcIsoformat } from './dates.js'
import type { auditLogs } from '../db/schema/index.js'

type AuditLogRow = typeof auditLogs.$inferSelect

export function auditLogToDict(row: AuditLogRow) {
  return {
    id: row.id,
    actor_id: row.actorId,
    actor_name: row.actorName,
    actor_role: row.actorRole,
    action: row.action,
    entity_type: row.entityType,
    entity_id: row.entityId,
    summary: row.summary,
    metadata: row.metadataJson ?? {},
    created_at: utcIsoformat(row.createdAt),
  }
}
