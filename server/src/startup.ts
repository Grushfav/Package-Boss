import { eq } from 'drizzle-orm'
import { config } from './config.js'
import { db } from './db/index.js'
import { users } from './db/schema/index.js'
import { seedRateTiers } from './seeds/rateTiers.js'
import { normalizeClerkPermissions } from './services/clerkPermissionService.js'
import { ensureUnidentifiedHolder } from './services/unidentifiedService.js'
import { bumpTokenVersion } from './services/tokenService.js'

async function promoteRoleEmails() {
  if (config.adminEmail) {
    const [user] = await db.select().from(users).where(eq(users.email, config.adminEmail)).limit(1)
    if (user && user.role !== 'admin') {
      await bumpTokenVersion(user, false)
      await db
        .update(users)
        .set({ role: 'admin', tokenVersion: (user.tokenVersion ?? 0) + 1, updatedAt: new Date() })
        .where(eq(users.id, user.id))
      console.info(`Promoted ${config.adminEmail} to admin role`)
    }
  }

  if (config.clerkEmail) {
    const [user] = await db.select().from(users).where(eq(users.email, config.clerkEmail)).limit(1)
    if (user && user.role === 'customer') {
      const permissions = normalizeClerkPermissions(user.clerkPermissions)
      await bumpTokenVersion(user, false)
      await db
        .update(users)
        .set({
          role: 'clerk',
          clerkPermissions: permissions,
          tokenVersion: (user.tokenVersion ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
      console.info(`Promoted ${config.clerkEmail} to clerk role`)
    }
  }
}

export async function runStartupHooks() {
  try {
    await seedRateTiers()
    await ensureUnidentifiedHolder()
    await promoteRoleEmails()
  } catch (err) {
    console.warn('Startup hooks skipped or failed:', err instanceof Error ? err.message : err)
  }
}
