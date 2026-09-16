import { hashPassword as werkzeugHash, verifyWerkzeugPassword } from './werkzeugPassword.js'

export function hashPassword(password: string): string {
  return werkzeugHash(password)
}

export function verifyPassword(passwordHash: string, password: string): boolean {
  return verifyWerkzeugPassword(passwordHash, password)
}

export function normalizePhone(value: string): string {
  const raw = (value ?? '').trim()
  if (!raw) throw new Error('Contact number is required')
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    throw new Error('Contact number must be 7–15 digits (include country code)')
  }
  return `+${digits}`
}

export function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
}
