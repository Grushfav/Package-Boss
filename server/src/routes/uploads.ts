import { existsSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { Router } from 'express'
import multer from 'multer'
import { ALLOWED_IMAGE_TYPES, MAX_INVOICE_SIZE_BYTES } from '../constants.js'
import { db } from '../db/index.js'
import { users } from '../db/schema/index.js'
import { jwtRequired, requireAuth, warehouseRequired, type AuthRequest } from '../middleware/auth.js'
import {
  ImageUploadError,
  completePresignedUpload,
  createPresignedUpload,
  createUploadPresign,
  isAllowedLocalObjectKey,
  parsePresignFields,
  isLocalUploadEnabled,
  isStorageConfigured,
  keyFromPublicUrl,
  localFilePath,
  localPublicUrl,
  parseContentLength,
  saveLocalUpload,
} from '../services/imageUploadService.js'
import { RateLimitExceeded, assertUploadPresignAllowed } from '../services/rateLimitService.js'

export const uploadsRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_INVOICE_SIZE_BYTES } })

const ALLOWED_UPLOAD_HOST_SUFFIXES = ['.backblazeb2.com']

function isAllowedUploadUrl(url: string): boolean {
  if (url === 'local') return isLocalUploadEnabled()
  try {
    const host = new URL(url).hostname.toLowerCase()
    return ALLOWED_UPLOAD_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  } catch {
    return false
  }
}

function presignError(res: import('express').Response, exc: unknown, status = 500) {
  if (exc instanceof ImageUploadError) return res.status(exc.statusCode ?? status).json({ error: exc.message })
  return res.status(status).json({ error: `Failed to generate upload URL: ${exc}` })
}

uploadsRouter.post('/upload-url', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  try {
    assertUploadPresignAllowed(req.user!.id)
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return res.status(429).json({ error: exc.message })
    throw exc
  }

  if (!isStorageConfigured()) return res.status(503).json({ error: 'Image upload is not configured' })

  const data = req.body ?? {}
  const contentType = String(data.content_type ?? data.contentType ?? '')
    .trim()
    .toLowerCase()
  const prefix = String(data.prefix ?? 'packages').trim() || 'packages'

  try {
    const contentLength = parseContentLength(data)
    if (!contentType) return res.status(400).json({ error: 'content_type is required' })
    return res.json(await createPresignedUpload({ contentType, contentLength, prefix }))
  } catch (exc) {
    if (exc instanceof ImageUploadError) return presignError(res, exc)
    if (exc instanceof Error) return res.status(400).json({ error: exc.message })
    return presignError(res, exc)
  }
})

uploadsRouter.post('/uploads/put', jwtRequired, requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  if (!isStorageConfigured()) return res.status(503).json({ error: 'File storage is not configured' })

  const uploadUrl = String(req.body?.upload_url ?? '').trim()
  const publicUrl = String(req.body?.public_url ?? '').trim()
  let objectKey = String(req.body?.object_key ?? '').trim()
  const contentType = String(req.body?.content_type ?? 'application/octet-stream').trim().toLowerCase()

  if (!uploadUrl) return res.status(400).json({ error: 'upload_url is required' })
  if (!isAllowedUploadUrl(uploadUrl)) return res.status(400).json({ error: 'Invalid upload URL' })

  const file = req.file
  if (!file) return res.status(400).json({ error: 'file is required' })
  if (!file.buffer.length) return res.status(400).json({ error: 'file is empty' })
  if (file.buffer.length > MAX_INVOICE_SIZE_BYTES) {
    return res.status(400).json({ error: 'File exceeds maximum allowed size' })
  }

  if (uploadUrl === 'local') {
    if (!objectKey) objectKey = publicUrl ? keyFromPublicUrl(publicUrl) : ''
    if (!objectKey || !isAllowedLocalObjectKey(objectKey)) {
      return res.status(400).json({ error: 'Invalid object_key for local upload' })
    }
    try {
      await saveLocalUpload(objectKey, file.buffer)
    } catch (exc) {
      if (exc instanceof Error && exc.message.includes('Invalid')) {
        return res.status(400).json({ error: exc.message })
      }
      return presignError(res, exc)
    }
    return res.json({ public_url: localPublicUrl(objectKey), object_key: objectKey })
  }

  let uploadHeaders: Record<string, string> = {}
  try {
    const parsed = JSON.parse(String(req.body?.upload_headers ?? '{}'))
    if (parsed && typeof parsed === 'object') uploadHeaders = parsed as Record<string, string>
  } catch {
    uploadHeaders = {}
  }

  try {
    await completePresignedUpload({
      uploadUrl,
      fileBytes: file.buffer,
      contentType,
      uploadHeaders,
    })
  } catch (exc) {
    return presignError(res, exc, 502)
  }

  if (!objectKey && publicUrl) objectKey = keyFromPublicUrl(publicUrl)
  return res.json({ public_url: publicUrl, object_key: objectKey })
})

