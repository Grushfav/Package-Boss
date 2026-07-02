import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface CommandItem {
  id: string
  label: string
  description?: string
  path: string
  keywords?: string
}

const COMMANDS: CommandItem[] = [
  { id: 'receive', label: 'Receive package', path: '/warehouse/receive', keywords: 'scan barcode' },
  { id: 'inbox', label: 'Floor', path: '/warehouse', keywords: 'home dashboard operations' },
  { id: 'print', label: 'Print queue', path: '/warehouse/print-queue', keywords: 'labels' },
  { id: 'unidentified', label: 'Unidentified queue', path: '/warehouse/unidentified', keywords: 'misc assign' },
  { id: 'status', label: 'Update status', path: '/warehouse/status', keywords: 'bulk transit' },
  { id: 'customers', label: 'Customer directory', path: '/warehouse/customers', keywords: 'browse search' },
  { id: 'activity', label: 'Activity log', path: '/warehouse/activity', keywords: 'history audit' },
]

export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    function onOpenEvent() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('warehouse:command-palette', onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('warehouse:command-palette', onOpenEvent)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.path.toLowerCase().includes(q) ||
        c.keywords?.toLowerCase().includes(q),
    )
  }, [query])

  function go(path: string) {
    navigate(path)
    setOpen(false)
    setQuery('')
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted" />
          <input
            autoFocus
            type="text"
            placeholder="Jump to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered[0]) go(filtered[0].path)
            }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No matches</li>
          ) : (
            filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(item.path)}
                  className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-boss-green/10"
                >
                  <span className="text-sm font-semibold">{item.label}</span>
                  {item.description && (
                    <span className="text-xs text-muted">{item.description}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('warehouse:command-palette'))
}
