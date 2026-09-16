import type { Request } from 'express'

const buckets = new Map<string, { count: number; expires: number }>()

export class RateLimitExceeded extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitExceeded'
  }
}

export function getClientIp(req: Request): string {
  const forwarded = (req.headers['x-forwarded-for'] as string | undefined)?.trim()
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return req.ip || 'unknown'
}

function getCount(key: string): number {
  const now = Date.now() / 1000
  const entry = buckets.get(key)
  if (!entry) return 0
  if (now > entry.expires) return 0
  return entry.count
}

function increment(key: string, windowSeconds: number): number {
  const now = Date.now() / 1000
  let entry = buckets.get(key)
  if (!entry || now > entry.expires) {
    entry = { count: 0, expires: now + windowSeconds }
  }
  entry.count += 1
  buckets.set(key, entry)
  return entry.count
}

function assertRateLimit(
  key: string,
  opts: { maxAttempts: number; windowSeconds: number; message: string },
): void {
  const count = increment(key, opts.windowSeconds)
  if (count > opts.maxAttempts) throw new RateLimitExceeded(opts.message)
}

function assertRateLimits(
  keys: string[],
  opts: { maxAttempts: number; windowSeconds: number; message: string },
): void {
  for (const key of keys) assertRateLimit(key, opts)
}

function assertNotRateLimited(keys: string[], opts: { maxAttempts: number; message: string }): void {
  for (const key of keys) {
    if (getCount(key) >= opts.maxAttempts) throw new RateLimitExceeded(opts.message)
  }
}

function recordFailure(
  keys: string[],
  opts: { maxAttempts: number; windowSeconds: number; message: string },
): void {
  for (const key of keys) {
    const count = increment(key, opts.windowSeconds)
    if (count > opts.maxAttempts) throw new RateLimitExceeded(opts.message)
  }
}

const LOGIN_FAIL_WINDOW = 15 * 60
const LOGIN_FAIL_MAX = 8
const LOGIN_FAIL_MESSAGE = 'Too many failed login attempts. Try again in 15 minutes.'

const REGISTER_WINDOW = 3600
const REGISTER_MAX = 5
const REGISTER_MESSAGE = 'Too many registration attempts from this network. Try again later.'

const FORGOT_PASSWORD_WINDOW = 3600
const FORGOT_PASSWORD_MAX = 3
const FORGOT_PASSWORD_MESSAGE = 'Too many reset attempts. Try again later.'

const RESET_PASSWORD_WINDOW = 3600
const RESET_PASSWORD_MAX = 5
const RESET_PASSWORD_MESSAGE = 'Too many password reset attempts. Try again later.'

const RATES_ESTIMATE_WINDOW = 60
const RATES_ESTIMATE_MAX = 20
const RATES_ESTIMATE_MESSAGE = 'Too many rate estimates. Please wait a moment and try again.'

const UPLOAD_PRESIGN_WINDOW = 3600
const UPLOAD_PRESIGN_MAX = 20
const UPLOAD_PRESIGN_MESSAGE = 'Upload limit reached. Try again later.'

function loginKeys(email: string, ip: string): string[] {
  return [`login_fail:ip:${ip}`, `login_fail:email:${email}`]
}

export function assertLoginAllowed(email: string, ip: string): void {
  assertNotRateLimited(loginKeys(email, ip), { maxAttempts: LOGIN_FAIL_MAX, message: LOGIN_FAIL_MESSAGE })
}

export function recordLoginFailure(email: string, ip: string): void {
  recordFailure(loginKeys(email, ip), {
    maxAttempts: LOGIN_FAIL_MAX,
    windowSeconds: LOGIN_FAIL_WINDOW,
    message: LOGIN_FAIL_MESSAGE,
  })
}

export function assertRegisterAllowed(ip: string): void {
  assertRateLimit(`register:ip:${ip}`, {
    maxAttempts: REGISTER_MAX,
    windowSeconds: REGISTER_WINDOW,
    message: REGISTER_MESSAGE,
  })
}

export function assertForgotPasswordAllowed(email: string, ip: string): void {
  assertRateLimits([`forgot_password:email:${email}`, `forgot_password:ip:${ip}`], {
    maxAttempts: FORGOT_PASSWORD_MAX,
    windowSeconds: FORGOT_PASSWORD_WINDOW,
    message: FORGOT_PASSWORD_MESSAGE,
  })
}

export function assertResetPasswordAllowed(ip: string): void {
  assertRateLimit(`reset_password:ip:${ip}`, {
    maxAttempts: RESET_PASSWORD_MAX,
    windowSeconds: RESET_PASSWORD_WINDOW,
    message: RESET_PASSWORD_MESSAGE,
  })
}

export function assertRatesEstimateAllowed(ip: string): void {
  assertRateLimit(`rates_estimate:ip:${ip}`, {
    maxAttempts: RATES_ESTIMATE_MAX,
    windowSeconds: RATES_ESTIMATE_WINDOW,
    message: RATES_ESTIMATE_MESSAGE,
  })
}

export function assertUploadPresignAllowed(userId: string): void {
  assertRateLimit(`upload_presign:user:${userId}`, {
    maxAttempts: UPLOAD_PRESIGN_MAX,
    windowSeconds: UPLOAD_PRESIGN_WINDOW,
    message: UPLOAD_PRESIGN_MESSAGE,
  })
}

const CLERK_INVITE_WINDOW = 3600
const CLERK_INVITE_MAX = 3
const CLERK_INVITE_MESSAGE = 'Too many invite emails sent. Try again later.'

export function assertClerkInviteResendAllowed(adminUserId: string): void {
  assertRateLimit(`clerk_invite_resend:admin:${adminUserId}`, {
    maxAttempts: CLERK_INVITE_MAX,
    windowSeconds: CLERK_INVITE_WINDOW,
    message: CLERK_INVITE_MESSAGE,
  })
}
