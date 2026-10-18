import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

describe('Auth error contract', () => {
  it('returns Authentication required without token on /me', async () => {
    const app = createApp()
    const res = await request(app).get('/api/me')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Authentication required')
  })

  it('returns Invalid token for malformed bearer', async () => {
    const app = createApp()
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer not-a-jwt')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid token')
  })
})
