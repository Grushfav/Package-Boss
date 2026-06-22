import { presignPackageInvoice } from '../api/packages'

export async function uploadPackageInvoiceToR2(
  packageId: string,
  file: File,
): Promise<string> {
  const presign = await presignPackageInvoice(packageId, file.name, file.type)
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
