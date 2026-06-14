import { presignInvoiceUpload } from '../api/preAlerts'

export async function uploadInvoiceToR2(file: File): Promise<string> {
  const presign = await presignInvoiceUpload(file.name, file.type)
  const response = await fetch(presign.upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!response.ok) {
    throw new Error('Failed to upload invoice to storage')
  }
  return presign.object_key
}
