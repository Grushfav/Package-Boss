import { AlertTriangle, PackageSearch, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import {
  assignUnidentifiedPackage,
  fetchUnidentifiedPackages,
  searchCustomers,
} from '../api/staff'
import { useWarehouseCounts } from '../context/WarehouseCountsContext'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import type { Package, StaffCustomer } from '../types'

export function UnidentifiedQueuePage() {
  const { refresh: refreshCounts } = useWarehouseCounts()
  const [packages, setPackages] = useState<Package[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<Package | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StaffCustomer[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignNote, setAssignNote] = useState('')
  const [assignSuccess, setAssignSuccess] = useState('')

  function loadQueue() {
    setLoading(true)
    fetchUnidentifiedPackages()
      .then(({ packages: pkgs, total: count }) => {
        setPackages(pkgs)
        setTotal(count)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadQueue()
  }, [])

  async function handleSearch() {
    const q = searchQuery.trim()
    if (q.length < 2) return

    setSearchLoading(true)
    setError('')
    try {
      const results = await searchCustomers(q)
      setSearchResults(results)
      if (results.length === 0) {
        setError('No customers found. Try BOSS ID, name, or email.')
      }
    } catch (err) {
      setError(getErrorMessage(err))
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleAssign(customer: StaffCustomer) {
    if (!selected) return

    setAssignLoading(true)
    setError('')
    setAssignSuccess('')
    try {
      const { pre_alert_matched } = await assignUnidentifiedPackage(
        selected.id,
        customer.shipping_id,
        assignNote || undefined,
      )
      setSelected(null)
      setSearchQuery('')
      setSearchResults([])
      setAssignNote('')
      if (pre_alert_matched) {
        setAssignSuccess(
          `Assigned and matched pre-alert ${pre_alert_matched.carrier_tracking}${
            pre_alert_matched.invoice_url ? ' (invoice attached)' : ''
          }.`,
        )
      } else {
        setAssignSuccess(`Package assigned to ${customer.shipping_id}.`)
      }
      loadQueue()
      refreshCounts()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setAssignLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={PackageSearch} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Unidentified Queue</h1>
          <p className="text-sm text-muted">
            Packages with no matching BOSS ID or customer name
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading queue...</p>
      ) : packages.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-4 font-semibold">Queue is empty</p>
          <p className="mt-2 text-sm text-muted">
            Packages without a matched owner appear here after receival.
          </p>
          <Link to="/warehouse/receive" className="mt-4 inline-block text-sm text-boss-gold hover:underline">
            Receive a package →
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">{total} package{total === 1 ? '' : 's'} awaiting owner</p>
          <ul className="space-y-3">
            {packages.map((pkg) => (
              <li
                key={pkg.id}
                className={`rounded-xl border bg-card p-4 transition-colors ${
                  selected?.id === pkg.id
                    ? 'border-boss-gold/50 ring-1 ring-boss-gold/30'
                    : 'border-border'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono font-bold">{pkg.tracking_number}</p>
                    <p className="mt-1 text-sm text-muted">
                      {pkg.label_name && <>Label: {pkg.label_name}</>}
                      {pkg.label_name && pkg.label_boss_id && ' · '}
                      {pkg.label_boss_id && <>BOSS ID: {pkg.label_boss_id}</>}
                      {!pkg.label_name && !pkg.label_boss_id && 'No label details recorded'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {pkg.shipper_label || pkg.shipper} · {pkg.billable_weight_lbs} lbs
                      {pkg.carrier_tracking && <> · {pkg.carrier_tracking}</>}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Received {new Date(pkg.received_at || pkg.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={selected?.id === pkg.id ? 'primary' : 'outline'}
                    onClick={() => {
                      setSelected(selected?.id === pkg.id ? null : pkg)
                      setSearchResults([])
                      setSearchQuery('')
                      setAssignNote('')
                    }}
                    className="!text-xs"
                  >
                    {selected?.id === pkg.id ? 'Cancel' : 'Assign owner'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && (
        <div className="mt-8 rounded-2xl border border-boss-gold/30 bg-boss-gold/5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-boss-gold">
            <UserCheck className="h-4 w-4" />
            Assign {selected.tracking_number}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Search for the correct customer, then assign ownership.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              label="Customer search"
              placeholder="Name or BOSS ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleSearch}
              disabled={searchLoading || searchQuery.trim().length < 2}
              className="sm:self-end"
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          <Input
            label="Note (optional)"
            placeholder="How the owner was identified"
            value={assignNote}
            onChange={(e) => setAssignNote(e.target.value)}
            className="mt-4"
          />

          {searchResults.length > 0 && (
            <ul className="mt-4 space-y-2">
              {searchResults.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
                >
                  <div>
                    <p className="font-semibold">{c.full_name}</p>
                    <p className="text-sm text-muted">
                      {c.shipping_id} · {c.parish}
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={assignLoading}
                    onClick={() => handleAssign(c)}
                    className="!text-xs"
                  >
                    {assignLoading ? 'Assigning...' : 'Assign'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {assignSuccess && (
        <p className="mt-4 rounded-lg bg-boss-green/10 px-4 py-3 text-sm text-boss-green">{assignSuccess}</p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
