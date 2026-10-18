import { Router } from 'express'
import { ALLOWED_IMAGE_TYPES } from '../constants.js'
import { jwtRequired, requireAuth, type AuthRequest } from '../middleware/auth.js'
import { listCustomerProofs, submitBankTransferProof } from '../services/bankTransferProofService.js'
import {
  ImageUploadError,
  createUploadPresign,
  isStorageConfigured,
  parsePresignFields,
} from '../services/imageUploadService.js'
import { RateLimitExceeded, assertUploadPresignAllowed } from '../services/rateLimitService.js'

export const bankTransferProofsRouter = Router()

bankTransferProofsRouter.get('/me/bank-transfer-proofs', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const proofs = await listCustomerProofs(req.user!)
  return res.json({ proofs })
})

bankTransferProofsRouter.post('/me/bank-transfer-proofs/presign', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  try {
    assertUploadPresignAllowed(req.user!.id)
  } catch (exc) {
    if (exc instanceof RateLimitExceeded) return res.status(429).json({ error: exc.message })
    throw exc
  }

  if (!isStorageConfigured()) return res.status(503).json({ error: 'File storage is not configured' })

  try {
    const [, contentType, contentLength] = parsePresignFields(req.body ?? {}, {
      defaultFilename: 'transfer-proof.jpg',
      defaultContentType: 'image/jpeg',
    })
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed' })
    }
    return res.json(await createUploadPresign({ contentType, contentLength, prefix: 'transfer-proofs' }))
  } catch (exc) {
    if (exc instanceof ImageUploadError) return res.status(exc.statusCode ?? 503).json({ error: exc.message })
    if (exc instanceof Error) return res.status(400).json({ error: exc.message })
    return res.status(500).json({ error: `Failed to generate upload URL: ${exc}` })
  }
})

bankTransferProofsRouter.post('/me/bank-transfer-proofs', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const data = req.body ?? {}
  const packageIds = data.package_ids ?? []
  if (packageIds != null && !Array.isArray(packageIds)) {
    return res.status(400).json({ error: 'package_ids must be an array' })
  }

  try {
    const proof = await submitBankTransferProof(req.user!, {
      proofObjectKey: String(data.proof_object_key ?? ''),
      packageIds,
      transferReference: data.transfer_reference as string | undefined,
      senderBank: data.sender_bank as string | undefined,
      amountJmd: data.amount_jmd,
      includeDeliveryFee: Boolean(data.include_delivery_fee),
      notes: data.notes as string | undefined,
    })
    return res.status(201).json({ proof })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})
