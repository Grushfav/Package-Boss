import { api } from './client'

export interface RateTier {
  label: string
  min_weight_lbs: number
  max_weight_lbs: number
  pricing_type: 'flat' | 'per_lb'
  rate_display: string
}

export interface RatesResponse {
  currency: string
  rounding_note: string
  tiers: RateTier[]
}

export interface EstimateResponse {
  actual_weight_lbs: number
  billable_weight_lbs: number
  cost_usd: number
  tier_label: string
  route: string
  currency: string
  rounding_note: string
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