uploadsRouter.post('/uploads/presign', jwtRequired, warehouseRequired, async (req: AuthRequest, res) => {
  try {
    assertUploadPresignAllowed(req.user!.id)
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return res.status(429).json({ error: exc.message })
    throw exc
  }

  if (!isStorageConfigured()) return res.status(503).json({ error: 'File storage is not configured' })

  const data = req.body ?? {}
  const shippingId = String(data.shipping_id ?? '')
    .trim()
    .toUpperCase()
  try {
    const [, contentType, contentLength] = parsePresignFields(data, {
      defaultFilename: 'photo.jpg',
      defaultContentType: 'image/jpeg',
    })
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed' })
    }
    if (!shippingId) return res.status(400).json({ error: 'shipping_id is required' })

    const [customer] = await db.select().from(users).where(eq(users.shippingId, shippingId)).limit(1)
    if (!customer) return res.status(404).json({ error: 'Customer not found for that BOSS ID' })

    const payload = await createUploadPresign({ contentType, contentLength, prefix: 'packages' })
    return res.json({ ...payload, shipping_id: shippingId })
  } catch (exc) {
    if (exc instanceof ImageUploadError) return presignError(res, exc)
    if (exc instanceof Error) return res.status(400).json({ error: exc.message })
    return presignError(res, exc)
  }
})

uploadsRouter.post(
  '/uploads/presign-unidentified',
  jwtRequired,
  warehouseRequired,
  async (req: AuthRequest, res) => {
    try {
      assertUploadPresignAllowed(req.user!.id)
    } catch (exc) {
      if (exc instanceof RateLimitExceeded) return res.status(429).json({ error: exc.message })
      throw exc
    }

    if (!isStorageConfigured()) return res.status(503).json({ error: 'File storage is not configured' })

    const data = req.body ?? {}
    try {
      const [, contentType, contentLength] = parsePresignFields(data, {
        defaultFilename: 'photo.jpg',
        defaultContentType: 'image/jpeg',
      })
      if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
        return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed' })
      }
      return res.json(await createUploadPresign({ contentType, contentLength, prefix: 'packages' }))
    } catch (exc) {
      if (exc instanceof ImageUploadError) return presignError(res, exc)
      if (exc instanceof Error) return res.status(400).json({ error: exc.message })
      return presignError(res, exc)
    }
  },
)

uploadsRouter.get('/uploads/files/*', (req, res) => {
  if (!isLocalUploadEnabled()) return res.status(404).json({ error: 'Not found' })
  const objectKey = req.path.replace(/^\/uploads\/files\/?/, '')
  if (!isAllowedLocalObjectKey(objectKey)) return res.status(404).json({ error: 'Not found' })
  try {
    const path = localFilePath(objectKey)
    if (!existsSync(path)) return res.status(404).json({ error: 'Not found' })
    return res.sendFile(path)
  } catch {
    return res.status(404).json({ error: 'Not found' })
  }
})
