import { api } from './client'
import type { AuthResponse, RegisterPayload, ShippingAddress } from '../types'

export interface GoogleSignupPendingResponse {
  needs_profile: true
  signup_token: string
  email: string
  first_name: string
  last_name: string
}

export type GoogleLoginResponse = AuthResponse | GoogleSignupPendingResponse

export function isGoogleSignupPending(
  response: GoogleLoginResponse,
): response is GoogleSignupPendingResponse {
  return 'needs_profile' in response && response.needs_profile === true
}

export async function loginWithGoogle(credential: string): Promise<GoogleLoginResponse> {
  const { data } = await api.post<GoogleLoginResponse>('/auth/google', { credential })
  return data
}

export async function completeGoogleSignup(
  signupToken: string,
  payload: {
    contact_number: string
    parish: string
    trn?: string
    accept_terms: boolean
  },
): Promise<AuthResponse & { shipping_address?: ShippingAddress }> {
  const { data } = await api.post<AuthResponse & { shipping_address?: ShippingAddress }>(
    '/auth/google/complete',
    payload,
    {
      headers: { Authorization: `Bearer ${signupToken}` },
    },
  )
  return data
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload)
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
  return data
}

export async function logoutSession(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } catch {
    // Clear local session even if the token was already invalid.
  }
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
