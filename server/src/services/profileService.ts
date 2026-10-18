import { eq, sql } from 'drizzle-orm'
import { JAMAICA_PARISHES } from '../constants.js'
import { db } from '../db/index.js'
import { users, type UserRow } from '../db/schema/index.js'
import { hashPassword, normalizePhone, validatePassword, verifyPassword } from './authService.js'
import { bumpTokenVersion } from './tokenService.js'

export async function updateProfile(user: UserRow, data: Record<string, unknown>): Promise<UserRow> {
  const updates: Partial<typeof users.$inferInsert> = {}

  if ('first_name' in data) {
    const firstName = String(data.first_name ?? '').trim()
    if (!firstName) throw new Error('First name cannot be empty')
    updates.firstName = firstName
  }
  if ('last_name' in data) {
    const lastName = String(data.last_name ?? '').trim()
    if (!lastName) throw new Error('Last name cannot be empty')
    updates.lastName = lastName
  }
  if ('contact_number' in data) {
    updates.contactNumber = normalizePhone(String(data.contact_number ?? ''))
  }
  if ('parish' in data) {
    const parish = String(data.parish ?? '').trim()
    if (!(JAMAICA_PARISHES as readonly string[]).includes(parish)) throw new Error('Invalid parish')
    updates.parish = parish
  }
  if ('whatsapp_opt_in' in data) {
    updates.whatsappOptIn = Boolean(data.whatsapp_opt_in)
  }

  if (Object.keys(updates).length === 0) return user

  updates.updatedAt = new Date()
  const [updated] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning()
  return updated!
}

export async function changePassword(
  user: UserRow,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!currentPassword || !newPassword) {
    throw new Error('Current password and new password are required')
  }
  if (!verifyPassword(user.passwordHash, currentPassword)) {
    throw new Error('Current password is incorrect')
  }
  validatePassword(newPassword)
  await bumpTokenVersion(user, false)
  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword), tokenVersion: user.tokenVersion, updatedAt: new Date() })
    .where(eq(users.id, user.id))
}
