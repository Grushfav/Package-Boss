import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { JAMAICA_PARISHES } from '../constants.js'
import { db } from '../db/index.js'
import { users } from '../db/schema/index.js'
import { jwtRequired, requireAuth, resolveJwtUser, type AuthRequest } from '../middleware/auth.js'
import { userToDict } from '../lib/serializers/user.js'
import {
  hashPassword,
  normalizePhone,
  validatePassword,
  verifyPassword,
} from '../services/authService.js'
import { EmailServiceError, sendPasswordResetEmail, sendWelcomeEmail } from '../services/emailService.js'
import { authenticateGoogleUser, completeGoogleSignup, verifyGoogleCredential } from '../services/googleAuthService.js'
import { RateLimitExceeded, assertForgotPasswordAllowed, assertLoginAllowed, assertRegisterAllowed, assertResetPasswordAllowed, getClientIp, recordLoginFailure } from '../services/rateLimitService.js'
import {
  buildResetUrl,
  deleteResetToken,
  generateResetToken,
  getUserIdForToken,
  storeResetToken,
} from '../services/resetTokenService.js'
import { generateShippingId } from '../services/shippingIdService.js'
import { accessTokenForUser, bumpTokenVersion } from '../services/tokenService.js'
import { normalizeTrn } from '../services/trnService.js'
import { buildShippingAddress } from '../services/warehouseService.js'

export const authRouter = Router()

function rateLimitError(res: import('express').Response, exc: RateLimitExceeded) {
  return res.status(429).json({ error: exc.message })
}

authRouter.post('/auth/register', async (req, res) => {
  try {
    assertRegisterAllowed(getClientIp(req))
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return rateLimitError(res, exc)
    throw exc
  }

  const data = req.body ?? {}
  const required = ['first_name', 'last_name', 'email', 'password', 'contact_number', 'parish']
  const missing = required.filter((f) => !data[f])
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
  }

  const email = String(data.email).trim().toLowerCase()
  const parish = String(data.parish).trim()
  if (!(JAMAICA_PARISHES as readonly string[]).includes(parish)) {
    return res.status(400).json({ error: 'Invalid parish' })
  }

  const [existingEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existingEmail) return res.status(409).json({ error: 'An account with this email already exists' })

  let contactNumber: string
  let trn: string | null
  try {
    validatePassword(String(data.password))
    contactNumber = normalizePhone(String(data.contact_number))
    trn = normalizeTrn(data.trn as string | undefined)
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }

  if (trn) {
    const [trnUser] = await db.select().from(users).where(eq(users.trn, trn)).limit(1)
    if (trnUser) return res.status(409).json({ error: 'An account with this TRN already exists' })
  }

  if (!data.accept_terms) {
    return res.status(400).json({ error: 'You must accept the Terms and Conditions to create an account' })
  }

  const shippingId = await generateShippingId()
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: hashPassword(String(data.password)),
      firstName: String(data.first_name).trim(),
      lastName: String(data.last_name).trim(),
      contactNumber,
      parish,
      trn,
      shippingId,
      termsAcceptedAt: new Date(),
    })
    .returning()

  const shippingAddress = buildShippingAddress(user!.shippingId)
  try {
    sendWelcomeEmail(user!.email, user!.firstName, user!.shippingId, shippingAddress)
  } catch (exc) {
    if (exc instanceof EmailServiceError) {
      console.warn(`Welcome email not sent for ${user!.email}:`, exc)
    }
  }

  return res.status(201).json({
    access_token: accessTokenForUser(user!),
    user: userToDict(user!, { includeTrn: true }),
    shipping_address: shippingAddress,
  })
})

