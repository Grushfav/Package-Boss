const JAMAICA_OFFSET_MS = -5 * 60 * 60 * 1000

/** Midnight Jamaica on `day` as a UTC Date (matches Flask jamaica_date_start_utc). */
export function jamaicaDateStartUtc(day: Date): Date {
  const y = day.getUTCFullYear()
  const m = day.getUTCMonth()
  const d = day.getUTCDate()
  // Jamaica is UTC-5 year-round (no DST)
  return new Date(Date.UTC(y, m, d, 5, 0, 0, 0))
}

/** Parse YYYY-MM-DD as Jamaica calendar day; end=true → exclusive next-day midnight. */
export function parseInvoiceDay(value: string | null | undefined, end = false): Date | null {
  const raw = (value || '').trim()
  if (!raw) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!m) throw new Error('Dates must use YYYY-MM-DD')
  let day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (end) day = new Date(day.getTime() + 24 * 60 * 60 * 1000)
  return jamaicaDateStartUtc(day)
}

export function utcIsoformat(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${d.toISOString().replace(/\.\d{3}Z$/, 'Z')}`
}

export function formatJamaicaDatetime(
  value: Date | string | null | undefined,
  options?: { dateOnly?: boolean },
): string {
  if (value == null) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const local = new Date(d.getTime() + JAMAICA_OFFSET_MS)
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const shortMonths = months.map((m) => m.slice(0, 3))
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const day = local.getUTCDate()
  if (options?.dateOnly) {
    return `${months[m]} ${day}, ${y}`
  }
  let hours = local.getUTCHours()
  const minutes = local.getUTCMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  const minuteStr = minutes.toString().padStart(2, '0')
  return `${shortMonths[m]} ${day}, ${y} ${hours}:${minuteStr} ${ampm}`
}

