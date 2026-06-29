import { presignPackageInvoice } from '../api/packages'
import { normalizeUploadFile } from './normalizeUploadFile'
import { putPresignedFile } from './putPresignedFile'

export async function uploadPackageInvoice(packageId: string, file: File): Promise<string> {
  const meta = normalizeUploadFile(file)
  const presign = await presignPackageInvoice(
    packageId,
    meta.filename,
    meta.contentType,
    meta.contentLength,
  )
  return putPresignedFile(file, presign, meta.contentType)
}
