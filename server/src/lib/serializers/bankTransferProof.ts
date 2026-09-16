import { BANK_TRANSFER_PROOF_STATUS_LABELS, DELIVERY_FEE_JMD, SENDER_BANK_LABELS } from '../../constants.js'
import type {
  bankTransferProofPackages,
  bankTransferProofs,
  packages,
  users,
} from '../../db/schema/index.js'
import { utcIsoformat } from '../dates.js'
import { resolveStoredUrl } from '../../services/imageUploadService.js'
import { userFullName } from './user.js'

type ProofRow = typeof bankTransferProofs.$inferSelect
type ProofPackageRow = typeof bankTransferProofPackages.$inferSelect
type PackageRow = typeof packages.$inferSelect
type UserRow = typeof users.$inferSelect

export function proofIncludesDelivery(
  proof: ProofRow,
  packageLinks: Array<{ pkg?: PackageRow | null }>,
): boolean {
  if (proof.includeDeliveryFee) return true
  if (proof.amountJmd == null || !packageLinks.length) return false
  let packagesTotal = 0
  for (const { pkg } of packageLinks) {
    if (pkg?.totalDueJmd != null) packagesTotal += parseFloat(pkg.totalDueJmd)
  }
  if (packagesTotal <= 0) return false
  const amount = parseFloat(proof.amountJmd)
  const expectedWithDelivery = packagesTotal + parseFloat(DELIVERY_FEE_JMD)
  return amount >= expectedWithDelivery - 0.01
}

export function bankTransferProofPackageToDict(
  link: ProofPackageRow,
  pkg?: PackageRow | null,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: link.id,
    proof_id: link.proofId,
    package_id: link.packageId,
  }
  if (pkg) {
    data.tracking_number = pkg.trackingNumber
    data.total_due_jmd = pkg.totalDueJmd != null ? parseFloat(pkg.totalDueJmd) : null
  }
  return data
}

export function bankTransferProofToDict(
  proof: ProofRow,
  opts: {
    includePackages?: boolean
    packageLinks?: Array<{ link: ProofPackageRow; pkg?: PackageRow | null }>
    reviewedBy?: UserRow | null
  } = {},
): Record<string, unknown> {
  const links = opts.packageLinks ?? []
  const data: Record<string, unknown> = {
    id: proof.id,
    customer_id: proof.customerId,
    proof_object_key: proof.proofObjectKey,
    proof_url: resolveStoredUrl(proof.proofObjectKey),
    transfer_reference: proof.transferReference,
    sender_bank: proof.senderBank,
    sender_bank_label: proof.senderBank ? (SENDER_BANK_LABELS[proof.senderBank] ?? proof.senderBank) : null,
    amount_jmd: proof.amountJmd != null ? parseFloat(proof.amountJmd) : null,
    include_delivery_fee: Boolean(proof.includeDeliveryFee),
    includes_delivery: proofIncludesDelivery(proof, links),
    notes: proof.notes,
    status: proof.status,
    status_label: BANK_TRANSFER_PROOF_STATUS_LABELS[proof.status] ?? proof.status,
    submitted_at: utcIsoformat(proof.submittedAt),
    reviewed_at: utcIsoformat(proof.reviewedAt),
    reviewed_by_name: opts.reviewedBy ? userFullName(opts.reviewedBy) : null,
  }
  if (opts.includePackages) {
    data.packages = links.map(({ link, pkg }) => bankTransferProofPackageToDict(link, pkg))
  } else {
    data.package_count = links.length
  }
  return data
}
