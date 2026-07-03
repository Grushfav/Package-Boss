import { fetchRates, type RatesResponse } from '../api/rates'

const CACHE_KEY = 'package-boss-rates'
const TTL_MS = 6 * 60 * 60 * 1000

interface CachedRates {
  fetchedAt: number
  data: RatesResponse
}

export function getCachedRates(): RatesResponse | null {
  const raw = localStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedRates
    if (Date.now() - parsed.fetchedAt > TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

export function setCachedRates(data: RatesResponse) {
  const payload: CachedRates = { fetchedAt: Date.now(), data }
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
}

/** Use localStorage cache when fresh; otherwise fetch and persist. */
export async function loadRates(): Promise<RatesResponse> {
  const cached = getCachedRates()
  if (cached) return cached
  const data = await fetchRates()
  setCachedRates(data)
  return data
}
