import { Router } from 'express'
import { routeParam } from '../lib/routeParams.js'
import { jwtRequired, requireAuth, type AuthRequest } from '../middleware/auth.js'
import {
  cancelLogisticsJob,
  confirmCustomerLogisticsReceipt,
  createLogisticsJob,
  getLogisticsJob,
  listCustomerLogisticsJobs,
  serializeJob,
  updateCustomerLogisticsNotes,
} from '../services/logisticsJobService.js'

export const logisticsJobsRouter = Router()

logisticsJobsRouter.get('/me/logistics-jobs', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const jobs = await listCustomerLogisticsJobs(req.user!)
  return res.json({
    logistics_jobs: await Promise.all(jobs.map((job) => serializeJob(job))),
  })
})

logisticsJobsRouter.post('/me/logistics-jobs', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const data = req.body ?? {}
  try {
    const job = await createLogisticsJob(req.user!, {
      pickupAddressId: data.pickup_address_id,
      pickupAddress: data.pickup_address,
      dropoffAddressId: data.dropoff_address_id,
      dropoffAddress: data.dropoff_address,
      itemCategory: data.item_category,
      itemOtherDetail: data.item_other_detail,
      itemDescription: data.item_description,
      vehicleType: data.vehicle_type,
      deliverySpeed: data.delivery_speed,
      paymentMethod: data.payment_method,
      weightLbs: data.weight_lbs,
      notes: data.notes,
    })
    return res.status(201).json({ logistics_job: await serializeJob(job) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

logisticsJobsRouter.delete(
  '/me/logistics-jobs/:jobId',
  jwtRequired,
  requireAuth,
  async (req: AuthRequest, res) => {
    const job = await getLogisticsJob(routeParam(req.params.jobId))
    if (!job || job.customerId !== req.user!.id) {
      return res.status(404).json({ error: 'Local delivery request not found' })
    }

    try {
      const updated = await cancelLogisticsJob(job, { byCustomer: true })
      return res.json({ logistics_job: await serializeJob(updated) })
    } catch (exc) {
      return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
    }
  },
)

logisticsJobsRouter.patch(
  '/me/logistics-jobs/:jobId/notes',
  jwtRequired,
  requireAuth,
  async (req: AuthRequest, res) => {
    const job = await getLogisticsJob(routeParam(req.params.jobId))
    if (!job || job.customerId !== req.user!.id) {
      return res.status(404).json({ error: 'Local delivery request not found' })
    }

    const data = req.body ?? {}
    try {
      const updated = await updateCustomerLogisticsNotes(job, req.user!, data.notes || '')
      return res.json({ logistics_job: await serializeJob(updated) })
    } catch (exc) {
      return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
    }
  },
)

logisticsJobsRouter.post(
  '/me/logistics-jobs/:jobId/confirm-receipt',
  jwtRequired,
  requireAuth,
  async (req: AuthRequest, res) => {
    const job = await getLogisticsJob(routeParam(req.params.jobId))
    if (!job || job.customerId !== req.user!.id) {
      return res.status(404).json({ error: 'Local delivery request not found' })
    }

    try {
      const updated = await confirmCustomerLogisticsReceipt(job, req.user!)
      return res.json({ logistics_job: await serializeJob(updated) })
    } catch (exc) {
      return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
    }
  },
)
