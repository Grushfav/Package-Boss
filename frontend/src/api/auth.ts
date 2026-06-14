import { api } from './client'
import type { AuthResponse, RegisterPayload } from '../types'

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload)
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
  return data
}

export async function fetchParishes(): Promise<string[]> {
  const { data } = await api.get<{ parishes: string[] }>('/parishes')
  return data.parishes
}

export async function forgotPassword(email: string): Promise<string> {
  const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email })
  return data.message
}

export async function validateResetToken(token: string): Promise<boolean> {
  const { data } = await api.get<{ valid: boolean }>('/auth/reset-password/validate', {
    params: { token },
  })
  return data.valid
}

export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const { data } = await api.post<{ message: string }>('/auth/reset-password', {
    token,
    new_password: newPassword,
  })
  return data.message
}
