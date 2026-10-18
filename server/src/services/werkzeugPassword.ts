import { pbkdf2Sync, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/** Verify passwords hashed by Flask/Werkzeug (pbkdf2:sha256 or scrypt). */
export function verifyWerkzeugPassword(passwordHash: string, password: string): boolean {
  if (!passwordHash || !password) return false
  const [method, ...rest] = passwordHash.split('$')
  if (rest.length < 2) return false

  if (method.startsWith('pbkdf2:')) {
    const [, , iterationsStr] = method.split(':')
    const iterations = parseInt(iterationsStr ?? '600000', 10)
    const salt = rest[0]
    const stored = Buffer.from(rest[1], 'hex')
    const derived = pbkdf2Sync(password, salt, iterations, stored.length, 'sha256')
    return timingSafeEqual(stored, derived)
  }

  if (method.startsWith('scrypt:')) {
    const parts = method.split(':')
    const N = parseInt(parts[1] ?? '32768', 10)
    const r = parseInt(parts[2] ?? '8', 10)
    const p = parseInt(parts[3] ?? '1', 10)
    const salt = rest[0]
    const stored = Buffer.from(rest[1], 'hex')
    const derived = scryptSync(password, salt, stored.length, { N, r, p, maxmem: 128 * N * r * 2 })
    return timingSafeEqual(stored, derived)
  }

  return false
}

/** Hash new passwords using Werkzeug-compatible pbkdf2:sha256. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const iterations = 600000
  const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex')
  return `pbkdf2:sha256:${iterations}$${salt}$${hash}`
}
