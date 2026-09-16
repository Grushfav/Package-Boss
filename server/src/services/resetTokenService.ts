import { createHash, randomBytes } from 'node:crypto'
import { and, eq, lte } from 'drizzle-orm'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { passwordResetTokens } from '../db/schema/index.js'

const RESET_TTL_SECONDS = 900
const INVITE_TTL_SECONDS = 86400

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

function expiresAt(ttl: number): Date {
  return new Date(Date.now() + ttl * 1000)
}

async function purgeExpiredForUser(userId: string): Promise<void> {
  const now = new Date()
  await db
    .delete(passwordResetTokens)
    .where(and(eq(passwordResetTokens.userId, userId), lte(passwordResetTokens.expiresAt, now)))
}

async function storeReset(userId: string, tokenHash: string, ttl: number): Promise<void> {
  await purgeExpiredForUser(userId)
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId))
  await db.insert(passwordResetTokens).values({
    tokenHash,
    userId,
    expiresAt: expiresAt(ttl),
  })
}

async function getReset(tokenHash: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1)
  if (!row) return null
  if (new Date() > row.expiresAt) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash))
    return null
  }
  return row.userId
}

export function generateResetToken(): [string, string] {
  const raw = randomBytes(32).toString('base64url')
  return [raw, hashToken(raw)]
}

export async function storeResetToken(userId: string, tokenHash: string, ttl = RESET_TTL_SECONDS): Promise<void> {
  await storeReset(userId, tokenHash, ttl)
}

export async function storeInviteToken(userId: string, tokenHash: string): Promise<void> {
  await storeReset(userId, tokenHash, INVITE_TTL_SECONDS)
}

export async function getUserIdForToken(rawToken: string): Promise<string | null> {
  return getReset(hashToken(rawToken))
}

export async function deleteResetToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken)
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash))
}

export function buildResetUrl(rawToken: string, invite = false): string {
  let url = `${config.frontendUrl}/reset-password?token=${rawToken}`
  if (invite) url += '&invite=1'
  return url
}
