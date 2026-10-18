import type { RatesResponse } from '../api/rates'
import { loadRates } from './ratesCache'
import { MAX_AUTO_RATE_LBS } from './warehouseConstants'

/** Round up to whole pounds (matches backend billable_weight_lbs). */
export function billableWeightLbs(actualLbs: number): number {
  if (!(actualLbs > 0)) {
    throw new Error('Weight must be positive')
  }
  return Math.ceil(actualLbs)
}

export interface LocalFreightEstimate {
  billable_weight_lbs: number
  cost_jmd: number
  cost_usd: number
  tier_label: string
}

/**
 * Resolve freight from the published tier table (one /rates fetch), not /rates/estimate.
 * Avoids per-package estimate calls that trip the estimate rate limit.
 */
export function freightFromRatesTable(
  actualWeightLbs: number,
  rates: RatesResponse,
): LocalFreightEstimate | null {
  const billable = billableWeightLbs(actualWeightLbs)
  const maxLbs = rates.max_auto_rate_lbs ?? MAX_AUTO_RATE_LBS
  if (billable > maxLbs) return null

  const tier = rates.tiers.find((row) => row.weight_lbs === billable)
  if (!tier) return null

  return {
    billable_weight_lbs: billable,
    cost_jmd: tier.cost_jmd,
    cost_usd: tier.cost_usd,
    tier_label: tier.label,
  }
}

export async function loadFreightForWeight(
  actualWeightLbs: number,
): Promise<LocalFreightEstimate | null> {
  const rates = await loadRates()
  return freightFromRatesTable(actualWeightLbs, rates)
}
