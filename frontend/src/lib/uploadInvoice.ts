import { presignInvoiceUpload } from '../api/preAlerts'
import { normalizeUploadFile } from './normalizeUploadFile'
import { putPresignedFile } from './putPresignedFile'

export async function uploadInvoiceToR2(file: File): Promise<string> {
  const meta = normalizeUploadFile(file)
  const presign = await presignInvoiceUpload(
    meta.filename,
    meta.contentType,
    meta.contentLength,
  )
  return putPresignedFile(file, presign, meta.contentType)
}
