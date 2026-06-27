import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchCustomers } from '../../api/staff'
import type { StaffCustomer } from '../../types'

export function CustomerQuickSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StaffCustomer[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }

    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const customers = await searchCustomers(q)
        setResults(customers)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function selectCustomer(c: StaffCustomer, action: 'account' | 'receive' = 'account') {
    if (action === 'receive') {
      navigate(`/warehouse/receive?shipping_id=${encodeURIComponent(c.shipping_id)}`)
    } else {
      navigate(`/warehouse/customers/${encodeURIComponent(c.shipping_id)}`)
    }
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
        <input
          type="text"
          placeholder="Find customer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
        {loading && <span className="text-[10px] text-muted">…</span>}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => selectCustomer(c, 'account')}
                className="w-full px-3 py-2 text-left hover:bg-boss-green/10"
              >
                <p className="text-sm font-medium">{c.full_name}</p>
                <p className="text-xs text-muted">{c.shipping_id}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
