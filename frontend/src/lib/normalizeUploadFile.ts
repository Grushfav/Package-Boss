const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export interface NormalizedUploadFile {
  filename: string
  contentType: string
  contentLength: number
}

export function normalizeUploadFile(file: File): NormalizedUploadFile {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  const contentType = file.type || MIME_BY_EXT[ext] || 'application/octet-stream'
  const contentLength = file.size

  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw new Error('Selected file is empty or unreadable')
  }

  return {
    filename: file.name,
    contentType,
    contentLength,
  }
}

export function presignFilePayload(meta: NormalizedUploadFile) {
  return {
    filename: meta.filename,
    content_type: meta.contentType,
    contentType: meta.contentType,
    content_length: meta.contentLength,
    contentLength: meta.contentLength,
    size: meta.contentLength,
  }
}
