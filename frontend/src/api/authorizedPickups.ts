import { api } from './client'
import type { AuthorizedPickupPerson, PickupOption } from '../types'

export interface AuthorizedPickupsResponse {
  pickups: AuthorizedPickupPerson[]
  max_pickups: number
  id_types: PickupOption[]
}

export interface CreateAuthorizedPickupPayload {
  full_name: string
  contact_number: string
  id_type: string
  notes?: string
}

export async function fetchAuthorizedPickups(): Promise<AuthorizedPickupsResponse> {
  const { data } = await api.get<AuthorizedPickupsResponse>('/me/authorized-pickups')
  return data
}

export async function createAuthorizedPickup(
  payload: CreateAuthorizedPickupPayload,
): Promise<AuthorizedPickupPerson> {
  const { data } = await api.post<{ pickup: AuthorizedPickupPerson }>(
    '/me/authorized-pickups',
    payload,
  )
  return data.pickup
}

export async function deleteAuthorizedPickup(id: string): Promise<void> {
  await api.delete(`/me/authorized-pickups/${id}`)
}
