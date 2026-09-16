import { SHIPMENT_STATUS_LABELS } from '../../constants.js'
import type { packages, shipments } from '../../db/schema/index.js'
import { utcIsoformat } from '../dates.js'
import { warehousePackageToDict } from './package.js'

type ShipmentRow = typeof shipments.$inferSelect
type PackageRow = typeof packages.$inferSelect

export function shipmentToDict(
  shipment: ShipmentRow,
  opts: {
    includePackages?: boolean
    packages?: PackageRow[]
    packageOpts?: Map<string, Parameters<typeof warehousePackageToDict>[1]>
    createdByName?: string | null
  } = {},
): Record<string, unknown> {
  const pkgs = opts.packages ?? []
  let totalWeight = 0
  for (const p of pkgs) {
    if (p.actualWeightLbs != null) totalWeight += parseFloat(p.actualWeightLbs)
  }

  const data: Record<string, unknown> = {
    id: shipment.id,
    reference: shipment.reference,
    departure_date: shipment.departureDate,
    status: shipment.status,
    status_label: SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status,
    note: shipment.note,
    created_by_id: shipment.createdById,
    created_by_name: opts.createdByName ?? null,
    departed_at: utcIsoformat(shipment.departedAt),
    package_count: pkgs.length,
    total_weight_lbs: Math.round(totalWeight * 100) / 100,
    created_at: utcIsoformat(shipment.createdAt),
    updated_at: utcIsoformat(shipment.updatedAt),
  }

  if (opts.includePackages) {
    data.packages = pkgs.map((p) => warehousePackageToDict(p, opts.packageOpts?.get(p.id)))
  }
  return data
}
