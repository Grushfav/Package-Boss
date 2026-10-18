import { MAX_RECEIVE_LBS } from '../constants.js'
import {
  JMD_PER_USD,
  MAX_AUTO_RATE_LBS,
  QUOTE_MESSAGE,
  RATES_REVISION,
  REVISED_RATE_USD_BY_LBS,
} from '../data/revisedRateTable.js'

export { JMD_PER_USD, MAX_AUTO_RATE_LBS, QUOTE_MESSAGE, RATES_REVISION }

export function billableWeightLbs(actualWeight: number): number {
  if (actualWeight <= 0) throw new Error('Weight must be positive')
  return Math.ceil(actualWeight)
}

export function usdForBillableLbs(billable: number): number {
  if (billable < 1) throw new Error('Weight must be positive')
  if (billable > MAX_AUTO_RATE_LBS) throw new Error(QUOTE_MESSAGE)
  const usd = REVISED_RATE_USD_BY_LBS[billable]
  if (usd == null) throw new Error(QUOTE_MESSAGE)
  return usd
}

export function jmdForUsd(usd: number): number {
  return Math.round(usd * JMD_PER_USD)
}

export function tierLabelForBillable(billable: number): string {
  return billable === 1 ? '1 lb' : `${billable} lbs`
}

export function buildRateTable() {
  const rows = []
  for (let lbs = 1; lbs <= MAX_AUTO_RATE_LBS; lbs++) {
    const usd = usdForBillableLbs(lbs)
    const jmd = jmdForUsd(usd)
    rows.push({
      label: tierLabelForBillable(lbs),
      weight_lbs: lbs,
      cost_usd: usd,
      cost_jmd: jmd,
      rate_display_usd: `$${usd.toFixed(2)}`,
      rate_display_jmd: `$${jmd.toLocaleString('en-US')}`,
    })
  }
  return rows
}

export function calculateShippingCost(actualWeightLbs: number) {
  const billable = billableWeightLbs(actualWeightLbs)
  const cost = Math.round(usdForBillableLbs(billable) * 100) / 100
  const costJmd = jmdForUsd(cost)

  return {
    actual_weight_lbs: actualWeightLbs,
    billable_weight_lbs: billable,
    cost_usd: cost,
    cost_jmd: costJmd,
    tier_label: tierLabelForBillable(billable),
    route: 'Fort Lauderdale → Kingston',
    currency: 'JMD',
    jmd_per_usd: JMD_PER_USD,
    rounding_note: 'Weights are rounded up to the nearest whole pound.',
    quote_note: `Packages over ${MAX_AUTO_RATE_LBS} lbs require a custom quote.`,
    requires_custom_quote: false,
  }
}

export function calculateReceiveQuote(actualWeightLbs: number) {
  if (actualWeightLbs <= 0) throw new Error('Weight must be positive')
  if (actualWeightLbs > MAX_RECEIVE_LBS) {
    throw new Error(
      `Packages over ${MAX_RECEIVE_LBS} lbs cannot be received here. Contact support@packageboss.com.`,
    )
  }

  const billable = billableWeightLbs(actualWeightLbs)
  const base = {
    actual_weight_lbs: actualWeightLbs,
    billable_weight_lbs: billable,
    route: 'Fort Lauderdale → Kingston',
    currency: 'JMD',
    jmd_per_usd: JMD_PER_USD,
    rounding_note: 'Weights are rounded up to the nearest whole pound.',
  }

  if (billable > MAX_AUTO_RATE_LBS) {
    return {
      ...base,
      cost_usd: null,
      cost_jmd: null,
      tier_label: 'Custom quote',
      quote_note: QUOTE_MESSAGE,
      requires_custom_quote: true,
    }
  }

  const cost = Math.round(usdForBillableLbs(billable) * 100) / 100
  const costJmd = jmdForUsd(cost)
  return {
    ...base,
    cost_usd: cost,
    cost_jmd: costJmd,
    tier_label: tierLabelForBillable(billable),
    quote_note: `Packages over ${MAX_AUTO_RATE_LBS} lbs require a custom quote.`,
    requires_custom_quote: false,
  }
}
