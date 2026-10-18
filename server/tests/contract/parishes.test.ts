import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

describe('GET /api/parishes', () => {
  it('returns Jamaica parish list', async () => {
    const app = createApp()
    const res = await request(app).get('/api/parishes')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.parishes)).toBe(true)
    expect(res.body.parishes).toContain('Kingston')
    expect(res.body.parishes).toContain('St. Andrew')
  })
})
