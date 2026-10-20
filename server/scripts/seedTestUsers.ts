/**
 * One-off: create/update local test accounts on the configured DATABASE_URL.
 * Usage: npx tsx scripts/seedTestUsers.ts
 */
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users } from '../src/db/schema/index.js'
import { hashPassword } from '../src/services/authService.js'
import { CLERK_PERMISSIONS } from '../src/constants.js'
import { generateShippingId } from '../src/services/shippingIdService.js'

const PASSWORD = 'TestPass123!'

/** Full permission set so k6 clerk regression can hit warehouse + billing routes. */
const FULL_CLERK_PERMISSIONS = [...CLERK_PERMISSIONS]

const accounts = [
  {
    email: 'admin@package-boss.test',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin' as const,
    phone: '+18765551001',
  },
  {
    email: 'clerk@package-boss.test',
    firstName: 'Test',
    lastName: 'Clerk',
    role: 'clerk' as const,
    phone: '+18765551002',
  },
  {
    email: 'customer@package-boss.test',
    firstName: 'Test',
    lastName: 'Customer',
    role: 'customer' as const,
    phone: '+18765551003',
  },
  {
    email: 'customer2@package-boss.test',
    firstName: 'Alicia',
    lastName: 'Brown',
    role: 'customer' as const,
    phone: '+18765551004',
  },
  {
    email: 'customer3@package-boss.test',
    firstName: 'Marcus',
    lastName: 'Williams',
    role: 'customer' as const,
    phone: '+18765551005',
  },
  {
    email: 'customer4@package-boss.test',
    firstName: 'Keisha',
    lastName: 'Thompson',
    role: 'customer' as const,
    phone: '+18765551006',
  },
  {
    email: 'customer5@package-boss.test',
    firstName: 'Andre',
    lastName: 'Campbell',
    role: 'customer' as const,
    phone: '+18765551007',
  },
  {
    email: 'customer6@package-boss.test',
    firstName: 'Simone',
    lastName: 'Reid',
    role: 'customer' as const,
    phone: '+18765551008',
  },
]

async function main() {
  const results = []
  for (const a of accounts) {
    const [existing] = await db.select().from(users).where(eq(users.email, a.email)).limit(1)
    if (existing) {
      await db
        .update(users)
        .set({
          passwordHash: hashPassword(PASSWORD),
          firstName: a.firstName,
          lastName: a.lastName,
          contactNumber: a.phone,
          parish: 'Kingston',
          role: a.role,
          isActive: true,
          mustSetPassword: false,
          clerkPermissions: a.role === 'clerk' ? FULL_CLERK_PERMISSIONS : existing.clerkPermissions,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
      results.push({
        email: a.email,
        role: a.role,
        shipping_id: existing.shippingId,
        action: 'updated',
      })
      continue
    }

    const shippingId = await generateShippingId()
    const [user] = await db
      .insert(users)
      .values({
        email: a.email,
        passwordHash: hashPassword(PASSWORD),
        firstName: a.firstName,
        lastName: a.lastName,
        contactNumber: a.phone,
        parish: 'Kingston',
        shippingId,
        role: a.role,
        tokenVersion: 0,
        whatsappOptIn: false,
        clerkPermissions: a.role === 'clerk' ? FULL_CLERK_PERMISSIONS : null,
        termsAcceptedAt: new Date(),
        isActive: true,
        mustSetPassword: false,
      })
      .returning()

    results.push({
      email: a.email,
      role: a.role,
      shipping_id: user!.shippingId,
      action: 'created',
    })
  }

  console.log(JSON.stringify({ password: PASSWORD, accounts: results }, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
