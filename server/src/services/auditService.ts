import { db } from '../db/index.js'
import { auditLogs } from '../db/schema/index.js'
import type { UserRow } from '../db/schema/index.js'
import { userFullName } from '../lib/user.js'

export const ACTION_PACKAGE_RECEIVED = 'package.received'
export const ACTION_PACKAGE_RECEIVED_UNIDENTIFIED = 'package.received_unidentified'
export const ACTION_PACKAGE_ASSIGNED = 'package.assigned'
export const ACTION_PACKAGE_UNASSIGNED = 'package.unassigned'
export const ACTION_PACKAGE_STATUS_UPDATED = 'package.status_updated'
export const ACTION_PACKAGE_INVOICE_REQUESTED = 'package.invoice_requested'
export const ACTION_PACKAGE_BILLING_UPDATED = 'package.billing_updated'
export const ACTION_PACKAGE_LABEL_UPDATED = 'package.label_updated'
export const ACTION_PACKAGE_PAYMENT_RECORDED = 'package.payment_recorded'
export const ACTION_SHIPMENT_CREATED = 'shipment.created'
export const ACTION_SHIPMENT_PACKAGE_ADDED = 'shipment.package_added'
export const ACTION_SHIPMENT_PACKAGE_REMOVED = 'shipment.package_removed'
export const ACTION_SHIPMENT_DEPARTED = 'shipment.departed'

export async function logPackageAction(
  actor: UserRow | null,
  action: string,
  packageId: string,
  summary: string,
  metadata?: Record<string, unknown>,
) {
  if (actor && actor.role !== 'clerk' && actor.role !== 'admin') {
    throw new Error('Only clerk or admin actions are logged here')
  }

  const [entry] = await db
    .insert(auditLogs)
    .values({
      actorId: actor?.id ?? null,
      actorName: actor ? userFullName(actor) : 'System',
      actorRole: actor?.role ?? 'system',
      action,
      entityType: 'package',
      entityId: packageId,
      summary,
      metadataJson: metadata ?? {},
    })
    .returning()

  return entry
}

export async function logEntityAction(
  actor: UserRow | null,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  metadata?: Record<string, unknown>,
) {
  if (actor && actor.role !== 'clerk' && actor.role !== 'admin') {
    throw new Error('Only clerk or admin actions are logged here')
  }

  const [entry] = await db
    .insert(auditLogs)
    .values({
      actorId: actor?.id ?? null,
      actorName: actor ? userFullName(actor) : 'System',
      actorRole: actor?.role ?? 'system',
      action,
      entityType,
      entityId,
      summary,
      metadataJson: metadata ?? {},
    })
    .returning()

  return entry
}