authRouter.post('/auth/login', async (req, res) => {
  const data = req.body ?? {}
  const email = String(data.email ?? '').trim().toLowerCase()
  const password = String(data.password ?? '')
  const ip = getClientIp(req)

  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  try {
    assertLoginAllowed(email, ip)
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return rateLimitError(res, exc)
    throw exc
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user || !verifyPassword(user.passwordHash, password)) {
    try {
      recordLoginFailure(email, ip)
    } catch (exc) {
      if (exc instanceof RateLimitExceeded) return rateLimitError(res, exc)
      throw exc
    }
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  if (!user.isActive) return res.status(403).json({ error: 'This account has been deactivated' })
  if (user.mustSetPassword) {
    return res.status(403).json({
      error: 'Please use the invite link in your email to set your password before logging in.',
    })
  }

  return res.json({
    access_token: accessTokenForUser(user),
    user: userToDict(user, {
      includeTrn: user.role === 'customer',
      includeClerkFields: user.role === 'clerk' || user.role === 'admin',
    }),
  })
})

authRouter.post('/auth/logout', requireAuth, async (req: AuthRequest, res) => {
  await bumpTokenVersion(req.user!)
  return res.json({ message: 'Logged out' })
})

authRouter.post('/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const ip = getClientIp(req)
  if (!email) return res.status(400).json({ error: 'Email is required' })

  try {
    assertForgotPasswordAllowed(email, ip)
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return rateLimitError(res, exc)
    throw exc
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (user) {
    try {
      const [rawToken, tokenHash] = generateResetToken()
      await storeResetToken(user.id, tokenHash)
      sendPasswordResetEmail(user.email, user.firstName, buildResetUrl(rawToken))
    } catch (exc) {
      console.error(`Password reset failed for ${email}:`, exc)
      return res.status(503).json({ error: 'Password reset is temporarily unavailable' })
    }
  }

  return res.json({ message: 'If an account exists for that email, we sent reset instructions.' })
})

authRouter.get('/auth/reset-password/validate', async (req, res) => {
  try {
    assertResetPasswordAllowed(getClientIp(req))
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return rateLimitError(res, exc)
    throw exc
  }

  const token = String(req.query.token ?? '')
  if (!token) return res.json({ valid: false })

  const userId = await getUserIdForToken(token)
  return res.json({ valid: userId != null })
})

authRouter.post('/auth/reset-password', async (req, res) => {
  try {
    assertResetPasswordAllowed(getClientIp(req))
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return rateLimitError(res, exc)
    throw exc
  }

  const token = String(req.body?.token ?? '')
  const newPassword = String(req.body?.new_password ?? '')
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' })

  try {
    validatePassword(newPassword)
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }

  const userId = await getUserIdForToken(token)
  if (!userId) return res.status(400).json({ error: 'Invalid or expired reset link' })

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' })

  await bumpTokenVersion(user, false)
  await db
    .update(users)
    .set({
      passwordHash: hashPassword(newPassword),
      mustSetPassword: false,
      tokenVersion: user.tokenVersion,
    })
    .where(eq(users.id, user.id))
  await deleteResetToken(token)

  return res.json({ message: 'Password updated successfully. You can now log in.' })
})

authRouter.post('/auth/google', async (req, res) => {
  const credential = String(req.body?.credential ?? '')
  try {
    const profile = await verifyGoogleCredential(credential)
    const [user, pending] = await authenticateGoogleUser(profile)
    if (pending) return res.json(pending)
    if (!user!.isActive) return res.status(403).json({ error: 'This account has been deactivated' })
    return res.json({
      access_token: accessTokenForUser(user!),
      user: userToDict(user!, {
        includeTrn: user!.role === 'customer',
        includeClerkFields: user!.role === 'clerk' || user!.role === 'admin',
      }),
    })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

authRouter.post('/auth/google/complete', jwtRequired, async (req: AuthRequest, res) => {
  try {
    const [user, shippingAddress] = await completeGoogleSignup(req.jwtClaims!, req.body ?? {})
    return res.status(201).json({
      access_token: accessTokenForUser(user),
      user: userToDict(user, { includeTrn: true }),
      shipping_address: shippingAddress,
    })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})
