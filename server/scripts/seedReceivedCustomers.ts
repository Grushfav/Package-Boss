/**
 * Seed 10 test customers, each with 10 packages in `received` status.
 * Usage (from server/): npx tsx scripts/seedReceivedCustomers.ts
 *
 * Password for all seeded customers: TestPass123!
 */
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { packages, users } from '../src/db/schema/index.js'
import { hashPassword } from '../src/services/authService.js'
import { generateShippingId } from '../src/services/shippingIdService.js'
import { receivePackage } from '../src/services/warehousePackageService.js'

const PASSWORD = 'TestPass123!'
const USER_COUNT = 10
const PACKAGES_PER_USER = 10

const FIRST_NAMES = [
  'Devon',
  'Marcia',
  'Omar',
  'Latifah',
  'Ricardo',
  'Nadia',
  'Javon',
  'Patrice',
  'Curtis',
  'Yanique',
]
const LAST_NAMES = [
  'Grant',
  'Henry',
  'Bailey',
  'Clarke',
  'Edwards',
  'Francis',
  'Gordon',
  'Harris',
  'Johnson',
  'Lewis',
]
const SHIPPERS = ['amazon', 'shein', 'ebay', 'walmart', 'other'] as const
const DESCRIPTIONS = [
  'Electronics accessories',
  'Clothing and apparel',
  'Home goods',
  'Beauty products',
  'Shoes',
  'Toys',
  'Kitchenware',
  'Sports equipment',
]

async function ensureCustomer(index: number) {
  const n = String(index).padStart(2, '0')
  const email = `seed.customer${n}@package-boss.test`
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing) {
    return { user: existing, created: false, email }
  }

  const shippingId = await generateShippingId()
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: hashPassword(PASSWORD),
      firstName: FIRST_NAMES[(index - 1) % FIRST_NAMES.length]!,
      lastName: LAST_NAMES[(index - 1) % LAST_NAMES.length]!,
      contactNumber: `+18765552${String(100 + index).slice(-3)}`,
      parish: 'Kingston',
      shippingId,
      role: 'customer',
      accountType: 'personal',
      tokenVersion: 0,
      whatsappOptIn: false,
      termsAcceptedAt: new Date(),
      isActive: true,
      mustSetPassword: false,
    })
    .returning()

  return { user: user!, created: true, email }
}

async function ensureReceivedPackages(customerId: string, shippingId: string) {
  const [{ value: existingCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(packages)
    .where(and(eq(packages.customerId, customerId), eq(packages.status, 'received')))

  const need = Math.max(0, PACKAGES_PER_USER - Number(existingCount ?? 0))
  const created: string[] = []

  for (let i = 0; i < need; i++) {
    const weight = 1.5 + ((i * 0.7) % 8)
    const shipper = SHIPPERS[i % SHIPPERS.length]!
    const note = DESCRIPTIONS[i % DESCRIPTIONS.length]!
    const [pkg] = await receivePackage(
      { id: customerId, shippingId } as Awaited<ReturnType<typeof ensureCustomer>>['user'],
      weight,
      {
        carrierTracking: `SEED-CARRIER-${shippingId}-${Date.now()}-${existingCount + i + 1}`,
        shipper,
        note,
      },
    )
    created.push(pkg.trackingNumber)
  }

  return { existing: Number(existingCount ?? 0), created }
}

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL!.replace(/^postgresql:/, 'http:')).host
    } catch {
      return '(unknown)'
    }
  })()

  console.log(`Seeding against ${host}`)

  const results = []
  for (let i = 1; i <= USER_COUNT; i++) {
    const { user, created, email } = await ensureCustomer(i)
    const pkgs = await ensureReceivedPackages(user.id, user.shippingId)
    results.push({
      email,
      shipping_id: user.shippingId,
      user: created ? 'created' : 'existing',
      packages_before: pkgs.existing,
      packages_added: pkgs.created.length,
      tracking_numbers: pkgs.created,
    })
  }

  const [{ users_total }] = await db.select({ users_total: sql<number>`count(*)::int` }).from(users)
  const [{ packages_received }] = await db
    .select({ packages_received: sql<number>`count(*)::int` })
    .from(packages)
    .where(eq(packages.status, 'received'))

  console.log(
    JSON.stringify(
      {
        password: PASSWORD,
        users_total,
        packages_received,
        seeded: results,
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
