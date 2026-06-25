import { MapPin, PackageSearch, Scale, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { trackPackage } from '../api/track'
import { PackageTimeline } from '../components/packages/PackageTimeline'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { packageNeedsInvoiceUpload } from '../lib/packageBilling'
import { getHomeRoute } from '../lib/routing'
import type { Package } from '../types'

export function TrackPage() {
  const { user, isAuthenticated } = useAuth()
  const isCustomer = !user?.role || user.role === 'customer'

  if (isAuthenticated && !isCustomer) {
    return <Navigate to={getHomeRoute(user?.role)} replace />
  }

  return <TrackPageContent />
}

export function TrackPageContent({ embedded = false }: { embedded?: boolean } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [trackingNumber, setTrackingNumber] = useState(searchParams.get('tracking') || '')
  const [pkg, setPkg] = useState<Package | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleTrack(value?: string) {
    const number = (value ?? trackingNumber).trim().toUpperCase()
    if (!number) return

    setError('')
    setLoading(true)
    setPkg(null)

    try {
      const result = await trackPackage(number)
      setPkg(result)
      setSearchParams({ tracking: number })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fromUrl = searchParams.get('tracking')
    if (fromUrl) {
      setTrackingNumber(fromUrl)
      handleTrack(fromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={embedded ? '' : 'mx-auto max-w-3xl px-4 py-12'}>
      <div className={`mb-8 flex items-center gap-2.5 ${embedded ? 'mb-6' : ''}`}>
        {!embedded && <IconBadge icon={PackageSearch} size="sm" />}
        {embedded ? (
          <h2 className="text-lg font-bold uppercase tracking-wide">Track Package</h2>
        ) : (
          <h1 className="text-2xl font-black uppercase">Track Package</h1>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleTrack()
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <Input
          label="Tracking Number"
          placeholder="PB-2026-000001"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !trackingNumber.trim()} className="sm:self-end">
          {loading ? 'Searching...' : 'Track'}
        </Button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {pkg && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-boss-green/30 bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Tracking Number</p>
                <p className="mt-1 font-mono text-lg font-bold text-boss-green">
                  {pkg.tracking_number}
                </p>
              </div>
              <span className="rounded-full bg-boss-green/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-boss-green">
                {pkg.status_label}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
                <MapPin className="h-5 w-5 text-muted" />
                <div>
                  <p className="text-xs text-muted">Route</p>
                  <p className="text-sm font-semibold">
                    {pkg.origin || 'Miami, FL'} → {pkg.destination || 'Kingston, Jamaica'}
                  </p>
                </div>
              </div>
              {pkg.billable_weight_lbs != null && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
                  <Scale className="h-5 w-5 text-muted" />
                  <div>
                    <p className="text-xs text-muted">Billable Weight</p>
                    <p className="text-sm font-semibold">{pkg.billable_weight_lbs} lbs</p>
                  </div>
                </div>
              )}
              {pkg.estimated_freight_usd != null && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
                  <Truck className="h-5 w-5 text-muted" />
                  <div>
                    <p className="text-xs text-muted">Freight estimate</p>
                    <p className="text-sm font-semibold">${pkg.estimated_freight_usd.toFixed(2)} USD</p>
                  </div>
                </div>
              )}
              {(pkg.billing_status === 'ready' || pkg.billing_status === 'paid') &&
                pkg.total_due_usd != null && (
                  <div className="flex items-center gap-3 rounded-lg border border-boss-green/30 bg-boss-green/5 p-4 sm:col-span-2">
                    <Truck className="h-5 w-5 text-boss-green" />
                    <p className="text-xs text-muted">{pkg.billing_status_label}</p>
                    <p className="text-sm font-bold text-boss-green">
                      ${pkg.total_due_usd.toFixed(2)} USD
                    </p>
                  </div>
                )}
            </div>

            {packageNeedsInvoiceUpload(pkg) && (
              <Link
                to={`/packages/${pkg.id}/upload-invoice`}
                className="mt-4 inline-block rounded-lg bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300"
              >
                Upload invoice →
              </Link>
            )}

            {pkg.billing_status === 'pending' && pkg.estimated_freight_usd != null && (
              <p className="mt-4 text-xs text-muted">
                Freight shown is an estimate only. Final bill may include duties (items over $100
                USD), handling, and other fees after invoice review.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">
              Shipment Timeline
            </h2>
            <div className="mt-6">
              <PackageTimeline
                events={pkg.timeline || pkg.events || []}
                currentStatus={pkg.status}
              />
            </div>
          </div>

          {pkg.photos && pkg.photos.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-boss-green">
                Package Photos
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {pkg.photos.map((photo) =>
                  photo.url ? (
                    <img
                      key={photo.id}
                      src={photo.url}
                      alt="Package"
                      className="rounded-lg border border-border object-cover"
                    />
                  ) : null,
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
