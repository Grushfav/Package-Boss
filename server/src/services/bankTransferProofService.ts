import { and, asc, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import {
  BANK_TRANSFER_PROOF_OPEN_STATUSES,
  DELIVERY_FEE_JMD,
  PAYMENT_ELIGIBLE_STATUS,
  SENDER_BANKS,
} from '../constants.js'
import { db } from '../db/index.js'
import {
  bankTransferProofPackages,
  bankTransferProofs,
  packages,
  users,
  type UserRow,
} from '../db/schema/index.js'
import { bankTransferProofToDict } from '../lib/serializers/bankTransferProof.js'
import { userFullName } from '../lib/serializers/user.js'
import { computePaymentTotalWithDelivery } from './deliveryRequestService.js'
import { isValidTransferProofReference } from './imageUploadService.js'
import { recordPaymentCheckout } from './paymentService.js'

type ProofRow = typeof bankTransferProofs.$inferSelect

async function loadProofDetails(proofId: string) {
  const [proof] = await db.select().from(bankTransferProofs).where(eq(bankTransferProofs.id, proofId)).limit(1)
  if (!proof) return null

  const links = await db
    .select()
    .from(bankTransferProofPackages)
    .where(eq(bankTransferProofPackages.proofId, proof.id))

  const packageLinks = []
  for (const link of links) {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, link.packageId)).limit(1)
    packageLinks.push({ link, pkg: pkg ?? null })
  }

  let reviewedBy = null
  if (proof.reviewedById) {
    ;[reviewedBy] = await db.select().from(users).where(eq(users.id, proof.reviewedById)).limit(1)
  }

  return { proof, packageLinks, reviewedBy: reviewedBy ?? null }
}

export async function countOpenTransferProofs(): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(bankTransferProofs)
    .where(inArray(bankTransferProofs.status, [...BANK_TRANSFER_PROOF_OPEN_STATUSES]))
  return Number(rows[0]?.value ?? 0)
}

export async function listCustomerProofs(customer: UserRow, limit = 50) {
  const rows = await db
    .select()
    .from(bankTransferProofs)
    .where(eq(bankTransferProofs.customerId, customer.id))
    .orderBy(desc(bankTransferProofs.submittedAt))
    .limit(limit)

  const result = []
  for (const proof of rows) {
    const details = await loadProofDetails(proof.id)
    if (!details) continue
    result.push(
      bankTransferProofToDict(details.proof, {
        includePackages: true,
        packageLinks: details.packageLinks,
        reviewedBy: details.reviewedBy,
      }),
    )
  }
  return result
}

async function validateProofPackages(customer: UserRow, packageIds: unknown[]) {
  if (!packageIds.length) return []

  if (packageIds.length > 50) throw new Error('Cannot link more than 50 packages to one transfer proof')

  const pkgs: Array<typeof packages.$inferSelect> = []
  const seen = new Set<string>()

  for (const rawId of packageIds) {
    const pid = String(rawId)
    if (seen.has(pid)) continue
    seen.add(pid)

    const [pkg] = await db
      .select()
      .from(packages)
      .where(eq(packages.id, pid))
      .limit(1)
    if (!pkg || pkg.customerId !== customer.id) {
      throw new Error('One or more packages were not found on your account')
    }
    if (pkg.billingStatus === 'paid') throw new Error(`${pkg.trackingNumber} is already paid`)
    if (pkg.status !== PAYMENT_ELIGIBLE_STATUS || pkg.billingStatus !== 'ready') {
      throw new Error(`${pkg.trackingNumber} is not ready for payment yet`)
    }
    pkgs.push(pkg)
  }
  return pkgs
}

async function expectedProofTotal(
  customer: UserRow,
  pkgs: Array<typeof packages.$inferSelect>,
  includeDeliveryFee: boolean,
): Promise<number> {
  const expected = await computePaymentTotalWithDelivery(
    customer,
    pkgs.map((p) => p.id),
  )
  let total = expected.total_jmd
  if (includeDeliveryFee && expected.delivery_fee_jmd === 0) {
    total += parseFloat(DELIVERY_FEE_JMD)
  }
  return Math.round(total * 100) / 100
}

