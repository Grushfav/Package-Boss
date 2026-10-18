import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { config } from '../config.js'

export class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null = null,
  ) {
    super(message)
    this.name = 'ImageUploadError'
  }
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

const ALLOWED_LOCAL_PREFIXES = ['packages/', 'invoices/', 'transfer-proofs/']

export function guessContentType(filename: string, defaultType = 'application/octet-stream'): string {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : ''
  return MIME_BY_EXT[ext] ?? defaultType
}

export function parseContentLength(data: Record<string, unknown>): number {
  const raw = data.content_length ?? data.contentLength ?? data.size
  if (raw == null) throw new Error('content_length is required')
  const length = parseInt(String(raw), 10)
  if (Number.isNaN(length)) throw new Error('content_length is required')
  if (length <= 0) throw new Error('content_length must be greater than 0')
  return length
}

export function parsePresignFields(
  data: Record<string, unknown>,
  opts: { defaultFilename: string; defaultContentType: string },
): [string, string, number] {
  const filename = String(data.filename ?? opts.defaultFilename).trim()
  let contentType = String(data.content_type ?? data.contentType ?? '')
    .trim()
    .toLowerCase()
  if (!contentType) contentType = guessContentType(filename, opts.defaultContentType)
  const contentLength = parseContentLength(data)
  return [filename, contentType, contentLength]
}

export function workerBaseUrl(): string {
  let base = config.imageUploadWorkerUrl.trim().replace(/\/$/, '')
  if (base.endsWith('/upload-worker')) base = base.slice(0, -'/upload-worker'.length)
  if (base) return base
  let full = config.imageUploadUrl.trim().replace(/\/$/, '')
  if (full.endsWith('/upload-url')) full = full.slice(0, -'/upload-url'.length)
  if (full.endsWith('/upload-worker')) full = full.slice(0, -'/upload-worker'.length)
  return full
}

export function workerApiKey(): string {
  return config.imageUploadApiKey || config.imageApiKey || ''
}

export function isImageUploadConfigured(): boolean {
  return Boolean(workerBaseUrl() && workerApiKey())
}

export function isLocalUploadEnabled(): boolean {
  if (isImageUploadConfigured()) return false
  return config.localUploadsEnabled
}

export function localUploadRoot(): string {
  if (config.localUploadRoot.trim()) return config.localUploadRoot.trim()
  const serverRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
  return resolve(serverRoot, '../var/uploads')
}

export function isStorageConfigured(): boolean {
  return isImageUploadConfigured() || isLocalUploadEnabled()
}

