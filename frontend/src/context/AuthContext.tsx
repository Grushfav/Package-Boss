import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/client'
import { getHomeRoute } from '../lib/routing'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  homeRoute: string
  setSession: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setSession = useCallback((token: string, nextUser: User) => {
    localStorage.setItem('access_token', token)
    setUser(nextUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }
    try {
      const { data } = await api.get<{ user: User }>('/me')
      setUser(data.user)
    } catch {
      logout()
    } finally {
      setIsLoading(false)
    }
  }, [logout])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  useEffect(() => {
    function handleFocus() {
      if (localStorage.getItem('access_token')) {
        refreshUser()
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refreshUser])

  const homeRoute = getHomeRoute(user?.role)

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      homeRoute,
      setSession,
      logout,
      refreshUser,
    }),
    [user, isLoading, homeRoute, setSession, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
