import { and, asc, eq, isNotNull, notInArray, sql } from 'drizzle-orm'
import { MULTI_PACKAGE_HANDLING_FEE_JMD } from '../constants.js'
import { db } from '../db/index.js'
import { deliveryAddresses, packages, type UserRow } from '../db/schema/index.js'
import { deliveryAddressToDict } from '../lib/serializers/deliveryAddress.js'
import { buildShippingAddress } from './warehouseService.js'

export async function getCustomerDashboard(user: UserRow) {
  const statusRows = await db
    .select({
      status: packages.status,
      value: sql<number>`count(*)::int`,
    })
    .from(packages)
    .where(eq(packages.customerId, user.id))
    .groupBy(packages.status)

  const counts = new Map(statusRows.map((row) => [row.status, Number(row.value ?? 0)]))

  const [due] = await db
    .select({
      payable: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${packages.totalDueJmd}), 0)`,
    })
    .from(packages)
    .where(
      and(
        eq(packages.customerId, user.id),
        eq(packages.status, 'ready_for_pickup'),
        eq(packages.billingStatus, 'ready'),
        isNotNull(packages.totalDueJmd),
      ),
    )

  const payableCount = Number(due?.payable ?? 0)
  const handlingFee = payableCount > 1 ? parseFloat(MULTI_PACKAGE_HANDLING_FEE_JMD) : 0

  const [invoiceActions] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(packages)
    .where(
      and(
        eq(packages.customerId, user.id),
        eq(packages.invoiceStatus, 'requested'),
        notInArray(packages.status, ['received', 'ready_for_pickup', 'delivered']),
      ),
    )

  const [defaultAddress] = await db
    .select()
    .from(deliveryAddresses)
    .where(and(eq(deliveryAddresses.customerId, user.id), eq(deliveryAddresses.isDefault, true)))
    .orderBy(asc(deliveryAddresses.createdAt))
    .limit(1)

  return {
    stats: {
      received_fort_lauderdale: counts.get('received') ?? 0,
      in_transit: counts.get('in_transit') ?? 0,
      customs: counts.get('customs') ?? 0,
      ready_pickup_delivery: counts.get('ready_for_pickup') ?? 0,
      payable_package_count: payableCount,
      handling_fee_jmd: handlingFee,
      total_due_jmd: parseFloat(due?.total ?? '0') + handlingFee,
      invoice_action_count: Number(invoiceActions?.value ?? 0),
    },
    default_delivery_address: defaultAddress ? deliveryAddressToDict(defaultAddress) : null,
    shipping_address: buildShippingAddress(user.shippingId),
  }
}
