/** Jamaica operates on UTC-5 year-round (no daylight saving). */
export const APP_TIME_ZONE = 'America/Jamaica'

/** Parse API datetimes: backend stores UTC but historically omitted the Z suffix. */
export function parseAppDateTime(iso: string): Date {
  const trimmed = iso.trim()
  if (!trimmed) return new Date(Number.NaN)
  const hasZone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)
  return new Date(hasZone ? trimmed : `${trimmed}Z`)
}

export function formatAppDateTime(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!iso) return '—'
  const date = parseAppDateTime(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-JM', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: 'numeric',
    ...options,
  })
}

export function formatAppDate(iso: string | null | undefined): string {
  return formatAppDateTime(iso, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
}

/** YYYY-MM-DD in Jamaica for date inputs and API date filters. */
export function formatAppDateInput(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE })
}
