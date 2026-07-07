import { PackageSearch } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../../api/client'
import { PACKAGE_SEARCH_MIN_LENGTH, searchPackages, type PackageSearchMatch } from '../../api/staff'
import { StatusBadge } from './StatusBadge'

export function PackageQuickSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<PackageSearchMatch[]>([])
  const [truncated, setTruncated] = useState(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < PACKAGE_SEARCH_MIN_LENGTH) {
      setMatches([])
      setTruncated(false)
      setError('')
      setOpen(false)
      return
    }

    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await searchPackages(q)
        setMatches(data.matches)
        setTruncated(data.truncated)
        setOpen(true)
      } catch (err) {
        setMatches([])
        setTruncated(false)
        setError(getErrorMessage(err))
        setOpen(true)
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

  function selectMatch(match: PackageSearchMatch) {
    navigate(
      `/warehouse/status?scan=${encodeURIComponent(match.package.tracking_number)}`,
    )
    setQuery('')
    setMatches([])
    setOpen(false)
    setError('')
  }

  const qLen = query.trim().length
  const showHint = qLen > 0 && qLen < PACKAGE_SEARCH_MIN_LENGTH

  return (
    <div ref={containerRef} className="relative z-50 w-full min-w-[12rem] max-w-sm">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
        <PackageSearch className="h-3.5 w-3.5 shrink-0 text-muted" />
        <input
          type="text"
          placeholder="Track package (5+ chars)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => (matches.length > 0 || error) && setOpen(true)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span className="text-[10px] text-muted">…</span>}
      </div>

      {showHint && (
        <p className="absolute left-0 top-full z-50 mt-1 px-1 text-[10px] text-muted">
          Type {PACKAGE_SEARCH_MIN_LENGTH - qLen} more character{PACKAGE_SEARCH_MIN_LENGTH - qLen === 1 ? '' : 's'}
        </p>
      )}

      {open && qLen >= PACKAGE_SEARCH_MIN_LENGTH && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {loading && (
            <p className="px-3 py-2 text-sm text-muted">Searching…</p>
          )}
          {!loading && error && (
            <p className="px-3 py-2 text-sm text-red-400">{error}</p>
          )}
          {!loading && !error && matches.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted">No packages found</p>
          )}
          {!loading && !error && matches.length > 0 && (
            <ul className="max-h-64 overflow-y-auto">
              {matches.map((match) => (
                <li key={match.package.id}>
                  <button
                    type="button"
                    onClick={() => selectMatch(match)}
                    className="w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-boss-gold/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-sm font-semibold text-boss-gold">
                        {match.package.tracking_number}
                      </p>
                      <StatusBadge status={match.package.status} label={match.package.status_label} />
                    </div>
                    {match.package.carrier_tracking && (
                      <p className="mt-0.5 font-mono text-xs text-muted">
                        {match.package.carrier_tracking}
                        {match.match_field === 'carrier_tracking' && match.match_type === 'partial' && (
                          <span className="ml-1 text-[10px] uppercase text-boss-gold/80">partial</span>
                        )}
                      </p>
                    )}
                    {match.package.customer && (
                      <p className="mt-0.5 text-xs text-muted">
                        {match.package.customer.full_name} · {match.package.customer.shipping_id}
                      </p>
                    )}
                    {match.package.shipper_label && (
                      <p className="text-[10px] text-muted">{match.package.shipper_label}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {truncated && !loading && !error && (
            <p className="border-t border-border px-3 py-1.5 text-[10px] text-muted">
              Many matches — keep typing to narrow
            </p>
          )}
        </div>
      )}
    </div>
  )
}
