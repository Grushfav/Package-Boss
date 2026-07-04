import { fetchRates, type RatesResponse } from '../api/rates'

const CACHE_KEY = 'package-boss-rates'
const ACTIVE_REVISION_KEY = `${CACHE_KEY}:active`
const TTL_MS = 6 * 60 * 60 * 1000

interface CachedRates {
  revision: string | null
  fetchedAt: number
  data: RatesResponse
}

function cacheKey(revision: string | null | undefined): string {
  return revision ? `${CACHE_KEY}:${revision}` : CACHE_KEY
}

export function clearRatesCache(): void {
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(`${CACHE_KEY}:`) || key === CACHE_KEY) {
      localStorage.removeItem(key)
    }
  }
}

export function getCachedRates(revision: string | null | undefined): RatesResponse | null {
  if (!revision) return null
  const raw = localStorage.getItem(cacheKey(revision))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedRates
    if (parsed.revision !== revision) return null
    if (Date.now() - parsed.fetchedAt > TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

export function setCachedRates(data: RatesResponse) {
  const revision = data.rates_revision ?? null
  const payload: CachedRates = {
    revision,
    fetchedAt: Date.now(),
    data,
  }
  if (revision) {
    localStorage.setItem(cacheKey(revision), JSON.stringify(payload))
    localStorage.setItem(ACTIVE_REVISION_KEY, revision)
  }
}

/** Use revision-scoped cache when fresh; otherwise fetch and persist. */
export async function loadRates(options?: { force?: boolean }): Promise<RatesResponse> {
  if (options?.force) {
    clearRatesCache()
  } else {
    const activeRevision = localStorage.getItem(ACTIVE_REVISION_KEY)
    const cached = getCachedRates(activeRevision)
    if (cached) return cached
  }

  const data = await fetchRates()
  setCachedRates(data)
  return data
}
