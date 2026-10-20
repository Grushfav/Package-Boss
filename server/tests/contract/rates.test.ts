import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/** Keep in sync with k6/smoke/regression.js and revisedRateTable.ts */
const RATES_REVISION = 'revised-rates-newest'

describe('Rates contract', () => {
  it('GET /api/rates returns published tier table', async () => {
    const app = createApp()
    const res = await request(app).get('/api/rates')

    expect(res.status).toBe(200)
    expect(res.body.currency).toBe('USD')
    expect(res.body.rates_revision).toBe(RATES_REVISION)
    expect(res.body.max_auto_rate_lbs).toBe(50)
    expect(res.body.jmd_per_usd).toBe(160)
    expect(Array.isArray(res.body.tiers)).toBe(true)
    expect(res.body.tiers).toHaveLength(50)
    expect(res.body.tiers[0]).toMatchObject({
      weight_lbs: 1,
      cost_usd: 4.375,
      cost_jmd: 700,
    })
  })

  it('GET /api/rates/estimate rounds weight and returns costs', async () => {
    const app = createApp()
    const res = await request(app).get('/api/rates/estimate').query({ weight_lbs: 7.3 })

    expect(res.status).toBe(200)
    expect(res.body.billable_weight_lbs).toBe(8)
    expect(res.body.cost_usd).toBe(22.19)
    expect(res.body.cost_jmd).toBe(3550)
    expect(res.body.jmd_per_usd).toBe(160)
    expect(String(res.body.quote_note)).toMatch(/specialized/i)
  })

  it('GET /api/rates/estimate requires weight_lbs', async () => {
    const app = createApp()
    const res = await request(app).get('/api/rates/estimate')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/weight_lbs/i)
  })

  it('GET /api/rates/estimate rejects weight over 50 lbs', async () => {
    const app = createApp()
    const res = await request(app).get('/api/rates/estimate').query({ weight_lbs: 51 })

    expect(res.status).toBe(400)
    expect(String(res.body.error)).toMatch(/specialized/i)
  })
})
