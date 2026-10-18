const JAMAICA_OFFSET_MS = -5 * 60 * 60 * 1000

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

