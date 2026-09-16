import { randomBytes } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import type { JwtPayload } from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { JAMAICA_PARISHES } from '../constants.js'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { users, type UserRow } from '../db/schema/index.js'
import { hashPassword, normalizePhone } from './authService.js'
import { EmailServiceError, sendWelcomeEmail } from './emailService.js'
import { generateShippingId } from './shippingIdService.js'
import { createGoogleSignupToken } from './tokenService.js'
import { normalizeTrn } from './trnService.js'
import { buildShippingAddress } from './warehouseService.js'

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleAuthError'
  }
}

function googleClientId(): string {
  const clientId = config.googleClientId.trim()
  if (!clientId) throw new GoogleAuthError('Google sign-in is not configured')
  return clientId
}

export async function verifyGoogleCredential(credential: string): Promise<{
  google_id: string
  email: string
  first_name: string
  last_name: string
}> {
  if (!credential?.trim()) throw new GoogleAuthError('Google credential is required')

  const client = new OAuth2Client(googleClientId())
  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken: credential.trim(), audience: googleClientId() })
    payload = ticket.getPayload()
  } catch {
    throw new GoogleAuthError('Invalid Google sign-in token')
  }

  if (!payload) throw new GoogleAuthError('Invalid Google sign-in token')
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss ?? '')) {
    throw new GoogleAuthError('Invalid Google token issuer')
  }

  const email = (payload.email ?? '').trim().toLowerCase()
  if (!email) throw new GoogleAuthError('Google account email is required')
  if (!payload.email_verified) throw new GoogleAuthError('Google account email is not verified')

  const googleId = payload.sub
  if (!googleId) throw new GoogleAuthError('Invalid Google account')

  const firstName = (payload.given_name ?? email.split('@')[0] ?? '').trim()
  const lastName = (payload.family_name ?? '').trim() || 'Member'

  return {
    google_id: String(googleId),
    email,
    first_name: firstName.slice(0, 80),
    last_name: lastName.slice(0, 80),
  }
}

export function readGoogleSignupClaims(claims: JwtPayload): {
  google_id: string
  email: string
  first_name: string
  last_name: string
} {
  if (claims.type !== 'google_signup') {
    throw new GoogleAuthError('Invalid or expired Google signup session')
  }
  const googleId = claims.google_id as string | undefined
  const email = (claims.email as string | undefined)?.trim().toLowerCase()
  const firstName = (claims.first_name as string | undefined)?.trim()
  const lastName = (claims.last_name as string | undefined)?.trim()
  if (!googleId || !email || !firstName || !lastName) {
    throw new GoogleAuthError('Invalid or expired Google signup session')
  }
  return {
    google_id: String(googleId),
    email,
    first_name: firstName.slice(0, 80),
    last_name: lastName.slice(0, 80),
  }
}

export async function authenticateGoogleUser(profile: {
  google_id: string
  email: string
  first_name: string
  last_name: string
}): Promise<[UserRow | null, Record<string, unknown> | null]> {
  const [googleUser] = await db.select().from(users).where(eq(users.googleId, profile.google_id)).limit(1)
  if (googleUser) return [googleUser, null]

  const [emailUser] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1)
  if (emailUser) {
    if (emailUser.role !== 'customer') {
      throw new GoogleAuthError(
        'This email is registered for staff access. Sign in with your password instead.',
      )
    }
    if (!emailUser.isActive) throw new GoogleAuthError('This account has been deactivated')
    if (emailUser.mustSetPassword) {
      throw new GoogleAuthError(
        'Please use the invite link in your email to set your password before signing in.',
      )
    }
    const [updated] = await db
      .update(users)
      .set({ googleId: profile.google_id })
      .where(eq(users.id, emailUser.id))
      .returning()
    return [updated!, null]
  }

  return [
    null,
    {
      needs_profile: true,
      signup_token: createGoogleSignupToken(profile),
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
    },
  ]
}

export async function completeGoogleSignup(
  claims: JwtPayload,
  data: Record<string, unknown>,
): Promise<[UserRow, ReturnType<typeof buildShippingAddress>]> {
  const profile = readGoogleSignupClaims(claims)

  const [existingGoogle] = await db.select().from(users).where(eq(users.googleId, profile.google_id)).limit(1)
  if (existingGoogle) throw new GoogleAuthError('A Google account with this profile already exists')

  const [existingEmail] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1)
  if (existingEmail) throw new GoogleAuthError('An account with this email already exists')

  const parish = String(data.parish ?? '').trim()
  if (!(JAMAICA_PARISHES as readonly string[]).includes(parish)) {
    throw new GoogleAuthError('Invalid parish')
  }
  if (!data.accept_terms) {
    throw new GoogleAuthError('You must accept the Terms and Conditions to create an account')
  }

  let contactNumber: string
  let trn: string | null
  try {
    contactNumber = normalizePhone(String(data.contact_number ?? ''))
    trn = normalizeTrn(data.trn as string | undefined)
  } catch (err) {
    throw new GoogleAuthError(err instanceof Error ? err.message : String(err))
  }

  if (trn) {
    const [trnUser] = await db.select().from(users).where(eq(users.trn, trn)).limit(1)
    if (trnUser) throw new GoogleAuthError('An account with this TRN already exists')
  }

  const shippingId = await generateShippingId()
  const [user] = await db
    .insert(users)
    .values({
      email: profile.email,
      passwordHash: hashPassword(randomBytes(32).toString('base64url')),
      firstName: profile.first_name,
      lastName: profile.last_name,
      contactNumber,
      parish,
      trn,
      shippingId,
      googleId: profile.google_id,
      termsAcceptedAt: new Date(),
    })
    .returning()

  const shippingAddress = buildShippingAddress(user!.shippingId)
  try {
    sendWelcomeEmail(user!.email, user!.firstName, user!.shippingId, shippingAddress)
  } catch (err) {
    if (err instanceof EmailServiceError) {
      console.warn(`Welcome email not sent for ${user!.email}:`, err)
    }
  }

  return [user!, shippingAddress]
}
