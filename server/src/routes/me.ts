import { Router } from 'express'
import {
  MAX_AUTHORIZED_PICKUPS,
  MAX_DELIVERY_ADDRESSES,
  PICKUP_ID_TYPE_LABELS,
  PICKUP_ID_TYPES,
} from '../constants.js'
import { authorizedPickupToDict } from '../lib/serializers/authorizedPickup.js'
import { deliveryAddressToDict } from '../lib/serializers/deliveryAddress.js'
import { userToDict } from '../lib/serializers/user.js'
import { jwtRequired, requireAuth, resolveJwtUser, type AuthRequest } from '../middleware/auth.js'
import {
  createAuthorizedPickup,
  deleteAuthorizedPickup,
  getAuthorizedPickup,
  listAuthorizedPickups,
  updateAuthorizedPickup,
} from '../services/authorizedPickupService.js'
import {
  createDeliveryAddress,
  deleteDeliveryAddress,
  getDeliveryAddress,
  listDeliveryAddresses,
  setDefaultDeliveryAddress,
  updateDeliveryAddress,
} from '../services/deliveryAddressService.js'
import { changePassword, updateProfile } from '../services/profileService.js'
import { routeParam } from '../lib/routeParams.js'
import { buildShippingAddress } from '../services/warehouseService.js'

export const meRouter = Router()

meRouter.get('/me', jwtRequired, requireAuth, (req: AuthRequest, res) => {
  const user = req.user!
  return res.json({
    user: userToDict(user, {
      includeTrn: user.role === 'customer',
      includeClerkFields: user.role === 'clerk' || user.role === 'admin',
    }),
  })
})

meRouter.patch('/me', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await updateProfile(req.user!, req.body ?? {})
    return res.json({ user: userToDict(user, { includeTrn: true }) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

meRouter.post('/me/change-password', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const data = req.body ?? {}
  try {
    await changePassword(req.user!, String(data.current_password ?? ''), String(data.new_password ?? ''))
    return res.json({ message: 'Password updated' })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

meRouter.get('/me/shipping-address', jwtRequired, requireAuth, (req: AuthRequest, res) => {
  const user = req.user!
  return res.json({
    shipping_id: user.shippingId,
    shipping_address: buildShippingAddress(user.shippingId),
  })
})

meRouter.get('/me/delivery-addresses', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const addresses = await listDeliveryAddresses(req.user!)
  return res.json({
    addresses: addresses.map(deliveryAddressToDict),
    max_addresses: MAX_DELIVERY_ADDRESSES,
  })
})

meRouter.post('/me/delivery-addresses', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  try {
    const address = await createDeliveryAddress(req.user!, req.body ?? {})
    return res.status(201).json({ address: deliveryAddressToDict(address) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

meRouter.patch('/me/delivery-addresses/:addressId', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const address = await getDeliveryAddress(req.user!, routeParam(req.params.addressId))
  if (!address) return res.status(404).json({ error: 'Address not found' })
  try {
    const updated = await updateDeliveryAddress(address, req.body ?? {})
    return res.json({ address: deliveryAddressToDict(updated) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

meRouter.delete('/me/delivery-addresses/:addressId', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const address = await getDeliveryAddress(req.user!, routeParam(req.params.addressId))
  if (!address) return res.status(404).json({ error: 'Address not found' })
  await deleteDeliveryAddress(address)
  return res.json({ message: 'Address deleted' })
})

meRouter.post('/me/delivery-addresses/:addressId/set-default', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const address = await getDeliveryAddress(req.user!, routeParam(req.params.addressId))
  if (!address) return res.status(404).json({ error: 'Address not found' })
  const updated = await setDefaultDeliveryAddress(address)
  return res.json({ address: deliveryAddressToDict(updated) })
})

meRouter.get('/me/authorized-pickups', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const pickups = await listAuthorizedPickups(req.user!)
  return res.json({
    pickups: pickups.map(authorizedPickupToDict),
    max_pickups: MAX_AUTHORIZED_PICKUPS,
    id_types: PICKUP_ID_TYPES.map((t) => ({ value: t, label: PICKUP_ID_TYPE_LABELS[t] })),
  })
})

meRouter.post('/me/authorized-pickups', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  try {
    const pickup = await createAuthorizedPickup(req.user!, req.body ?? {})
    return res.status(201).json({ pickup: authorizedPickupToDict(pickup) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

meRouter.patch('/me/authorized-pickups/:pickupId', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const pickup = await getAuthorizedPickup(req.user!, routeParam(req.params.pickupId))
  if (!pickup) return res.status(404).json({ error: 'Authorized pickup person not found' })
  try {
    const updated = await updateAuthorizedPickup(pickup, req.body ?? {})
    return res.json({ pickup: authorizedPickupToDict(updated) })
  } catch (exc) {
    return res.status(400).json({ error: exc instanceof Error ? exc.message : String(exc) })
  }
})

meRouter.delete('/me/authorized-pickups/:pickupId', jwtRequired, requireAuth, async (req: AuthRequest, res) => {
  const pickup = await getAuthorizedPickup(req.user!, routeParam(req.params.pickupId))
  if (!pickup) return res.status(404).json({ error: 'Authorized pickup person not found' })
  await deleteAuthorizedPickup(pickup)
  return res.json({ message: 'Authorized pickup person removed' })
})
