import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchWarehouseSummary, type WarehouseSummary } from '../api/staff'

interface WarehouseCountsContextValue {
  counts: WarehouseSummary | null
  refresh: () => Promise<void>
}

const WarehouseCountsContext = createContext<WarehouseCountsContextValue | null>(null)

export function WarehouseCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<WarehouseSummary | null>(null)

  const refresh = useCallback(async () => {
    try {
      const summary = await fetchWarehouseSummary()
      setCounts(summary)
    } catch {
      setCounts(null)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(refresh, 30_000)
    return () => window.clearInterval(interval)
  }, [refresh])

  const value = useMemo(() => ({ counts, refresh }), [counts, refresh])

  return (
    <WarehouseCountsContext.Provider value={value}>
      {children}
    </WarehouseCountsContext.Provider>
  )
}

export function useWarehouseCounts() {
  const ctx = useContext(WarehouseCountsContext)
  if (!ctx) {
    throw new Error('useWarehouseCounts must be used within WarehouseCountsProvider')
  }
  return ctx
}
