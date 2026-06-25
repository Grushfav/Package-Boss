import { api } from './client'
import type { User } from '../types'

export interface UpdateProfilePayload {
  first_name?: string
  last_name?: string
  contact_number?: string
  parish?: string
  whatsapp_opt_in?: boolean
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  const { data } = await api.patch<{ user: User }>('/me', payload)
  return data.user
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post('/me/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}
