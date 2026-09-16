import { and, desc, eq, ilike, isNotNull, or } from 'drizzle-orm'
import { packages } from '../db/schema/index.js'

type PackageRow = typeof packages.$inferSelect
import { db } from '../db/index.js'
import { warehousePackageToDict } from '../lib/serializers/package.js'
import { trackingCore } from './preAlertService.js'

export const MIN_PACKAGE_SEARCH_QUERY_LEN = 5
const PREFILTER_LIMIT = 250
const DEFAULT_RESULT_LIMIT = 20

const PB_EXACT_SCORE = 20_000
const PB_PREFIX_BASE = 15_000
const CARRIER_EXACT_BASE = 10_000

function carrierSearchScore(queryCore: string, carrier: string | null | undefined): number {
  const carrierCore = trackingCore(carrier)
  if (!queryCore || !carrierCore) return 0
  if (queryCore === carrierCore) return CARRIER_EXACT_BASE + queryCore.length

  const [short, long] =
    queryCore.length <= carrierCore.length ? [queryCore, carrierCore] : [carrierCore, queryCore]
  if (short.length < MIN_PACKAGE_SEARCH_QUERY_LEN) return 0
  if (!long.includes(short)) return 0
  return short.length
}

function matchType(score: number, field: string): string {
  if (field === 'tracking_number') return score >= PB_EXACT_SCORE ? 'exact' : 'prefix'
  if (score >= CARRIER_EXACT_BASE) return 'exact'
  return 'partial'
}

function formatMatch(
  pkg: PackageRow,
  score: number,
  field: string,
  matchedValue: string,
): Record<string, unknown> {
  return {
    package: warehousePackageToDict(pkg),
    match_score: score,
    match_field: field,
    match_type: matchType(score, field),
    matched_value: matchedValue,
  }
}

export async function searchPackages(
  query: string,
  opts: { limit?: number } = {},
): Promise<[Array<Record<string, unknown>>, boolean]> {
  const q = (query ?? '').trim()
  if (q.length < MIN_PACKAGE_SEARCH_QUERY_LEN) return [[], false]

  const limit = Math.max(1, Math.min(opts.limit ?? DEFAULT_RESULT_LIMIT, 30))
  const qUpper = q.toUpperCase()
  const qCore = trackingCore(q)

  const scored = new Map<string, [PackageRow, number, string, string]>()
  let truncated = false

  function addMatch(pkg: PackageRow, score: number, field: string, matchedValue: string): void {
    const existing = scored.get(pkg.id)
    if (!existing || score > existing[1]) {
      scored.set(pkg.id, [pkg, score, field, matchedValue])
    }
  }

  const [exactPkg] = await db
    .select()
    .from(packages)
    .where(eq(packages.trackingNumber, qUpper))
    .limit(1)
  if (exactPkg) {
    addMatch(exactPkg, PB_EXACT_SCORE + qUpper.length, 'tracking_number', exactPkg.trackingNumber)
    const match = scored.get(exactPkg.id)!
    return [[formatMatch(...match)], false]
  }

  if (qUpper.startsWith('PB')) {
    const pbRows = await db
      .select()
      .from(packages)
      .where(ilike(packages.trackingNumber, `${qUpper}%`))
      .orderBy(desc(packages.receivedAt), desc(packages.trackingNumber))
      .limit(PREFILTER_LIMIT + 1)
    if (pbRows.length > PREFILTER_LIMIT) {
      truncated = true
      pbRows.length = PREFILTER_LIMIT
    }
    for (const pkg of pbRows) {
      addMatch(pkg, PB_PREFIX_BASE + qUpper.length, 'tracking_number', pkg.trackingNumber)
    }
  }

  const carrierClauses = []
  if (qCore && qCore.length >= MIN_PACKAGE_SEARCH_QUERY_LEN) {
    carrierClauses.push(ilike(packages.carrierTracking, `%${qCore}%`))
  }
  if (q !== qCore) {
    carrierClauses.push(ilike(packages.carrierTracking, `%${q}%`))
  }
  if (carrierClauses.length) {
    const carrierRows = await db
      .select()
      .from(packages)
      .where(and(isNotNull(packages.carrierTracking), or(...carrierClauses)))
      .orderBy(desc(packages.receivedAt), desc(packages.trackingNumber))
      .limit(PREFILTER_LIMIT + 1)
    if (carrierRows.length > PREFILTER_LIMIT) {
      truncated = true
      carrierRows.length = PREFILTER_LIMIT
    }
    for (const pkg of carrierRows) {
      const score = carrierSearchScore(qCore || qUpper, pkg.carrierTracking)
      if (score > 0) {
        addMatch(pkg, score, 'carrier_tracking', pkg.carrierTracking ?? '')
      }
    }
  }

  const ranked = [...scored.values()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    const aTime = a[0].receivedAt?.getTime() ?? 0
    const bTime = b[0].receivedAt?.getTime() ?? 0
    if (bTime !== aTime) return bTime - aTime
    return a[0].trackingNumber.localeCompare(b[0].trackingNumber)
  })

  return [ranked.slice(0, limit).map(([pkg, score, field, matched]) => formatMatch(pkg, score, field, matched)), truncated]
}
