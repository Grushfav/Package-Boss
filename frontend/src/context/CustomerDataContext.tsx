import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getErrorMessage } from '../api/client'
import { fetchCustomerDashboard } from '../api/dashboard'
import { fetchParishes } from '../api/auth'
import { fetchAuthorizedPickups, type AuthorizedPickupsResponse } from '../api/authorizedPickups'
import { fetchDeliveryAddresses } from '../api/deliveryAddresses'
import { fetchMyPreAlerts } from '../api/preAlerts'
import { fetchShippingAddress } from '../api/shippingAddress'
import { type RatesResponse } from '../api/rates'
import { useAuth } from './AuthContext'
import { cacheShippingAddress, clearCachedShippingAddress } from '../lib/offlineAddress'
import type { DashboardPackageStats } from '../lib/dashboardStats'
import { getActiveCachedRates, loadRates, setCachedRates } from '../lib/ratesCache'
import type { DeliveryAddress, PreAlert, ShippingAddress } from '../types'

interface CustomerDataContextValue {
  isCustomer: boolean
  isPrefetching: boolean
  dashboardStats: DashboardPackageStats | null
  dashboardLoading: boolean
  dashboardError: string | null
  invoiceActionCount: number
  packagesRevision: number
  preAlerts: PreAlert[]
  preAlertsLoading: boolean
  shippingAddress: ShippingAddress | null
  deliveryAddresses: DeliveryAddress[]
  defaultDeliveryAddress: DeliveryAddress | null
  maxDeliveryAddresses: number
  authorizedPickups: AuthorizedPickupsResponse | null
  rates: RatesResponse | null
  parishes: string[]
  refreshPackages: () => Promise<void>
  refreshPreAlerts: () => Promise<void>
  refreshShippingAddress: () => Promise<void>
  refreshDeliveryAddresses: () => Promise<void>
  refreshAuthorizedPickups: () => Promise<void>
  refreshRates: () => Promise<void>
  refreshAll: () => Promise<void>
}

const CustomerDataContext = createContext<CustomerDataContextValue | null>(null)

function isCustomerUser(role: string | undefined) {
  return !role || role === 'customer'
}

