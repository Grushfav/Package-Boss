import { presignUpload, presignUnidentifiedUpload } from '../api/staff'

export async function uploadPhotoToR2(
  file: File,
  shippingId: string,
): Promise<string> {
  const presign = await presignUpload(shippingId, file.name, file.type)
  const response = await fetch(presign.upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!response.ok) {
    throw new Error('Failed to upload image to storage')
  }
  return presign.object_key
}

export async function uploadUnidentifiedPhotoToR2(file: File): Promise<string> {
  const presign = await presignUnidentifiedUpload(file.name, file.type)
  const response = await fetch(presign.upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!response.ok) {
    throw new Error('Failed to upload image to storage')
  }
  return presign.object_key
}
