const TRN_PATTERN = /^\d{9}$/

export function normalizeTrn(value: string | null | undefined): string | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!TRN_PATTERN.test(digits)) {
    throw new Error('TRN must be 9 digits')
  }
  return digits
}

export function formatTrn(trn: string): string {
  const n = normalizeTrn(trn)
  if (!n) throw new Error('TRN must be 9 digits')
  return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`
}
