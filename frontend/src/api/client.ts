import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const AUTH_REQUEST_PATTERN =
  /\/auth\/(?:login|register|forgot-password|reset-password|logout|google(?:\/complete)?)/

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/signup/google',
  '/forgot-password',
  '/reset-password',
])

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status
      const requestUrl = error.config?.url ?? ''
      const errorMessage =
        typeof error.response.data === 'object' &&
        error.response.data !== null &&
        'error' in error.response.data &&
        typeof (error.response.data as { error?: unknown }).error === 'string'
          ? (error.response.data as { error: string }).error
          : undefined

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
    return error.response?.data?.error || error.message || 'Something went wrong'
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}
