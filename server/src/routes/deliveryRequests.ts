import { Router } from 'express'
import { jwtRequired, requireAuth, type AuthRequest } from '../middleware/auth.js'
import { routeParam } from '../lib/routeParams.js'
import {
  cancelDeliveryRequest,
  computePaymentTotalWithDelivery,
  createDeliveryRequest,
  getDeliveryRequest,
  listCustomerDeliveryRequests,
} from '../services/deliveryRequestService.js'

export const deliveryRequestsRouter = Router()

deliveryRequestsRouter.get('/me/delivery-requests', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const requests = await listCustomerDeliveryRequests(req.user!)
  return res.json({ delivery_requests: requests })
})

deliveryRequestsRouter.post('/me/delivery-requests', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const data = req.body ?? {}
  const packageIds = data.package_ids ?? []
  if (!Array.isArray(packageIds)) return res.status(400).json({ error: 'package_ids must be an array' })
  if (!data.delivery_address_id) return res.status(400).json({ error: 'delivery_address_id is required' })

  try {
    const deliveryRequest = await createDeliveryRequest(req.user!, {
      packageIds,
      deliveryAddressId: String(data.delivery_address_id),
      notes: data.notes as string | undefined,
    })
    return res.status(201).json({ delivery_request: deliveryRequest })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

deliveryRequestsRouter.delete('/me/delivery-requests/:requestId', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const deliveryRequest = await getDeliveryRequest(routeParam(req.params.requestId))
  if (!deliveryRequest || deliveryRequest.customerId !== req.user!.id) {
    return res.status(404).json({ error: 'Delivery request not found' })
  }

  try {
    const updated = await cancelDeliveryRequest(deliveryRequest, true)
    return res.json({ delivery_request: updated })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

deliveryRequestsRouter.post('/me/payment-total', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const packageIds = req.body?.package_ids ?? []
  if (!Array.isArray(packageIds)) return res.status(400).json({ error: 'package_ids must be an array' })

  try {
    const totals = await computePaymentTotalWithDelivery(req.user!, packageIds)
    return res.json(totals)
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})