export async function submitBankTransferProof(
  customer: UserRow,
  opts: {
    proofObjectKey: string
    packageIds?: unknown[]
    transferReference?: string | null
    senderBank?: string | null
    amountJmd?: unknown
    includeDeliveryFee?: boolean
    notes?: string | null
  },
) {
  const proofKey = (opts.proofObjectKey ?? '').trim()
  if (!proofKey) throw new Error('proof_object_key is required')
  if (!isValidTransferProofReference(proofKey)) throw new Error('Invalid transfer proof file reference')

  const pkgs = await validateProofPackages(customer, opts.packageIds ?? [])

  let amount: number | null =
    opts.amountJmd != null ? Math.round(parseFloat(String(opts.amountJmd)) * 100) / 100 : null
  if (amount != null && amount <= 0) throw new Error('amount_jmd must be greater than zero')

  if (pkgs.length) {
    const expectedTotal = await expectedProofTotal(customer, pkgs, Boolean(opts.includeDeliveryFee))
    if (amount == null) amount = expectedTotal
    else if (amount !== expectedTotal) {
      throw new Error(
        `amount_jmd must match the total due (${expectedTotal.toFixed(2)} JMD including delivery fee if applicable)`,
      )
    }
  }

  const reference = (opts.transferReference ?? '').trim() || null
  const bank = (opts.senderBank ?? '').trim().toLowerCase() || null
  if (!bank) throw new Error('sender_bank is required')
  if (!(SENDER_BANKS as readonly string[]).includes(bank)) throw new Error('Invalid sender bank')

  const noteText = (opts.notes ?? '').trim() || null
  if (noteText && noteText.length > 500) throw new Error('notes must be 500 characters or fewer')

  const [proof] = await db
    .insert(bankTransferProofs)
    .values({
      customerId: customer.id,
      proofObjectKey: proofKey,
      transferReference: reference,
      senderBank: bank,
      amountJmd: amount != null ? amount.toFixed(2) : null,
      includeDeliveryFee: Boolean(opts.includeDeliveryFee),
      notes: noteText,
      status: 'pending',
      submittedAt: new Date(),
    })
    .returning()

  for (const pkg of pkgs) {
    await db.insert(bankTransferProofPackages).values({
      proofId: proof!.id,
      packageId: pkg.id,
    })
  }

  const details = await loadProofDetails(proof!.id)
  return bankTransferProofToDict(details!.proof, {
    includePackages: true,
    packageLinks: details!.packageLinks,
    reviewedBy: details!.reviewedBy,
  })
}

export async function listPendingCustomerProofs(customer: UserRow, limit = 50) {
  return listOpenCustomerProofs(customer, limit)
}

export async function listOpenCustomerProofs(customer: UserRow, limit = 50) {
  const openStatuses = [...BANK_TRANSFER_PROOF_OPEN_STATUSES]
  return db
    .select()
    .from(bankTransferProofs)
    .where(and(eq(bankTransferProofs.customerId, customer.id), inArray(bankTransferProofs.status, openStatuses)))
    .orderBy(desc(bankTransferProofs.submittedAt))
    .limit(limit)
}

export async function listOpenTransferProofs(limit = 100) {
  const openStatuses = [...BANK_TRANSFER_PROOF_OPEN_STATUSES]
  return db
    .select()
    .from(bankTransferProofs)
    .where(inArray(bankTransferProofs.status, openStatuses))
    .orderBy(asc(bankTransferProofs.submittedAt))
    .limit(limit)
}

export async function listAllTransferProofs(limit = 100) {
  return db
    .select()
    .from(bankTransferProofs)
    .orderBy(desc(bankTransferProofs.submittedAt))
    .limit(limit)
}

