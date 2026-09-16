import jwt from 'jsonwebtoken'
import { eq, sql } from 'drizzle-orm'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { users, type UserRow } from '../db/schema/index.js'

export function accessTokenForUser(user: UserRow): string {
  return jwt.sign({ tv: user.tokenVersion ?? 0 }, config.jwtSecretKey, {
    subject: user.id,
    expiresIn: config.jwtAccessTokenExpiresSec,
  })
}

export function createGoogleSignupToken(profile: {
  google_id: string
  email: string
  first_name: string
  last_name: string
}): string {
  return jwt.sign(
    {
      type: 'google_signup',
      google_id: profile.google_id,
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
    },
    config.jwtSecretKey,
    {
      subject: `google:${profile.google_id}`,
      expiresIn: 15 * 60,
    },
  )
}

export async function bumpTokenVersion(user: UserRow, commit = true): Promise<void> {
  const nextVersion = (user.tokenVersion ?? 0) + 1
  if (commit) {
    await db
      .update(users)
      .set({ tokenVersion: nextVersion, updatedAt: sql`now()` })
      .where(eq(users.id, user.id))
  }
  user.tokenVersion = nextVersion
}

export function tokenVersionMatches(user: UserRow, claimVersion: unknown): boolean {
  if (claimVersion == null) claimVersion = 0
  try {
    return Number(claimVersion) === Number(user.tokenVersion ?? 0)
  } catch {
    return false
  }
}
