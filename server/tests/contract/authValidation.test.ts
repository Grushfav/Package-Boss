import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

describe('Auth validation contract', () => {
  it('POST /api/auth/register rejects missing fields', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' })

    expect(res.status).toBe(400)
    expect(String(res.body.error)).toMatch(/Missing required fields/i)
  })

  it('POST /api/auth/login rejects missing credentials', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/login').send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Email and password are required')
  })
})