export async function listTransferProofsByStatus(status: string, limit = 100) {
  return db
    .select()
    .from(bankTransferProofs)
    .where(eq(bankTransferProofs.status, status))
    .orderBy(desc(bankTransferProofs.submittedAt))
    .limit(limit)
}

export async function listPendingTransferProofs(limit = 100) {
  return db
    .select()
    .from(bankTransferProofs)
    .where(eq(bankTransferProofs.status, 'pending'))
    .orderBy(asc(bankTransferProofs.submittedAt))
    .limit(limit)
}

export async function listTransferProofHistory(limit = 100) {
  const openStatuses = [...BANK_TRANSFER_PROOF_OPEN_STATUSES]
  return db
    .select()
    .from(bankTransferProofs)
    .where(notInArray(bankTransferProofs.status, openStatuses))
    .orderBy(desc(bankTransferProofs.submittedAt))
    .limit(limit)
}

export async function getTransferProof(proofId: string): Promise<ProofRow | null> {
  try {
    const [proof] = await db.select().from(bankTransferProofs).where(eq(bankTransferProofs.id, proofId)).limit(1)
    return proof ?? null
  } catch {
    return null
  }
}

export async function proofToStaffDict(proof: ProofRow): Promise<Record<string, unknown>> {
  const details = await loadProofDetails(proof.id)
  if (!details) return bankTransferProofToDict(proof)

  const data = bankTransferProofToDict(details.proof, {
    includePackages: true,
    packageLinks: details.packageLinks,
    reviewedBy: details.reviewedBy,
  })

  const [customer] = await db.select().from(users).where(eq(users.id, proof.customerId)).limit(1)
  if (customer) {
    data.customer_name = userFullName(customer)
    data.shipping_id = customer.shippingId
  }
  return data
}

export async function markTransferProofInProgress(proof: ProofRow, staffUser: UserRow): Promise<ProofRow> {
  if (proof.status !== 'pending') {
    throw new Error('Only pending transfer proofs can be marked in progress')
  }

  const [updated] = await db
    .update(bankTransferProofs)
    .set({
      status: 'in_progress',
      reviewedAt: new Date(),
      reviewedById: staffUser.id,
    })
    .where(eq(bankTransferProofs.id, proof.id))
    .returning()
  return updated!
}

export async function confirmTransferProof(proof: ProofRow, staffUser: UserRow): Promise<ProofRow> {
  if (!(BANK_TRANSFER_PROOF_OPEN_STATUSES as readonly string[]).includes(proof.status)) {
    throw new Error('Only open transfer proofs can be confirmed')
  }

  const links = await db
    .select()
    .from(bankTransferProofPackages)
    .where(eq(bankTransferProofPackages.proofId, proof.id))

  const packageIds = links.map((link) => link.packageId).filter(Boolean)
  if (packageIds.length) {
    const [customer] = await db.select().from(users).where(eq(users.id, proof.customerId)).limit(1)
    if (!customer) throw new Error('Transfer proof customer not found')
    await recordPaymentCheckout(customer, packageIds, {
      method: 'bank_transfer',
      recordedBy: staffUser,
      reference: proof.transferReference,
      notes: proof.notes,
    })
  }

  const [updated] = await db
    .update(bankTransferProofs)
    .set({
      status: 'confirmed',
      reviewedAt: new Date(),
      reviewedById: staffUser.id,
    })
    .where(eq(bankTransferProofs.id, proof.id))
    .returning()
  return updated!
}

export async function rejectTransferProof(proof: ProofRow, staffUser: UserRow): Promise<ProofRow> {
  if (!(BANK_TRANSFER_PROOF_OPEN_STATUSES as readonly string[]).includes(proof.status)) {
    throw new Error('Only open transfer proofs can be rejected')
  }

  const [updated] = await db
    .update(bankTransferProofs)
    .set({
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedById: staffUser.id,
    })
    .where(eq(bankTransferProofs.id, proof.id))
    .returning()
  return updated!
}
