import { PRE_ALERT_STATUS_LABELS, SHIPPER_LABELS } from '../../constants.js'
import type { preAlerts } from '../../db/schema/index.js'
import { utcIsoformat } from '../dates.js'
import { resolveStoredUrl } from '../../services/imageUploadService.js'

type PreAlertRow = typeof preAlerts.$inferSelect

export function preAlertToDict(alert: PreAlertRow): Record<string, unknown> {
  const merchant = alert.merchant
  return {
    id: alert.id,
    carrier_tracking: alert.carrierTracking,
    merchant,
    merchant_label: merchant ? (SHIPPER_LABELS[merchant] ?? merchant) : null,
    description: alert.description,
    declared_value_usd: alert.declaredValueUsd != null ? parseFloat(alert.declaredValueUsd) : null,
    invoice_object_key: alert.invoiceObjectKey,
    invoice_url: alert.invoiceObjectKey ? resolveStoredUrl(alert.invoiceObjectKey) : null,
    status: alert.status,
    status_label: PRE_ALERT_STATUS_LABELS[alert.status] ?? alert.status,
    package_id: alert.packageId,
    created_at: utcIsoformat(alert.createdAt),
    updated_at: utcIsoformat(alert.updatedAt),
  }
}
