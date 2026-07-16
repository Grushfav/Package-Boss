import { presignBankTransferProof } from '../api/bankTransferProofs'
import { normalizeUploadFile } from './normalizeUploadFile'
import { putPresignedFile } from './putPresignedFile'

export async function uploadBankTransferProof(file: File): Promise<string> {
  const meta = normalizeUploadFile(file)
  const presign = await presignBankTransferProof(
    meta.filename,
    meta.contentType,
    meta.contentLength,
  )
  return putPresignedFile(file, presign, meta.contentType)
}