export function isAllowedLocalObjectKey(objectKey: string): boolean {
  const normalized = objectKey.replace(/\\/g, '/').replace(/^\//, '')
  if (!normalized || normalized.split('/').includes('..')) return false
  return ALLOWED_LOCAL_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

export function localPublicUrl(objectKey: string): string {
  return `/api/uploads/files/${objectKey.replace(/^\//, '')}`
}

export function localFilePath(objectKey: string): string {
  if (!isAllowedLocalObjectKey(objectKey)) throw new Error('Invalid upload object key')
  return resolve(localUploadRoot(), objectKey.replace(/\\/g, '/').replace(/^\//, ''))
}

export async function saveLocalUpload(objectKey: string, fileBytes: Buffer): Promise<void> {
  const path = localFilePath(objectKey)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, fileBytes)
}

export function createLocalPresignedUpload(opts: {
  contentType: string
  contentLength: number
  prefix: string
}): Record<string, unknown> {
  if (opts.contentLength <= 0) throw new ImageUploadError('content_length must be positive')
  const ext = EXT_BY_MIME[opts.contentType] ?? 'bin'
  const objectKey = `${opts.prefix.replace(/\/$/, '')}/${randomUUID()}.${ext}`
  if (!isAllowedLocalObjectKey(objectKey)) throw new ImageUploadError('Invalid upload prefix')
  return {
    upload_url: 'local',
    upload_headers: {},
    public_url: localPublicUrl(objectKey),
    object_key: objectKey,
  }
}

export function keyFromPublicUrl(publicUrl: string): string {
  try {
    return new URL(publicUrl, 'http://local').pathname.replace(/^\//, '')
  } catch {
    return publicUrl.replace(/^\//, '')
  }
}

export function resolveStoredUrl(stored: string | null | undefined): string | null {
  if (!stored) return null
  if (stored.startsWith('http://') || stored.startsWith('https://')) return stored
  const publicBase = config.storagePublicUrl.trim().replace(/\/$/, '')
  if (publicBase) return `${publicBase}/${stored.replace(/^\//, '')}`
  if (isLocalUploadEnabled() && isAllowedLocalObjectKey(stored)) {
    try {
      if (existsSync(localFilePath(stored))) return localPublicUrl(stored)
    } catch {
      return null
    }
  }
  return null
}

export async function createPresignedUpload(opts: {
  contentType: string
  contentLength: number
  prefix?: string
}): Promise<Record<string, unknown>> {
  const prefix = opts.prefix ?? 'packages'
  const base = workerBaseUrl()
  const apiKey = workerApiKey()
  if (!base || !apiKey) {
    if (isLocalUploadEnabled()) {
      return createLocalPresignedUpload({ ...opts, prefix })
    }
    throw new ImageUploadError('Image upload worker is not configured')
  }
  if (opts.contentLength <= 0) throw new ImageUploadError('content_length must be positive')

  let response: Response
  try {
    response = await fetch(`${base}/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        contentType: opts.contentType,
        contentLength: opts.contentLength,
        prefix,
      }),
    })
  } catch (err) {
    throw new ImageUploadError(`Presign request failed: ${err}`)
  }

  let data: Record<string, unknown>
  try {
    data = (await response.json()) as Record<string, unknown>
  } catch {
    throw new ImageUploadError((await response.text()) || 'Invalid presign response', response.status)
  }

  if (!response.ok) {
    throw new ImageUploadError(String(data.error ?? 'Presign failed'), response.status)
  }

  const publicUrl = (data.publicUrl ?? data.public_url) as string | undefined
  const uploadUrl = (data.uploadUrl ?? data.upload_url) as string | undefined
  if (!publicUrl || !uploadUrl) throw new ImageUploadError('Presign response missing uploadUrl or publicUrl')

  let objectKey = String(data.key ?? data.object_key ?? '').trim()
  if (!objectKey) objectKey = keyFromPublicUrl(publicUrl)

  return {
    upload_url: uploadUrl,
    upload_headers: data.headers ?? data.upload_headers ?? {},
    public_url: publicUrl,
    object_key: objectKey,
  }
}

export function createUploadPresign(opts: {
  contentType: string
  contentLength: number
  prefix: string
}): Promise<Record<string, unknown>> {
  return createPresignedUpload(opts)
}

export async function completePresignedUpload(opts: {
  uploadUrl: string
  fileBytes: Buffer
  contentType: string
  uploadHeaders?: Record<string, string>
}): Promise<void> {
  const headers = { ...(opts.uploadHeaders ?? {}), 'Content-Type': opts.contentType }
  try {
    const upload = await fetch(opts.uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(opts.fileBytes),
      headers,
    })
    if (!upload.ok) throw new Error(`HTTP ${upload.status}`)
  } catch (err) {
    throw new ImageUploadError(`Upload failed: ${err}`)
  }
}

export function isValidInvoiceReference(key: string, shippingId?: string | null): boolean {
  if (!key) return false
  if (key.startsWith('http://') || key.startsWith('https://')) return true
  if (shippingId && key.startsWith(`invoices/${shippingId}/`)) return true
  return key.startsWith('invoices/')
}

export function isValidTransferProofReference(key: string): boolean {
  if (!key) return false
  if (key.startsWith('http://') || key.startsWith('https://')) return true
  return key.startsWith('transfer-proofs/')
}

export function isValidPhotoReference(
  key: string,
  opts: { unidentified?: boolean; shippingId?: string | null } = {},
): boolean {
  if (!key) return false
  if (key.startsWith('http://') || key.startsWith('https://')) return true
  if (opts.unidentified) {
    return key.startsWith('packages/unidentified/') || key.startsWith('packages/')
  }
  if (opts.shippingId && key.startsWith(`packages/${opts.shippingId}/`)) return true
  return key.startsWith('packages/')
}
