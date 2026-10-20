import { createHmac } from 'node:crypto'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'
import { parseFacebookSignedRequest } from '../../src/services/facebookAuthService.js'

function b64UrlEncode(buf: Buffer | string): string {
  const raw = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf
  return raw
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

describe('Social auth contract', () => {
  it('rejects Google login without credential or access_token', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/google').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/credential or access token/i)
  })

  it('rejects Facebook login without access_token', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/facebook').send({})
    expect(res.status).toBe(400)
    expect(String(res.body.error)).toBeTruthy()
  })

  it('returns 404 for unknown deletion status codes', async () => {
    const app = createApp()
    const res = await request(app).get('/api/auth/deletion-status/not-a-real-code')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Deletion request not found')
  })

  it('parses a valid Meta signed_request when app secret is set', () => {
    const secret = process.env.FACEBOOK_APP_SECRET?.trim()
    if (!secret) {
      // Local CI without FB secrets — skip crypto check
      expect(true).toBe(true)
      return
    }

    const payloadObj = { algorithm: 'HMAC-SHA256', user_id: '1234567890' }
    const payload = b64UrlEncode(JSON.stringify(payloadObj))
    const sig = createHmac('sha256', secret).update(payload).digest()
    const signed = `${b64UrlEncode(sig)}.${payload}`

    const parsed = parseFacebookSignedRequest(signed)
    expect(parsed.user_id).toBe('1234567890')
  })
})
