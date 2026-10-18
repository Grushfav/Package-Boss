import { Router } from 'express'
import { RateLimitExceeded, assertRatesEstimateAllowed, getClientIp } from '../services/rateLimitService.js'
import {
  JMD_PER_USD,
  MAX_AUTO_RATE_LBS,
  QUOTE_MESSAGE,
  RATES_REVISION,
  buildRateTable,
  calculateShippingCost,
} from '../services/shippingService.js'

export const ratesRouter = Router()

ratesRouter.get('/rates', (_req, res) => {
  const payload = {
    currency: 'USD',
    jmd_per_usd: JMD_PER_USD,
    max_auto_rate_lbs: MAX_AUTO_RATE_LBS,
    rates_revision: RATES_REVISION,
    quote_note: QUOTE_MESSAGE,
    rounding_note: 'All weights are rounded up to the nearest whole pound before rating.',
    formula_note: `Published tier rates by billable weight (1–${MAX_AUTO_RATE_LBS} lbs). JMD shown at ${JMD_PER_USD} JMD = 1 USD.`,
    billing_disclaimer:
      'Published rates are freight estimates only. Final bills may include customs duties (items over $100 USD), handling fees, and other charges after invoice review.',
    tiers: buildRateTable(),
  }
  res.set('Cache-Control', 'public, max-age=300')
  return res.json(payload)
})

ratesRouter.get('/rates/estimate', (req, res) => {
  try {
    assertRatesEstimateAllowed(getClientIp(req))
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return res.status(429).json({ error: exc.message })
    throw exc
  }

  const weightRaw = req.query.weight_lbs
  if (weightRaw == null) return res.status(400).json({ error: 'weight_lbs query parameter is required' })

  try {
    const weight = parseFloat(String(weightRaw))
    return res.json(calculateShippingCost(weight))
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc)
    return res.status(400).json({
      error: message,
      requires_quote: message.toLowerCase().includes('custom quote'),
    })
  }
})
