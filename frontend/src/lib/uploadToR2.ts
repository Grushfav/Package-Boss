import { presignUpload, presignUnidentifiedUpload } from '../api/staff'
import { normalizeUploadFile } from './normalizeUploadFile'
import { putPresignedFile } from './putPresignedFile'

export async function uploadPhotoToR2(file: File, shippingId: string): Promise<string> {
  const meta = normalizeUploadFile(file)
  const presign = await presignUpload(
    shippingId,
    meta.filename,
    meta.contentType,
    meta.contentLength,
  )
  return putPresignedFile(file, presign, meta.contentType)
}

export async function uploadUnidentifiedPhotoToR2(file: File): Promise<string> {
  const meta = normalizeUploadFile(file)
  const presign = await presignUnidentifiedUpload(
    meta.filename,
    meta.contentType,
    meta.contentLength,
  )
  return putPresignedFile(file, presign, meta.contentType)
}
