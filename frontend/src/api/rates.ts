import { api } from './client'

export interface RateRow {
  label: string
  weight_lbs: number
  cost_usd: number
  cost_jmd: number
  rate_display_usd: string
  rate_display_jmd: string
}

export interface RatesResponse {
  currency: string
  jmd_per_usd: number
  max_auto_rate_lbs: number
  rates_revision?: string
  quote_note: string
  rounding_note: string
  formula_note: string
  tiers: RateRow[]
}

export interface EstimateResponse {
  actual_weight_lbs: number
  billable_weight_lbs: number
  cost_usd: number
  cost_jmd: number
  tier_label: string
  route: string
  currency: string
  jmd_per_usd: number
  rounding_note: string
  quote_note: string
}

export async function fetchRates(): Promise<RatesResponse> {
  const { data } = await api.get<RatesResponse>('/rates')
  return data
}

export async function estimateRate(weightLbs: number): Promise<EstimateResponse> {
  const { data } = await api.get<EstimateResponse>('/rates/estimate', {
    params: { weight_lbs: weightLbs },
  })
  return data
}