export function CustomerDataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const isCustomer = isAuthenticated && isCustomerUser(user?.role)
  const isCustomerRef = useRef(isCustomer)
  isCustomerRef.current = isCustomer

  const [isPrefetching, setIsPrefetching] = useState(false)
  const [dashboardStats, setDashboardStats] = useState<DashboardPackageStats | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [invoiceActionCount, setInvoiceActionCount] = useState(0)
  const [packagesRevision, setPackagesRevision] = useState(0)
  const [preAlerts, setPreAlerts] = useState<PreAlert[]>([])
  const [preAlertsLoading, setPreAlertsLoading] = useState(false)
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null)
  const [deliveryAddresses, setDeliveryAddresses] = useState<DeliveryAddress[]>([])
  const [defaultDeliveryAddress, setDefaultDeliveryAddress] = useState<DeliveryAddress | null>(null)
  const [maxDeliveryAddresses, setMaxDeliveryAddresses] = useState(4)
  const [authorizedPickups, setAuthorizedPickups] = useState<AuthorizedPickupsResponse | null>(
    null,
  )
  const [rates, setRates] = useState<RatesResponse | null>(null)
  const [parishes, setParishes] = useState<string[]>([])

  const loadGeneration = useRef(0)

  const clearCustomerData = useCallback(() => {
    setDashboardStats(null)
    setDashboardLoading(false)
    setDashboardError(null)
    setInvoiceActionCount(0)
    setPackagesRevision(0)
    setPreAlerts([])
    setShippingAddress(null)
    setDeliveryAddresses([])
    setDefaultDeliveryAddress(null)
    setMaxDeliveryAddresses(4)
    setAuthorizedPickups(null)
    setRates(null)
    setParishes([])
    setPreAlertsLoading(false)
    setIsPrefetching(false)
    clearCachedShippingAddress()
  }, [])

  const refreshPreAlerts = useCallback(async () => {
    setPreAlertsLoading(true)
    try {
      const data = await fetchMyPreAlerts()
      if (!isCustomerRef.current) return
      setPreAlerts(data)
    } catch {
      if (!isCustomerRef.current) return
      setPreAlerts([])
    } finally {
      if (isCustomerRef.current) setPreAlertsLoading(false)
    }
  }, [])

  const refreshShippingAddress = useCallback(async () => {
    try {
      const data = await fetchShippingAddress()
      if (!isCustomerRef.current) return
      setShippingAddress(data)
      cacheShippingAddress(data)
    } catch {
      if (!isCustomerRef.current) return
      setShippingAddress(null)
    }
  }, [])

  const refreshDeliveryAddresses = useCallback(async () => {
    try {
      const { addresses, max_addresses } = await fetchDeliveryAddresses()
      if (!isCustomerRef.current) return
      setDeliveryAddresses(addresses)
      setMaxDeliveryAddresses(max_addresses)
      setDefaultDeliveryAddress(addresses.find((address) => address.is_default) ?? null)
    } catch {
      if (!isCustomerRef.current) return
      setDeliveryAddresses([])
      setDefaultDeliveryAddress(null)
      setMaxDeliveryAddresses(4)
    }
  }, [])

  const refreshAuthorizedPickups = useCallback(async () => {
    try {
      const data = await fetchAuthorizedPickups()
      if (!isCustomerRef.current) return
      setAuthorizedPickups(data)
    } catch {
      if (!isCustomerRef.current) return
      setAuthorizedPickups(null)
    }
  }, [])

  const refreshRates = useCallback(async () => {
    const cached = getActiveCachedRates()
    if (cached) setRates(cached)
    try {
      const data = await loadRates()
      if (!isCustomerRef.current) return
      setRates(data)
      setCachedRates(data)
    } catch {
      if (!isCustomerRef.current) return
      if (!cached) setRates(null)
    }
  }, [])

  const refreshParishes = useCallback(async () => {
    try {
      const data = await fetchParishes()
      if (!isCustomerRef.current) return
      setParishes(data)
    } catch {
      if (!isCustomerRef.current) return
      setParishes([])
    }
  }, [])

  const loadDashboard = useCallback(
    async (generation: number, options?: { clearOnError?: boolean }) => {
      setDashboardLoading(true)
      setIsPrefetching(true)
      setDashboardError(null)
      try {
        const data = await fetchCustomerDashboard()
        if (loadGeneration.current !== generation) return
        setDashboardStats(data.stats)
        setInvoiceActionCount(data.invoiceActionCount)
        setDefaultDeliveryAddress(data.defaultDeliveryAddress)
        if (data.shippingAddress) {
          setShippingAddress(data.shippingAddress)
          cacheShippingAddress(data.shippingAddress)
        }
        setDashboardError(null)
      } catch (err) {
        if (loadGeneration.current !== generation) return
        setDashboardError(getErrorMessage(err))
        if (options?.clearOnError) {
          setDashboardStats(null)
          setInvoiceActionCount(0)
        }
      } finally {
        if (loadGeneration.current === generation) {
          setDashboardLoading(false)
          setIsPrefetching(false)
        }
      }
    },
    [],
  )

  const refreshPackages = useCallback(async () => {
    setPackagesRevision((current) => current + 1)
    const generation = ++loadGeneration.current
    await loadDashboard(generation)
  }, [loadDashboard])

  const refreshBackground = useCallback(async () => {
    await Promise.allSettled([
      refreshPreAlerts(),
      refreshShippingAddress(),
      refreshDeliveryAddresses(),
      refreshAuthorizedPickups(),
      refreshRates(),
      refreshParishes(),
    ])
  }, [
    refreshAuthorizedPickups,
    refreshDeliveryAddresses,
    refreshParishes,
    refreshPreAlerts,
    refreshRates,
    refreshShippingAddress,
  ])

  const refreshAll = useCallback(async () => {
    if (!isCustomerRef.current) return
    const generation = ++loadGeneration.current
    setPackagesRevision((current) => current + 1)
    await loadDashboard(generation, { clearOnError: true })
    if (loadGeneration.current !== generation) return
    await refreshBackground()
  }, [loadDashboard, refreshBackground])

  useEffect(() => {
    if (!isCustomer) {
      loadGeneration.current += 1
      clearCustomerData()
      return
    }

    const before = loadGeneration.current
    void refreshAll()
    return () => {
      if (loadGeneration.current === before + 1) {
        loadGeneration.current += 1
      }
    }
  }, [isCustomer, user?.id, clearCustomerData, refreshAll])

  const value = useMemo(
    () => ({
      isCustomer,
      isPrefetching,
      dashboardStats,
      dashboardLoading,
      dashboardError,
      invoiceActionCount,
      packagesRevision,
      preAlerts,
      preAlertsLoading,
      shippingAddress,
      deliveryAddresses,
      defaultDeliveryAddress,
      maxDeliveryAddresses,
      authorizedPickups,
      rates,
      parishes,
      refreshPackages,
      refreshPreAlerts,
      refreshShippingAddress,
      refreshDeliveryAddresses,
      refreshAuthorizedPickups,
      refreshRates,
      refreshAll,
    }),
    [
      isCustomer,
      isPrefetching,
      dashboardStats,
      dashboardLoading,
      dashboardError,
      invoiceActionCount,
      packagesRevision,
      preAlerts,
      preAlertsLoading,
      shippingAddress,
      deliveryAddresses,
      defaultDeliveryAddress,
      maxDeliveryAddresses,
      authorizedPickups,
      rates,
      parishes,
      refreshPackages,
      refreshPreAlerts,
      refreshShippingAddress,
      refreshDeliveryAddresses,
      refreshAuthorizedPickups,
      refreshRates,
      refreshAll,
    ],
  )

  return <CustomerDataContext.Provider value={value}>{children}</CustomerDataContext.Provider>
}

export function useCustomerData() {
  const ctx = useContext(CustomerDataContext)
  if (!ctx) throw new Error('useCustomerData must be used within CustomerDataProvider')
  return ctx
}

/** Safe for components that may render outside the customer dashboard. */
export function useOptionalCustomerData() {
  return useContext(CustomerDataContext)
}
