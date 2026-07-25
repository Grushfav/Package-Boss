import { api } from './client'
import { presignFilePayload } from '../lib/normalizeUploadFile'
import type { BankTransferProof, InvoicePresignResponse } from '../types'

export async function fetchMyBankTransferProofs(): Promise<BankTransferProof[]> {
  const { data } = await api.get<{ proofs: BankTransferProof[] }>('/me/bank-transfer-proofs')
  return data.proofs
}

export async function presignBankTransferProof(
  filename: string,
  contentType: string,
  contentLength: number,
): Promise<InvoicePresignResponse> {
  const { data } = await api.post<InvoicePresignResponse>(
    '/me/bank-transfer-proofs/presign',
    presignFilePayload({ filename, contentType, contentLength }),
  )
  return data
}

export async function submitBankTransferProof(payload: {
  proof_object_key: string
  package_ids?: string[]
  transfer_reference?: string
  sender_bank: string
  amount_jmd?: number
  include_delivery_fee?: boolean
  notes?: string
}): Promise<BankTransferProof> {
  const { data } = await api.post<{ proof: BankTransferProof }>(
    '/me/bank-transfer-proofs',
    payload,
  )
  return data.proof
}
