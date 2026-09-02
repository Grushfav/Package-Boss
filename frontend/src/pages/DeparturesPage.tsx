import { ChevronLeft, Plane, Plus, ScanLine, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import {
  addPackageToShipment,
  createShipment,
  departShipment,
  fetchShipment,
  fetchShipments,
  removePackageFromShipment,
  type ShipmentSummary,
} from '../api/staff'
import { StatusBadge } from '../components/warehouse/StatusBadge'
import { useWarehouseCounts } from '../context/WarehouseCountsContext'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { formatAppDateInput } from '../lib/datetime'
import type { Package } from '../types'

function formatDateInput(date: Date): string {
  return formatAppDateInput(date)
}

function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year}`
}

function CreateDepartureForm({
  onCreated,
  onCancel,
}: {
  onCreated: (shipment: ShipmentSummary) => void
  onCancel: () => void
}) {
  const [reference, setReference] = useState('')
  const [departureDate, setDepartureDate] = useState(formatDateInput(new Date()))
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const shipment = await createShipment({
        reference: reference.trim(),
        departure_date: departureDate,
        note: note.trim() || undefined,
      })
      onCreated(shipment)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <h2 className="text-sm font-bold uppercase tracking-wide">New departure</h2>
      <p className="mt-1 text-xs text-muted">
        Group received packages before marking them in transit.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Reference</label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Flight, vessel, or batch name"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Departure date</label>
          <Input
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-muted">Note (optional)</label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Carrier, route, or internal note"
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" disabled={loading || !reference.trim()}>
          {loading ? 'Creating…' : 'Create departure'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function DepartureList({
  onSelect,
  onCreateClick,
}: {
  onSelect: (id: string) => void
  onCreateClick: () => void
}) {
  const [openShipments, setOpenShipments] = useState<ShipmentSummary[]>([])
  const [recentShipments, setRecentShipments] = useState<ShipmentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [open, recent] = await Promise.all([
        fetchShipments({ status: 'open', limit: 50 }),
        fetchShipments({ status: 'departed', limit: 10 }),
      ])
      setOpenShipments(open.shipments)
      setRecentShipments(recent.shipments)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Open departures waiting for packages or departure confirmation.
        </p>
        <Button type="button" className="inline-flex items-center gap-2" onClick={onCreateClick}>
          <Plus className="h-4 w-4" />
          New departure
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading departures…</p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
              Open ({openShipments.length})
            </h2>
            {openShipments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted">No open departures.</p>
                <Button type="button" className="mt-4" onClick={onCreateClick}>
                  Create first departure
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {openShipments.map((shipment) => (
                  <button
                    key={shipment.id}
                    type="button"
                    onClick={() => onSelect(shipment.id)}
                    className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-boss-gold/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold">{shipment.reference}</p>
                      <StatusBadge status="received" label="Open" />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatDisplayDate(shipment.departure_date)}
                    </p>
                    <p className="mt-3 text-sm">
                      {shipment.package_count} package{shipment.package_count === 1 ? '' : 's'}
                      {shipment.total_weight_lbs > 0 && (
                        <span className="text-muted"> · {shipment.total_weight_lbs} lbs</span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {recentShipments.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
                Recently departed
              </h2>
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-card text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Reference</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Packages</th>
                      <th className="px-4 py-3 font-semibold">Departed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentShipments.map((shipment) => (
                      <tr
                        key={shipment.id}
                        className="border-b border-border last:border-0 hover:bg-card/50"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="font-semibold text-boss-gold hover:underline"
                            onClick={() => onSelect(shipment.id)}
                          >
                            {shipment.reference}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatDisplayDate(shipment.departure_date)}
                        </td>
                        <td className="px-4 py-3">{shipment.package_count}</td>
                        <td className="px-4 py-3 text-xs text-muted">
                          {shipment.departed_at
                            ? new Date(shipment.departed_at).toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function DepartureDetail({ shipmentId, onBack }: { shipmentId: string; onBack: () => void }) {
  const { refresh: refreshCounts } = useWarehouseCounts()
  const scanRef = useRef<HTMLInputElement>(null)
  const [shipment, setShipment] = useState<ShipmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanValue, setScanValue] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [departLoading, setDepartLoading] = useState(false)
  const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchShipment(shipmentId)
      setShipment(data)
    } catch (err) {
      setError(getErrorMessage(err))
      setShipment(null)
    } finally {
      setLoading(false)
    }
  }, [shipmentId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (shipment?.status === 'open') {
      scanRef.current?.focus()
    }
  }, [shipment?.status])

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    const tracking = scanValue.trim()
    if (!tracking || !shipment) return

    setScanLoading(true)
    setError('')
    setSuccess('')
    try {
      await addPackageToShipment(shipment.id, tracking)
      setScanValue('')
      setSuccess(`Added ${tracking.toUpperCase()}`)
      await load()
      refreshCounts()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setScanLoading(false)
      scanRef.current?.focus()
    }
  }

  async function handleRemove(pkg: Package) {
    if (!shipment) return
    setRemoveLoadingId(pkg.id)
    setError('')
    setSuccess('')
    try {
      await removePackageFromShipment(shipment.id, pkg.id)
      setSuccess(`Removed ${pkg.tracking_number}`)
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setRemoveLoadingId(null)
    }
  }

  async function handleDepart() {
    if (!shipment) return
    const count = shipment.packages?.length ?? shipment.package_count
    if (
      !window.confirm(
        `Mark ${count} package${count === 1 ? '' : 's'} in transit on departure "${shipment.reference}"?`,
      )
    ) {
      return
    }

    setDepartLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await departShipment(shipment.id)
      setShipment(result.shipment)
      setSuccess(
        `${result.updated} package${result.updated === 1 ? '' : 's'} marked in transit.`,
      )
      refreshCounts()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDepartLoading(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading departure…</p>
  }

  if (!shipment) {
    return (
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All departures
        </button>
        <p className="text-sm text-red-400">{error || 'Departure not found.'}</p>
      </div>
    )
  }

  const packages = shipment.packages ?? []
  const isOpen = shipment.status === 'open'

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        All departures
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{shipment.reference}</h2>
            <p className="mt-1 text-sm text-muted">
              Departure {formatDisplayDate(shipment.departure_date)}
              {shipment.created_by_name && ` · Created by ${shipment.created_by_name}`}
            </p>
            {shipment.note && <p className="mt-2 text-sm">{shipment.note}</p>}
          </div>
          <StatusBadge
            status={isOpen ? 'received' : 'in_transit'}
            label={shipment.status_label}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span>
            <strong>{packages.length}</strong> packages
          </span>
          {shipment.total_weight_lbs > 0 && (
            <span>
              <strong>{shipment.total_weight_lbs}</strong> lbs total
            </span>
          )}
          {shipment.departed_at && (
            <span className="text-muted">
              Departed {new Date(shipment.departed_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}

      {isOpen && (
        <form onSubmit={handleScan} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-boss-gold" />
            <h3 className="text-sm font-bold uppercase tracking-wide">Add packages</h3>
          </div>
          <p className="mt-1 text-xs text-muted">
            Scan or enter a Boss or carrier tracking number. Package must be in received status.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              ref={scanRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder="Scan tracking number"
              className="font-mono uppercase"
              autoComplete="off"
            />
            <Button type="submit" disabled={scanLoading || !scanValue.trim()}>
              {scanLoading ? 'Adding…' : 'Add to departure'}
            </Button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="border-b border-border bg-card px-4 py-3">
          <h3 className="text-sm font-bold">Manifest</h3>
        </div>
        {packages.length === 0 ? (
          <p className="p-6 text-sm text-muted">No packages on this departure yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tracking</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Weight</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {isOpen && <th className="px-4 py-3 font-semibold" />}
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono font-semibold text-boss-gold">
                      {pkg.tracking_number}
                    </td>
                    <td className="px-4 py-3">
                      {pkg.customer ? (
                        <span>
                          {pkg.customer.full_name}
                          <span className="ml-1 text-muted">· {pkg.customer.shipping_id}</span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {pkg.actual_weight_lbs != null ? `${pkg.actual_weight_lbs} lbs` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={pkg.status} label={pkg.status_label} />
                    </td>
                    {isOpen && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={removeLoadingId === pkg.id}
                          onClick={() => handleRemove(pkg)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isOpen && packages.length > 0 && (
        <div className="sticky bottom-20 z-20 rounded-2xl border border-boss-gold/30 bg-background/95 p-4 backdrop-blur md:bottom-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Ready to ship <strong>{packages.length}</strong> package
              {packages.length === 1 ? '' : 's'} on <strong>{shipment.reference}</strong>?
            </p>
            <Button type="button" disabled={departLoading} onClick={handleDepart}>
              {departLoading ? 'Departing…' : 'Depart — mark in transit'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function DeparturesPage() {
  const { shipmentId } = useParams()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  function handleCreated(shipment: ShipmentSummary) {
    setShowCreate(false)
    navigate(`/warehouse/departures/${shipment.id}`)
  }

  if (shipmentId) {
    return (
      <div className="px-4 py-8 pb-40">
        <DepartureDetail
          shipmentId={shipmentId}
          onBack={() => navigate('/warehouse/departures')}
        />
      </div>
    )
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={Plane} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Departures</h1>
          <p className="text-sm text-muted">
            Group received packages by shipment before marking them in transit
          </p>
        </div>
      </div>

      {showCreate ? (
        <CreateDepartureForm
          onCreated={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      ) : (
        <DepartureList
          onSelect={(id) => navigate(`/warehouse/departures/${id}`)}
          onCreateClick={() => setShowCreate(true)}
        />
      )}

      <p className="mt-8 text-xs text-muted">
        Need to update individual packages without a departure?{' '}
        <Link to="/warehouse/status?preset=received" className="text-boss-gold hover:underline">
          Package status
        </Link>
      </p>
    </div>
  )
}
