import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { JwtPayload } from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { JAMAICA_PARISHES } from '../constants.js'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { dataDeletionRequests, users, type DataDeletionRequestRow, type UserRow } from '../db/schema/index.js'
import { hashPassword, normalizePhone } from './authService.js'
import { EmailServiceError, sendWelcomeEmail } from './emailService.js'
import { generateShippingId } from './shippingIdService.js'
import { createFacebookSignupToken } from './tokenService.js'
import { normalizeTrn } from './trnService.js'
import { buildShippingAddress } from './warehouseService.js'

const GRAPH_API_VERSION = 'v21.0'

export class FacebookAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FacebookAuthError'
  }
}

function facebookAppId(): string {
  const appId = config.facebookAppId.trim()
  if (!appId) throw new FacebookAuthError('Facebook sign-in is not configured')
  return appId
}

function facebookAppSecret(): string {
  const secret = config.facebookAppSecret.trim()
  if (!secret) throw new FacebookAuthError('Facebook sign-in is not configured')
  return secret
}

function b64UrlDecode(value: string): Buffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/') + padding, 'base64')
}

export async function verifyFacebookAccessToken(accessToken: string): Promise<{
  facebook_id: string
  email: string
  first_name: string
  last_name: string
}> {
  if (!accessToken?.trim()) throw new FacebookAuthError('Facebook access token is required')

  const token = accessToken.trim()
  const appId = facebookAppId()
  const appSecret = facebookAppSecret()

  let debugData: Record<string, unknown>
  try {
    const debugUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token`)
    debugUrl.searchParams.set('input_token', token)
    debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`)
    const debugRes = await fetch(debugUrl, { signal: AbortSignal.timeout(15_000) })
    if (!debugRes.ok) throw new Error(`debug_token ${debugRes.status}`)
    const body = (await debugRes.json()) as { data?: Record<string, unknown> }
    debugData = body.data ?? {}
  } catch {
    throw new FacebookAuthError('Could not verify Facebook token')
  }

  if (!debugData.is_valid) throw new FacebookAuthError('Invalid Facebook sign-in token')
  if (String(debugData.app_id ?? '') !== appId) {
    throw new FacebookAuthError('Facebook token is for a different app')
  }

  let profile: Record<string, unknown>
  try {
    const meUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me`)
    meUrl.searchParams.set('fields', 'id,email,first_name,last_name')
    meUrl.searchParams.set('access_token', token)
    const meRes = await fetch(meUrl, { signal: AbortSignal.timeout(15_000) })
    if (!meRes.ok) throw new Error(`me ${meRes.status}`)
    profile = (await meRes.json()) as Record<string, unknown>
  } catch {
    throw new FacebookAuthError('Could not load Facebook profile')
  }

  const facebookId = String(profile.id ?? '').trim()
  if (!facebookId) throw new FacebookAuthError('Invalid Facebook account')

  const email = String(profile.email ?? '')
    .trim()
    .toLowerCase()
  if (!email) {
    throw new FacebookAuthError(
      'Your Facebook account must share an email address. Update Facebook permissions or sign up with email instead.',
    )
  }

  const firstName = (String(profile.first_name ?? '') || email.split('@')[0] || '').trim()
  const lastName = String(profile.last_name ?? '').trim() || 'Member'

  return {
    facebook_id: facebookId,
    email,
    first_name: firstName.slice(0, 80),
    last_name: lastName.slice(0, 80),
  }
}

export function readFacebookSignupClaims(claims: JwtPayload): {
  facebook_id: string
  email: string
  first_name: string
  last_name: string
} {
  if (claims.type !== 'facebook_signup') {
    throw new FacebookAuthError('Invalid or expired Facebook signup session')
  }
  const facebookId = claims.facebook_id as string | undefined
  const email = (claims.email as string | undefined)?.trim().toLowerCase()
  const firstName = (claims.first_name as string | undefined)?.trim()
  const lastName = (claims.last_name as string | undefined)?.trim()
  if (!facebookId || !email || !firstName || !lastName) {
    throw new FacebookAuthError('Invalid or expired Facebook signup session')
  }
  return {
    facebook_id: String(facebookId),
    email,
    first_name: firstName.slice(0, 80),
    last_name: lastName.slice(0, 80),
  }
}

export async function authenticateFacebookUser(profile: {
  facebook_id: string
  email: string
  first_name: string
  last_name: string
}): Promise<[UserRow | null, Record<string, unknown> | null]> {
  const [facebookUser] = await db
    .select()
    .from(users)
    .where(eq(users.facebookId, profile.facebook_id))
    .limit(1)
  if (facebookUser) return [facebookUser, null]

  const [emailUser] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1)
  if (emailUser) {
    if (emailUser.role !== 'customer') {
      throw new FacebookAuthError(
        'This email is registered for staff access. Sign in with your password instead.',
      )
    }
    if (!emailUser.isActive) throw new FacebookAuthError('This account has been deactivated')
    if (emailUser.mustSetPassword) {
      throw new FacebookAuthError(
        'Please use the invite link in your email to set your password before signing in.',
      )
    }
    const [updated] = await db
      .update(users)
      .set({ facebookId: profile.facebook_id, updatedAt: new Date() })
      .where(eq(users.id, emailUser.id))
      .returning()
    return [updated!, null]
  }

  return [
    null,
    {
      needs_profile: true,
      signup_token: createFacebookSignupToken(profile),
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
    },
  ]
}

export async function completeFacebookSignup(
  claims: JwtPayload,
  data: Record<string, unknown>,
): Promise<[UserRow, ReturnType<typeof buildShippingAddress>]> {
  const profile = readFacebookSignupClaims(claims)

  const [existingFb] = await db
    .select()
    .from(users)
    .where(eq(users.facebookId, profile.facebook_id))
    .limit(1)
  if (existingFb) throw new FacebookAuthError('A Facebook account with this profile already exists')

  const [existingEmail] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1)
  if (existingEmail) throw new FacebookAuthError('An account with this email already exists')

  const parish = String(data.parish ?? '').trim()
  if (!(JAMAICA_PARISHES as readonly string[]).includes(parish)) {
    throw new FacebookAuthError('Invalid parish')
  }
  if (!data.accept_terms) {
    throw new FacebookAuthError('You must accept the Terms and Conditions to create an account')
  }

  let contactNumber: string
  let trn: string | null
  try {
    contactNumber = normalizePhone(String(data.contact_number ?? ''))
    trn = normalizeTrn(data.trn as string | undefined)
  } catch (err) {
    throw new FacebookAuthError(err instanceof Error ? err.message : String(err))
  }

  if (trn) {
    const [trnUser] = await db.select().from(users).where(eq(users.trn, trn)).limit(1)
    if (trnUser) throw new FacebookAuthError('An account with this TRN already exists')
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
      facebookId: profile.facebook_id,
      role: 'customer',
      isActive: true,
      mustSetPassword: false,
      tokenVersion: 0,
      whatsappOptIn: false,
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

export function parseFacebookSignedRequest(signedRequest: string): Record<string, unknown> {
  if (!signedRequest || !signedRequest.includes('.')) {
    throw new FacebookAuthError('Invalid signed_request')
  }

  const dot = signedRequest.indexOf('.')
  const encodedSig = signedRequest.slice(0, dot)
  const payload = signedRequest.slice(dot + 1)
  if (!encodedSig || !payload) throw new FacebookAuthError('Invalid signed_request')
  const appSecret = facebookAppSecret()

  let sig: Buffer
  let data: Record<string, unknown>
  try {
    sig = b64UrlDecode(encodedSig)
    data = JSON.parse(b64UrlDecode(payload).toString('utf8')) as Record<string, unknown>
  } catch {
    throw new FacebookAuthError('Invalid signed_request encoding')
  }

  const expected = createHmac('sha256', appSecret).update(payload).digest()
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    throw new FacebookAuthError('Invalid signed_request signature')
  }

  if (String(data.algorithm ?? '').toUpperCase() !== 'HMAC-SHA256') {
    throw new FacebookAuthError('Unsupported signed_request algorithm')
  }

  return data
}

export async function processFacebookDataDeletion(signedRequest: string): Promise<{
  url: string
  confirmation_code: string
}> {
  const data = parseFacebookSignedRequest(signedRequest)
  const facebookUserId = String(data.user_id ?? '').trim()
  if (!facebookUserId) throw new FacebookAuthError('signed_request missing user_id')

  const confirmationCode = randomBytes(18).toString('base64url')
  const now = new Date()
  let notes = 'Facebook data deletion callback'
  let userId: string | null = null

  const [user] = await db.select().from(users).where(eq(users.facebookId, facebookUserId)).limit(1)
  if (user) {
    userId = user.id
    notes = `Unlinked Facebook ID for user ${user.shippingId}`
    await db
      .update(users)
      .set({ facebookId: null, updatedAt: now })
      .where(eq(users.id, user.id))
  }

  await db.insert(dataDeletionRequests).values({
    confirmationCode,
    facebookUserId,
    userId,
    status: 'completed',
    createdAt: now,
    completedAt: now,
    notes,
  })

  const frontend = config.frontendUrl.replace(/\/$/, '') || 'http://localhost:5173'
  return {
    url: `${frontend}/deletion-status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  }
}

export async function getDeletionRequestStatus(
  confirmationCode: string,
): Promise<DataDeletionRequestRow | null> {
  const code = (confirmationCode || '').trim()
  if (!code) return null
  const [entry] = await db
    .select()
    .from(dataDeletionRequests)
    .where(eq(dataDeletionRequests.confirmationCode, code))
    .limit(1)
  return entry ?? null
}

export function deletionRequestToDict(entry: DataDeletionRequestRow): Record<string, unknown> {
  return {
    confirmation_code: entry.confirmationCode,
    status: entry.status,
    created_at: entry.createdAt ? entry.createdAt.toISOString() : null,
    completed_at: entry.completedAt ? entry.completedAt.toISOString() : null,
  }
}
