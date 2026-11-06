import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const AUTH_REQUEST_PATTERN =
  /\/auth\/(?:login|register|forgot-password|reset-password|logout|google(?:\/complete)?|facebook(?:\/complete)?)/

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/signup/google',
  '/signup/facebook',
  '/forgot-password',
  '/reset-password',
  '/deletion-status',
  '/data-deletion',
])

/** Safe copy shown to customers and clerks. Never include status codes or stack text. */
export const USER_ERROR = {
  network: 'We’re having trouble connecting. Check your connection and try again.',
  notFound: 'We couldn’t find that.',
  forbidden: 'You don’t have access to do that.',
  unauthorized: 'Please sign in again.',
  rateLimit: 'Too many attempts. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Please try again in a moment.',
  validation: 'Please check your details and try again.',
  generic: 'Something went wrong. Please try again.',
} as const

const TECHNICAL_MESSAGE =
  /status code|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Network Error|Internal Server|Traceback|sqlalchemy|drizzle|postgres|SQLITE|at Object\.|Exception:|<!DOCTYPE|<html|Failed to generate upload URL:/i

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Let the browser set multipart boundary; default application/json breaks file uploads.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

function shouldForceLogout(status: number, errorMessage: string | undefined, requestUrl: string): boolean {
  if (AUTH_REQUEST_PATTERN.test(requestUrl)) {
    return false
  }
  if (status === 401) {
    return true
  }
  if (status === 403 && errorMessage === 'Account deactivated') {
    return true
  }
  if (errorMessage === 'Token has been revoked') {
    return true
  }
  return false
}

function redirectToLogin() {
  const { pathname, search } = window.location
  if (PUBLIC_AUTH_PATHS.has(pathname)) {
    return
  }
  const next = encodeURIComponent(pathname + search)
  window.location.assign(`/login?next=${next}`)
}

function readServerError(data: unknown): string | undefined {
  if (typeof data === 'string') {
    const trimmed = data.trim()
    if (!trimmed || TECHNICAL_MESSAGE.test(trimmed) || trimmed.length > 280) return undefined
    return trimmed
  }
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const value = (data as { error?: unknown }).error
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed || TECHNICAL_MESSAGE.test(trimmed) || trimmed.length > 280) return undefined
      return trimmed
    }
  }
  return undefined
}

function isUserFacingMessage(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed || trimmed.length > 280) return false
  return !TECHNICAL_MESSAGE.test(trimmed)
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status
      const requestUrl = error.config?.url ?? ''
      const errorMessage = readServerError(error.response.data)

      if (shouldForceLogout(status, errorMessage, requestUrl)) {
        localStorage.removeItem('access_token')
        redirectToLogin()
      }
    }
    return Promise.reject(error)
  },
)

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return USER_ERROR.network
    }

    const status = error.response.status
    const serverMessage = readServerError(error.response.data)

    if (status === 401) {
      return serverMessage && isUserFacingMessage(serverMessage)
        ? serverMessage
        : USER_ERROR.unauthorized
    }
    if (status === 403) {
      return serverMessage && isUserFacingMessage(serverMessage)
        ? serverMessage
        : USER_ERROR.forbidden
    }
    if (status === 404) {
      return serverMessage && isUserFacingMessage(serverMessage)
        ? serverMessage
        : USER_ERROR.notFound
    }
    if (status === 429) {
      return serverMessage && isUserFacingMessage(serverMessage)
        ? serverMessage
        : USER_ERROR.rateLimit
    }
    if (status >= 500) {
      return USER_ERROR.server
    }
    if (status >= 400) {
      return serverMessage && isUserFacingMessage(serverMessage)
        ? serverMessage
        : USER_ERROR.validation
    }
    return USER_ERROR.generic
  }

  if (error instanceof Error) {
    return isUserFacingMessage(error.message) ? error.message : USER_ERROR.generic
  }

  return USER_ERROR.generic
}
