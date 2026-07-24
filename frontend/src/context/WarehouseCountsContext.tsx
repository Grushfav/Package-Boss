import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react'
import { fetchWarehouseSummary, type WarehouseSummary } from '../api/staff'

interface WarehouseCountsContextValue {
  counts: WarehouseSummary | null
  refresh: () => Promise<void>
}

const WAREHOUSE_COUNTS_CTX_KEY = '__packageBossWarehouseCountsContext__'

function getWarehouseCountsContext(): Context<WarehouseCountsContextValue | null> {
  const globalStore = globalThis as typeof globalThis & {
    [WAREHOUSE_COUNTS_CTX_KEY]?: Context<WarehouseCountsContextValue | null>
  }
  if (!globalStore[WAREHOUSE_COUNTS_CTX_KEY]) {
    globalStore[WAREHOUSE_COUNTS_CTX_KEY] =
      createContext<WarehouseCountsContextValue | null>(null)
  }
  return globalStore[WAREHOUSE_COUNTS_CTX_KEY]
}

const WarehouseCountsContext = getWarehouseCountsContext()

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
