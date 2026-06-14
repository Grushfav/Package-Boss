import {
  Barcode,
  Camera,
  PackagePlus,
  Printer,
  RotateCcw,
  Search,
  UserCheck,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { fetchShippers, lookupCustomer, receivePackage, searchCustomers } from '../api/staff'
import { printShippingLabel, ShippingLabel } from '../components/warehouse/ShippingLabel'
import { uploadPhotoToR2 } from '../lib/uploadToR2'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import type { Package, Shipper, StaffCustomer } from '../types'

type ReceiveStep = 'idle' | 'receiving' | 'complete'

export function ReceivePage() {
  const [searchParams] = useSearchParams()
  const scanInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<ReceiveStep>('idle')
  const [shippers, setShippers] = useState<Shipper[]>([])

  const [scanValue, setScanValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StaffCustomer[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [customer, setCustomer] = useState<StaffCustomer | null>(null)
  const [carrierTracking, setCarrierTracking] = useState('')
  const [shipper, setShipper] = useState('usps')
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [error, setError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [completedPackage, setCompletedPackage] = useState<Package | null>(null)

  useEffect(() => {
    fetchShippers().then(setShippers).catch(() => {})
  }, [])

  useEffect(() => {
    const shippingId = searchParams.get('shipping_id')?.trim().toUpperCase()
    if (!shippingId) return

    let cancelled = false
    lookupCustomer(shippingId)
      .then((selected) => {
        if (!cancelled) {
          setCustomer(selected)
          setStep('receiving')
          setError('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(`Customer ${shippingId} not found.`)
        }
      })

    return () => {
      cancelled = true
    }
  }, [searchParams])

  useEffect(() => {
    if (step === 'idle') {
      scanInputRef.current?.focus()
    }
  }, [step])

  function resetAll() {
    setStep('idle')
    setScanValue('')
    setSearchQuery('')
    setSearchResults([])
    setCustomer(null)
    setCarrierTracking('')
    setShipper('usps')
    setWeight('')
    setNote('')
    setPhotoFile(null)
    setError('')
    setCompletedPackage(null)
  }

  function startFromScan() {
    const tracking = scanValue.trim()
    if (!tracking) return
    setCarrierTracking(tracking.toUpperCase())
    setCustomer(null)
    setStep('receiving')
    setError('')
  }

  function handleScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      startFromScan()
    }
  }

  function startFromCustomer(selected: StaffCustomer) {
    setCustomer(selected)
    setStep('receiving')
    setError('')
  }

  async function handleSearch() {
    const q = searchQuery.trim()
    if (q.length < 2) return

    setError('')
    setSearchLoading(true)
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

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) {
      setError('Select a customer before completing receival.')
      return
    }

    setError('')
    setSubmitLoading(true)

    try {
      const photoKeys: string[] = []
      if (photoFile) {
        const key = await uploadPhotoToR2(photoFile, customer.shipping_id)
        photoKeys.push(key)
      }

      const result = await receivePackage({
        shipping_id: customer.shipping_id,
        actual_weight_lbs: parseFloat(weight),
        shipper,
        carrier_tracking: carrierTracking.trim() || undefined,
        photo_keys: photoKeys,
        note: note || undefined,
      })

      setCompletedPackage(result)
      setCustomer(result.customer || customer)
      setStep('complete')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitLoading(false)
    }
  }

  const canComplete = Boolean(customer && shipper && weight)

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-2">
        <Link to="/warehouse" className="text-sm text-muted hover:text-boss-green">
          ← Warehouse
        </Link>
      </div>
      <div className="mb-8 flex items-center gap-2.5">
        <IconBadge icon={PackagePlus} size="sm" />
        <h1 className="text-2xl font-black uppercase">Receive Package</h1>
      </div>

      {step === 'idle' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-boss-green/30 bg-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-boss-green">
              <Barcode className="h-4 w-4" />
              Scan carrier barcode
            </h2>
            <p className="mt-2 text-sm text-muted">
              Scan the USPS, UPS, or FedEx label on the incoming package.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                ref={scanInputRef}
                label="Carrier tracking number"
                placeholder="Scan or type tracking number"
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={handleScanKeyDown}
              />
              <Button
                type="button"
                fullWidth
                disabled={!scanValue.trim()}
                onClick={startFromScan}
              >
                Start receival from scan
              </Button>
            </div>
          </div>

          <div className="relative text-center">
            <span className="bg-background px-3 text-xs font-semibold uppercase tracking-widest text-muted">
              or find customer
            </span>
            <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-boss-green">
              <Search className="h-4 w-4" />
              Find customer
            </h2>
            <p className="mt-2 text-sm text-muted">
              Search by name, BOSS ID, email, or phone — or{' '}
              <Link to="/warehouse/customers" className="text-boss-green hover:underline">
                browse all customers
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Input
                ref={searchInputRef}
                label="Customer search"
                placeholder="Jane Doe or BOSS-90009"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleSearch}
                disabled={searchLoading || searchQuery.trim().length < 2}
                className="inline-flex items-center justify-center gap-2 sm:self-end"
              >
                <Search className="h-4 w-4" />
                {searchLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <ul className="mt-4 space-y-3">
                {searchResults.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4"
                  >
                    <div>
                      <p className="font-semibold">{c.full_name}</p>
                      <p className="text-sm text-muted">
                        {c.shipping_id} · {c.parish} · {c.email}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => startFromCustomer(c)}
                      className="!text-xs"
                    >
                      Start receival
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {step === 'receiving' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-boss-green/30 bg-boss-green/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-boss-green">
              Active receival
            </p>
            {customer ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-boss-green" />
                  <div>
                    <p className="font-bold">{customer.full_name}</p>
                    <p className="text-sm text-muted">
                      {customer.shipping_id} · {customer.parish}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomer(null)}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Change customer
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-muted">Find customer to attach this package.</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <Input
                    label="Customer search"
                    placeholder="Name or BOSS ID"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                    className="flex-1"
                  />
                  <Button type="button" onClick={handleSearch} disabled={searchLoading} className="sm:self-end">
                    Search
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {searchResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomer(c)
                            setSearchResults([])
                          }}
                          className="w-full rounded-lg border border-border bg-background p-3 text-left hover:border-boss-green/40"
                        >
                          <p className="font-semibold">{c.full_name}</p>
                          <p className="text-sm text-muted">{c.shipping_id}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {carrierTracking && (
              <p className="mt-3 font-mono text-sm">
                <span className="text-muted">Carrier:</span> {carrierTracking}
              </p>
            )}
          </div>

          <form onSubmit={handleReceive} className="rounded-2xl border border-border bg-card p-6 space-y-4">
            {!carrierTracking && (
              <Input
                label="Carrier tracking (scan or type)"
                placeholder="USPS / UPS / FedEx number"
                value={carrierTracking}
                onChange={(e) => setCarrierTracking(e.target.value.toUpperCase())}
              />
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                Shipper
              </label>
              <select
                value={shipper}
                onChange={(e) => setShipper(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-green focus:outline-none focus:ring-1 focus:ring-boss-green"
              >
                {shippers.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Actual weight (lbs)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="7.3"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
            />

            <Input
              label="Note (optional)"
              placeholder="Fragile, oversized, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                Package photo (optional)
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-6 transition-colors hover:border-boss-green">
                <Camera className="h-5 w-5 text-muted" />
                <span className="text-sm text-muted">
                  {photoFile ? photoFile.name : 'JPEG, PNG, or WebP'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" onClick={resetAll} className="inline-flex items-center justify-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" fullWidth disabled={submitLoading || !canComplete}>
                {submitLoading ? 'Completing...' : 'Complete receival & generate label'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {step === 'complete' && completedPackage && customer && (
        <div className="space-y-6">
          <div className="rounded-lg border border-boss-green/30 bg-boss-green/10 p-4 text-center">
            <p className="font-bold text-boss-green">Receival complete</p>
            <p className="mt-1 font-mono text-lg">{completedPackage.tracking_number}</p>
          </div>

          <ShippingLabel pkg={completedPackage} customer={customer} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={printShippingLabel}
              className="inline-flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print label
            </Button>
            <Button type="button" variant="outline" fullWidth onClick={resetAll}>
              Receive next package
            </Button>
          </div>

          <Link
            to={`/track?tracking=${completedPackage.tracking_number}`}
            className="block text-center text-sm text-boss-green hover:underline"
          >
            View tracking page →
          </Link>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
