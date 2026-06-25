import { api } from '../api/client'
import type { PresignResponse } from '../types'

function normalizePresign(presign: PresignResponse & Record<string, unknown>): PresignResponse {
  const uploadUrl = presign.upload_url || (presign.uploadUrl as string | undefined)
  const publicUrl = presign.public_url ?? (presign.publicUrl as string | null | undefined) ?? null
  const objectKey = presign.object_key || (presign.objectKey as string | undefined) || ''
  const uploadHeaders =
    presign.upload_headers || (presign.headers as Record<string, string> | undefined)

  if (!uploadUrl) {
    throw new Error('Upload URL missing from presign response')
  }

  return {
    upload_url: uploadUrl,
    public_url: publicUrl,
    object_key: objectKey,
    upload_headers: uploadHeaders,
    shipping_id: presign.shipping_id,
  }
}

/** Step B — PUT file via backend proxy (avoids B2/R2 CORS in the browser). */
export async function putPresignedFile(
  file: File,
  presign: PresignResponse,
  contentType?: string,
): Promise<string> {
  const resolved = normalizePresign(presign as PresignResponse & Record<string, unknown>)
  const resolvedType = contentType || file.type || 'application/octet-stream'
  const form = new FormData()
  form.append('file', file)
  form.append('upload_url', resolved.upload_url)
  form.append('content_type', resolvedType)
  if (resolved.public_url) form.append('public_url', resolved.public_url)
  if (resolved.object_key) form.append('object_key', resolved.object_key)
  if (resolved.upload_headers && Object.keys(resolved.upload_headers).length > 0) {
    form.append('upload_headers', JSON.stringify(resolved.upload_headers))
  }

  const { data } = await api.post<{ public_url?: string; object_key?: string }>(
    '/uploads/put',
    form,
  )

  return data.public_url || data.object_key || resolved.public_url || resolved.object_key || ''
}
