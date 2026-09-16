import { and, count, eq, inArray, ne } from 'drizzle-orm'
import { UNIDENTIFIED_HOLDER_SHIPPING_ID } from '../constants.js'
import { db } from '../db/index.js'
import {
  announcementDismissals,
  announcementReads,
  announcements,
  auditLogs,
  authorizedPickupPersons,
  bankTransferProofPackages,
  bankTransferProofs,
  broadcastJobs,
  deliveryAddresses,
  deliveryRequestPackages,
  deliveryRequests,
  logisticsJobs,
  packageEvents,
  packagePhotos,
  packages,
  passwordResetTokens,
  paymentCheckoutItems,
  paymentCheckouts,
  preAlerts,
  receiveBatches,
  shipments,
  users,
} from '../db/schema/index.js'

export interface ClearTestDataSummary {
  counts: Record<string, number>
  total(): number
}

function summary(counts: Record<string, number>): ClearTestDataSummary {
  return {
    counts,
    total() {
      return Object.values(counts).reduce((sum, n) => sum + n, 0)
    },
  }
}

async function countRows() {
  const [customerAccounts] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, 'customer'), ne(users.shippingId, UNIDENTIFIED_HOLDER_SHIPPING_ID)))

  const [staffAccountsKept] = await db
    .select({ value: count() })
    .from(users)
    .where(inArray(users.role, ['admin', 'clerk']))

  const [
    paymentCheckoutItemsCount,
    paymentCheckoutsCount,
    bankTransferProofPackagesCount,
    bankTransferProofsCount,
    deliveryRequestPackagesCount,
    deliveryRequestsCount,
    logisticsJobsCount,
    preAlertsCount,
    packageEventsCount,
    packagePhotosCount,
    packagesCount,
    receiveBatchesCount,
    shipmentsCount,
    auditLogsCount,
    announcementDismissalsCount,
    announcementReadsCount,
    broadcastJobsCount,
    announcementsCount,
    authorizedPickupsCount,
    deliveryAddressesCount,
  ] = await Promise.all([
    db.select({ value: count() }).from(paymentCheckoutItems).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(paymentCheckouts).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(bankTransferProofPackages).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(bankTransferProofs).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(deliveryRequestPackages).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(deliveryRequests).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(logisticsJobs).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(preAlerts).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(packageEvents).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(packagePhotos).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(packages).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(receiveBatches).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(shipments).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(auditLogs).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(announcementDismissals).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(announcementReads).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(broadcastJobs).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(announcements).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(authorizedPickupPersons).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(deliveryAddresses).then((r) => r[0]?.value ?? 0),
  ])

  return {
    payment_checkout_items: paymentCheckoutItemsCount,
    payment_checkouts: paymentCheckoutsCount,
    bank_transfer_proof_packages: bankTransferProofPackagesCount,
    bank_transfer_proofs: bankTransferProofsCount,
    delivery_request_packages: deliveryRequestPackagesCount,
    delivery_requests: deliveryRequestsCount,
    logistics_jobs: logisticsJobsCount,
    pre_alerts: preAlertsCount,
    package_events: packageEventsCount,
    package_photos: packagePhotosCount,
    packages: packagesCount,
    receive_batches: receiveBatchesCount,
    shipments: shipmentsCount,
    audit_logs: auditLogsCount,
    announcement_dismissals: announcementDismissalsCount,
    announcement_reads: announcementReadsCount,
    broadcast_jobs: broadcastJobsCount,
    announcements: announcementsCount,
    authorized_pickups: authorizedPickupsCount,
    delivery_addresses: deliveryAddressesCount,
    customer_accounts: customerAccounts?.value ?? 0,
    staff_accounts_kept: staffAccountsKept?.value ?? 0,
  }
}

export async function previewClearTestData() {
  return countRows()
}

export async function clearTestData(includeAnnouncements = true) {
  const deleted: Record<string, number> = {}

  deleted.payment_checkout_items = (
    await db.delete(paymentCheckoutItems).returning({ id: paymentCheckoutItems.id })
  ).length
  deleted.payment_checkouts = (
    await db.delete(paymentCheckouts).returning({ id: paymentCheckouts.id })
  ).length
  deleted.bank_transfer_proof_packages = (
    await db.delete(bankTransferProofPackages).returning({ id: bankTransferProofPackages.id })
  ).length
  deleted.bank_transfer_proofs = (
    await db.delete(bankTransferProofs).returning({ id: bankTransferProofs.id })
  ).length
  deleted.delivery_request_packages = (
    await db.delete(deliveryRequestPackages).returning({ id: deliveryRequestPackages.id })
  ).length
  deleted.delivery_requests = (
    await db.delete(deliveryRequests).returning({ id: deliveryRequests.id })
  ).length
  deleted.logistics_jobs = (await db.delete(logisticsJobs).returning({ id: logisticsJobs.id })).length
  deleted.pre_alerts = (await db.delete(preAlerts).returning({ id: preAlerts.id })).length
  deleted.package_events = (await db.delete(packageEvents).returning({ id: packageEvents.id })).length
  deleted.package_photos = (await db.delete(packagePhotos).returning({ id: packagePhotos.id })).length
  deleted.packages = (await db.delete(packages).returning({ id: packages.id })).length
  deleted.receive_batches = (await db.delete(receiveBatches).returning({ id: receiveBatches.id })).length
  deleted.shipments = (await db.delete(shipments).returning({ id: shipments.id })).length
  deleted.audit_logs = (await db.delete(auditLogs).returning({ id: auditLogs.id })).length

  if (includeAnnouncements) {
    deleted.announcement_dismissals = (
      await db.delete(announcementDismissals).returning({ id: announcementDismissals.id })
    ).length
    deleted.announcement_reads = (
      await db.delete(announcementReads).returning({ id: announcementReads.id })
    ).length
    deleted.broadcast_jobs = (await db.delete(broadcastJobs).returning({ id: broadcastJobs.id })).length
    deleted.announcements = (await db.delete(announcements).returning({ id: announcements.id })).length
  }

  deleted.authorized_pickups = (
    await db.delete(authorizedPickupPersons).returning({ id: authorizedPickupPersons.id })
  ).length
  deleted.delivery_addresses = (
    await db.delete(deliveryAddresses).returning({ id: deliveryAddresses.id })
  ).length

  const customerIds = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'customer'), ne(users.shippingId, UNIDENTIFIED_HOLDER_SHIPPING_ID)))
  ).map((r) => r.id)

  if (customerIds.length) {
    deleted.password_reset_tokens = (
      await db
        .delete(passwordResetTokens)
        .where(inArray(passwordResetTokens.userId, customerIds))
        .returning({ tokenHash: passwordResetTokens.tokenHash })
    ).length
  } else {
    deleted.password_reset_tokens = 0
  }

  deleted.customer_accounts = (
    await db
      .delete(users)
      .where(and(eq(users.role, 'customer'), ne(users.shippingId, UNIDENTIFIED_HOLDER_SHIPPING_ID)))
      .returning({ id: users.id })
  ).length

  return summary(deleted)
}

async function main() {
  const preview = process.argv.includes('--preview')
  const skipAnnouncements = process.argv.includes('--keep-announcements')

  if (preview) {
    const counts = await previewClearTestData()
    console.log(JSON.stringify(counts, null, 2))
    return
  }

  const result = await clearTestData(!skipAnnouncements)
  console.log(`Deleted ${result.total()} rows:`)
  console.log(JSON.stringify(result.counts, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
