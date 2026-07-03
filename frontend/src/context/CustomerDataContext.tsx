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
import { fetchParishes } from '../api/auth'
import { fetchAuthorizedPickups, type AuthorizedPickupsResponse } from '../api/authorizedPickups'
import { fetchDeliveryAddresses } from '../api/deliveryAddresses'
import { fetchMyPackages } from '../api/packages'
import { fetchMyPreAlerts } from '../api/preAlerts'
import { fetchShippingAddress } from '../api/shippingAddress'
import { type RatesResponse } from '../api/rates'
import { useAuth } from './AuthContext'
import { cacheShippingAddress, clearCachedShippingAddress } from '../lib/offlineAddress'
import { loadRates, setCachedRates } from '../lib/ratesCache'
import type { DeliveryAddress, Package, PreAlert, ShippingAddress } from '../types'

interface CustomerDataContextValue {
  isCustomer: boolean
  isPrefetching: boolean
  packages: Package[]
  packagesLoading: boolean
  preAlerts: PreAlert[]
  preAlertsLoading: boolean
  shippingAddress: ShippingAddress | null
  deliveryAddresses: DeliveryAddress[]
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

  const [isPrefetching, setIsPrefetching] = useState(false)
  const [packages, setPackages] = useState<Package[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [preAlerts, setPreAlerts] = useState<PreAlert[]>([])
  const [preAlertsLoading, setPreAlertsLoading] = useState(false)
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null)
  const [deliveryAddresses, setDeliveryAddresses] = useState<DeliveryAddress[]>([])
  const [maxDeliveryAddresses, setMaxDeliveryAddresses] = useState(4)
  const [authorizedPickups, setAuthorizedPickups] = useState<AuthorizedPickupsResponse | null>(
    null,
  )
  const [rates, setRates] = useState<RatesResponse | null>(null)
  const [parishes, setParishes] = useState<string[]>([])

  const prefetchGeneration = useRef(0)

  const clearCustomerData = useCallback(() => {
    setPackages([])
    setPreAlerts([])
    setShippingAddress(null)
    setDeliveryAddresses([])
    setMaxDeliveryAddresses(4)
    setAuthorizedPickups(null)
    setRates(null)
    setParishes([])
    setPackagesLoading(false)
    setPreAlertsLoading(false)
    setIsPrefetching(false)
    clearCachedShippingAddress()
  }, [])

  const refreshPackages = useCallback(async () => {
    setPackagesLoading(true)
    try {
      const data = await fetchMyPackages()
      setPackages(data)
    } catch {
      setPackages([])
    } finally {
      setPackagesLoading(false)
    }
  }, [])

  const refreshPreAlerts = useCallback(async () => {
    setPreAlertsLoading(true)
    try {
      const data = await fetchMyPreAlerts()
      setPreAlerts(data)
    } catch {
      setPreAlerts([])
    } finally {
      setPreAlertsLoading(false)
    }
  }, [])

  const refreshShippingAddress = useCallback(async () => {
    try {
      const data = await fetchShippingAddress()
      setShippingAddress(data)
      cacheShippingAddress(data)
    } catch {
      setShippingAddress(null)
    }
  }, [])

  const refreshDeliveryAddresses = useCallback(async () => {
    try {
      const { addresses, max_addresses } = await fetchDeliveryAddresses()
      setDeliveryAddresses(addresses)
      setMaxDeliveryAddresses(max_addresses)
    } catch {
      setDeliveryAddresses([])
    }
  }, [])

  const refreshAuthorizedPickups = useCallback(async () => {
    try {
      const data = await fetchAuthorizedPickups()
      setAuthorizedPickups(data)
    } catch {
      setAuthorizedPickups(null)
    }
  }, [])

  const refreshRates = useCallback(async () => {
    try {
      const data = await loadRates()
      setRates(data)
    } catch {
      setRates(null)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    if (!isCustomer) return

    setIsPrefetching(true)
    setPackagesLoading(true)
    setPreAlertsLoading(true)

    const results = await Promise.allSettled([
      fetchMyPackages(),
      fetchMyPreAlerts(),
      fetchShippingAddress(),
      fetchDeliveryAddresses(),
      fetchAuthorizedPickups(),
      loadRates(),
      fetchParishes(),
    ])

    if (results[0].status === 'fulfilled') setPackages(results[0].value)
    else setPackages([])

    if (results[1].status === 'fulfilled') setPreAlerts(results[1].value)
    else setPreAlerts([])

    if (results[2].status === 'fulfilled') {
      setShippingAddress(results[2].value)
      cacheShippingAddress(results[2].value)
    } else {
      setShippingAddress(null)
    }

    if (results[3].status === 'fulfilled') {
      setDeliveryAddresses(results[3].value.addresses)
      setMaxDeliveryAddresses(results[3].value.max_addresses)
    } else {
      setDeliveryAddresses([])
    }

    if (results[4].status === 'fulfilled') setAuthorizedPickups(results[4].value)
    else setAuthorizedPickups(null)

    if (results[5].status === 'fulfilled') {
      setRates(results[5].value)
      setCachedRates(results[5].value)
    } else {
      setRates(null)
    }

    if (results[6].status === 'fulfilled') setParishes(results[6].value)
    else setParishes([])

    setPackagesLoading(false)
    setPreAlertsLoading(false)
    setIsPrefetching(false)
  }, [isCustomer])

  useEffect(() => {
    if (!isCustomer) {
      clearCustomerData()
      return
    }

    const generation = ++prefetchGeneration.current
    void refreshAll().then(() => {
      if (prefetchGeneration.current !== generation) return
    })
  }, [isCustomer, user?.id, clearCustomerData, refreshAll])

  const value = useMemo(
    () => ({
      isCustomer,
      isPrefetching,
      packages,
      packagesLoading,
      preAlerts,
      preAlertsLoading,
      shippingAddress,
      deliveryAddresses,
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
      packages,
      packagesLoading,
      preAlerts,
      preAlertsLoading,
      shippingAddress,
      deliveryAddresses,
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
