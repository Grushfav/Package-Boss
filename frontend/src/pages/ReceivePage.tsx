import {
  Barcode,
  Camera,
  Clock,
  PackagePlus,
  Printer,
  RotateCcw,
  Search,
  UserCheck,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import {
  fetchMyRecentReceives,
  fetchShippers,
  lookupCustomer,
  lookupPreAlertByTracking,
  markLabelsPrinted,
  receivePackage,
  receiveUnidentifiedPackage,
  searchCustomers,
  type ClerkRecentReceive,
} from '../api/staff'
import type { PreAlertLookupMatch } from '../api/staff'
import type { PreAlert } from '../types'
import { markPrintedAfterPrint, ShippingLabel } from '../components/warehouse/ShippingLabel'
import { useWarehouseCounts } from '../context/WarehouseCountsContext'
import { uploadPhoto, uploadUnidentifiedPhoto } from '../lib/uploadPhoto'
import { MAX_AUTO_RATE_LBS, MAX_RECEIVE_LBS } from '../lib/warehouseConstants'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import type { Package, Shipper, StaffCustomer } from '../types'

type ReceiveStep = 'idle' | 'receiving' | 'preview' | 'complete'

const RUSH_MODE_KEY = 'boss:warehouse:rush-mode'
const LAST_SHIPPER_KEY = 'boss:warehouse:last-shipper'

function readRushMode(): boolean {
  try {
    return localStorage.getItem(RUSH_MODE_KEY) === '1'
  } catch {
    return false
  }
}

function readLastShipper(): string {
  try {
    return localStorage.getItem(LAST_SHIPPER_KEY) || 'usps'
  } catch {
    return 'usps'
  }
}

export function ReceivePage() {
  const { refresh: refreshCounts } = useWarehouseCounts()
  const [searchParams] = useSearchParams()
  const scanInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const weightInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<ReceiveStep>('idle')
  const [shippers, setShippers] = useState<Shipper[]>([])
  const [rushMode, setRushMode] = useState(readRushMode)

  const [scanValue, setScanValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StaffCustomer[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [customer, setCustomer] = useState<StaffCustomer | null>(null)
  const [carrierTracking, setCarrierTracking] = useState('')
  const [shipper, setShipper] = useState(readLastShipper)
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [labelName, setLabelName] = useState('')
  const [labelBossId, setLabelBossId] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [showUnidentifiedSection, setShowUnidentifiedSection] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [completedPackage, setCompletedPackage] = useState<Package | null>(null)
  const [matchedPreAlert, setMatchedPreAlert] = useState<PreAlert | null>(null)
  const [suggestedPreAlert, setSuggestedPreAlert] = useState<PreAlert | null>(null)
  const [preAlertMatches, setPreAlertMatches] = useState<PreAlertLookupMatch[]>([])
  const [preAlertLookupLoading, setPreAlertLookupLoading] = useState(false)
  const [recentReceives, setRecentReceives] = useState<ClerkRecentReceive[]>([])
  const [recentLoading, setRecentLoading] = useState(false)
  const [previewUnidentified, setPreviewUnidentified] = useState(false)

  const loadRecentReceives = useCallback(async () => {
    setRecentLoading(true)
    try {
      const rows = await fetchMyRecentReceives(3)
      setRecentReceives(rows)
    } catch {
      setRecentReceives([])
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchShippers().then(setShippers).catch(() => {})
    loadRecentReceives()
  }, [loadRecentReceives])

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
    if (step === 'receiving' && customer) {
      weightInputRef.current?.focus()
    }
  }, [step, customer])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && step !== 'idle') {
        resetAll()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resetAll is stable enough for Esc
  }, [step])

  function toggleRushMode() {
    setRushMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem(RUSH_MODE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function updateShipper(value: string) {
    setShipper(value)
    try {
      localStorage.setItem(LAST_SHIPPER_KEY, value)
    } catch {
      /* ignore */
    }
  }

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
    setLabelName('')
    setLabelBossId('')
    setPhotoFile(null)
    setShowUnidentifiedSection(false)
    setError('')
    setSuccess('')
    setCompletedPackage(null)
    setMatchedPreAlert(null)
    setSuggestedPreAlert(null)
    setPreAlertMatches([])
    setPreAlertLookupLoading(false)
    setPreviewUnidentified(false)
  }

  function applyPreAlertMatches(matches: PreAlertLookupMatch[]) {
    if (matches.length === 0) {
      setSuggestedPreAlert(null)
      setPreAlertMatches([])
      return
    }

    const uniqueCustomers = new Map<string, PreAlertLookupMatch>()
    for (const match of matches) {
      const existing = uniqueCustomers.get(match.customer.id)
      if (!existing || match.match_score > existing.match_score) {
        uniqueCustomers.set(match.customer.id, match)
      }
    }

    const options = Array.from(uniqueCustomers.values())
    if (options.length === 1) {
      setCustomer(options[0].customer)
      setSuggestedPreAlert(options[0].pre_alert)
      setPreAlertMatches([])
      setShowUnidentifiedSection(false)
      return
    }

    setSuggestedPreAlert(null)
    setPreAlertMatches(options)
  }

  async function resolvePreAlertForTracking(tracking: string) {
    const normalized = tracking.trim()
    if (normalized.length < 8) {
      setSuggestedPreAlert(null)
      setPreAlertMatches([])
      return
    }

    setPreAlertLookupLoading(true)
    try {
      const matches = await lookupPreAlertByTracking(normalized)
      applyPreAlertMatches(matches)
    } catch {
      setSuggestedPreAlert(null)
      setPreAlertMatches([])
    } finally {
      setPreAlertLookupLoading(false)
    }
  }

  async function startFromScan() {
    const tracking = scanValue.trim()
    if (!tracking) return
    const upper = tracking.toUpperCase()
    setCarrierTracking(upper)
    setCustomer(null)
    setSuggestedPreAlert(null)
    setPreAlertMatches([])
    setStep('receiving')
    setError('')
    setSuccess('')
    await resolvePreAlertForTracking(upper)
  }

  function handleScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      startFromScan()
    }
  }

  function startFromCustomer(selected: StaffCustomer) {
    setCustomer(selected)
    setShowUnidentifiedSection(false)
    setStep('receiving')
    setError('')
    setSuccess('')
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
        setError('No customers found. Add to the unidentified queue below if the owner cannot be matched.')
      }
    } catch (err) {
      setError(getErrorMessage(err))
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  function parseWeightLbs(): number | null {
    const lbs = parseFloat(weight)
    if (!weight || Number.isNaN(lbs) || lbs <= 0) return null
    return lbs
  }

  function validateWeight(lbs: number): string | null {
    if (lbs > MAX_RECEIVE_LBS) {
      return `Packages over ${MAX_RECEIVE_LBS} lbs cannot be received here. Contact support@packageboss.com.`
    }
    return null
  }

  function billableWeight(lbs: number): number {
    return Math.ceil(lbs)
  }

  function buildPreviewPackage(unidentified: boolean): Package {
    const lbs = parseWeightLbs() ?? 0
    const shipperLabel = shippers.find((s) => s.code === shipper)?.label ?? shipper
    return {
      id: 'preview',
      tracking_number: '',
      status: unidentified ? 'unidentified' : 'received',
      status_label: unidentified ? 'Unidentified' : 'Received',
      carrier_tracking: carrierTracking.trim() || undefined,
      label_name: labelName.trim() || undefined,
      label_boss_id: labelBossId.trim() || undefined,
      is_unidentified: unidentified,
      shipper,
      shipper_label: shipperLabel,
      actual_weight_lbs: lbs,
      billable_weight_lbs: billableWeight(lbs),
      received_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
  }

  function previewCustomer(unidentified: boolean): StaffCustomer | null {
    if (unidentified) return null
    return customer
  }

  function validateReceiveReady(unidentified: boolean): boolean {
    const lbs = parseWeightLbs()
    if (lbs == null) {
      setError('Enter a valid weight in lbs.')
      return false
    }
    const weightError = validateWeight(lbs)
    if (weightError) {
      setError(weightError)
      return false
    }
    if (!unidentified && !customer) {
      setError('Select a customer before completing receival.')
      return false
    }
    if (unidentified) {
      const hasLabelInfo =
        labelName.trim() || labelBossId.trim() || carrierTracking.trim()
      if (!hasLabelInfo) {
        setError('Enter the name on the label, BOSS ID from the label, or carrier tracking.')
        return false
      }
    }
    if (!shipper) {
      setError('Select a shipper.')
      return false
    }
    setError('')
    setSuccess('')
    setPreviewUnidentified(unidentified)
    return true
  }

  function goToPreview(unidentified: boolean) {
    if (!validateReceiveReady(unidentified)) return
    setStep('preview')
  }

  function handleCompleteDirectly() {
    const unidentified = showUnidentifiedSection && !customer
    if (!validateReceiveReady(unidentified)) return
    void handleConfirmReceive({ skipLabelView: true })
  }

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault()
    goToPreview(false)
  }

  async function handleReceiveUnidentified(e: React.FormEvent) {
    e.preventDefault()
    goToPreview(true)
  }

  async function handleConfirmReceive(options: { skipLabelView?: boolean } = {}) {
    const { skipLabelView = false } = options
    const lbs = parseWeightLbs()
    if (lbs == null) {
      setError('Enter a valid weight in lbs.')
      return
    }
    const weightError = validateWeight(lbs)
    if (weightError) {
      setError(weightError)
      return
    }

    setError('')
    setSuccess('')
    setSubmitLoading(true)

    try {
      const photoKeys: string[] = []
      if (photoFile) {
        const key = previewUnidentified
          ? await uploadUnidentifiedPhoto(photoFile)
          : await uploadPhoto(photoFile, customer!.shipping_id)
        photoKeys.push(key)
      }

      let savedPackage: Package
      if (previewUnidentified) {
        savedPackage = await receiveUnidentifiedPackage({
          actual_weight_lbs: lbs,
          shipper,
          carrier_tracking: carrierTracking.trim() || undefined,
          label_name: labelName.trim() || undefined,
          label_boss_id: labelBossId.trim() || undefined,
          photo_keys: photoKeys,
          note: note || undefined,
        })
      } else {
        const { package: pkg, pre_alert_matched } = await receivePackage({
          shipping_id: customer!.shipping_id,
          actual_weight_lbs: lbs,
          shipper,
          carrier_tracking: carrierTracking.trim() || undefined,
          photo_keys: photoKeys,
          note: note || undefined,
        })
        savedPackage = pkg
        setMatchedPreAlert(pre_alert_matched ?? null)
        setCustomer(pkg.customer || customer)
      }

      refreshCounts()
      loadRecentReceives()

      if (skipLabelView) {
        const tracking = savedPackage.tracking_number
        const summary = savedPackage.is_unidentified
          ? `Unidentified package ${tracking} queued.`
          : `Receival complete — ${tracking}. Label added to print queue.`
        resetAll()
        setSuccess(summary)
        scanInputRef.current?.focus()
        return
      }

      setCompletedPackage(savedPackage)
      if (previewUnidentified) {
        setCustomer(null)
      }
      setStep('complete')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitLoading(false)
    }
  }

  const lbs = parseWeightLbs()
  const canPreviewCustomer = Boolean(customer && shipper && lbs != null && lbs <= MAX_RECEIVE_LBS)
  const canPreviewUnidentified = Boolean(
    showUnidentifiedSection &&
      shipper &&
      lbs != null &&
      lbs <= MAX_RECEIVE_LBS &&
      (labelName.trim() || labelBossId.trim() || carrierTracking.trim()),
  )
  const requiresCustomQuote =
    lbs != null && billableWeight(lbs) > MAX_AUTO_RATE_LBS && lbs <= MAX_RECEIVE_LBS

  function handlePrintNow() {
    if (!completedPackage) return
    markPrintedAfterPrint(() => {
      markLabelsPrinted([completedPackage.id]).catch(() => {})
    })
  }

  function handleQueueAndNext() {
    resetAll()
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconBadge icon={PackagePlus} size="sm" />
          <h1 className="text-2xl font-black uppercase">Receive Package</h1>
        </div>
        <button
          type="button"
          onClick={toggleRushMode}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            rushMode
              ? 'border-boss-green bg-boss-green/15 text-boss-green'
              : 'border-border text-muted hover:border-boss-green/40'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Rush mode {rushMode ? 'on' : 'off'}
        </button>
      </div>

      {success && (
        <p className="mb-4 rounded-lg border border-boss-green/30 bg-boss-green/10 px-4 py-3 text-sm text-boss-green">
          {success}
        </p>
      )}

      {error && step !== 'complete' && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {step === 'idle' && (
        <div className="space-y-6">
          {(recentLoading || recentReceives.length > 0) && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-boss-green">
                <Clock className="h-4 w-4" />
                Your last 3 receivals today
              </h2>
              {recentLoading ? (
                <p className="mt-3 text-sm text-muted">Loading…</p>
              ) : recentReceives.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No packages received yet today.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {recentReceives.map((row) => (
                    <li
                      key={`${row.package_id}-${row.received_at}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-semibold">{row.tracking_number || '—'}</p>
                        <p className="text-muted">
                          {row.is_unidentified
                            ? row.label_name || 'Unidentified'
                            : row.customer_name || row.shipping_id || 'Customer'}
                          {row.shipping_id && !row.is_unidentified ? ` · ${row.shipping_id}` : ''}
                        </p>
                      </div>
                      <div className="text-right text-muted">
                        <p>{row.billable_weight_lbs != null ? `${row.billable_weight_lbs} lbs` : '—'}</p>
                        <p className="text-xs">
                          {new Date(row.received_at).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
                  onClick={() => {
                    setCustomer(null)
                    setSuggestedPreAlert(null)
                    setPreAlertMatches([])
                    setShowUnidentifiedSection(false)
                  }}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Change customer
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-muted">Find customer to attach this package.</p>
                {preAlertLookupLoading && (
                  <p className="mt-2 text-sm text-boss-green">Looking up pre-alerts…</p>
                )}
                {!preAlertLookupLoading && preAlertMatches.length > 0 && (
                  <div className="mt-3 rounded-lg border border-boss-green/30 bg-boss-green/5 p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-boss-green">
                      Pre-alert matches
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Multiple customers pre-alerted this tracking — select the correct one.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {preAlertMatches.map((match) => (
                        <li key={match.pre_alert.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomer(match.customer)
                              setSuggestedPreAlert(match.pre_alert)
                              setPreAlertMatches([])
                              setShowUnidentifiedSection(false)
                            }}
                            className="w-full rounded-lg border border-border bg-background p-3 text-left hover:border-boss-green/40"
                          >
                            <p className="font-semibold">{match.customer.full_name}</p>
                            <p className="text-sm text-muted">
                              {match.customer.shipping_id} · pre-alert {match.pre_alert.carrier_tracking}
                              {match.pre_alert.invoice_url ? ' · invoice on file' : ''}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                            setShowUnidentifiedSection(false)
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
            {suggestedPreAlert && customer && (
              <p className="mt-2 text-sm text-boss-green">
                Pre-alert matched for {customer.shipping_id}
                {suggestedPreAlert.invoice_url ? ' · invoice will attach on receival' : ''}
              </p>
            )}
          </div>

          <form
            onSubmit={
              customer
                ? handleReceive
                : showUnidentifiedSection
                  ? handleReceiveUnidentified
                  : (e) => e.preventDefault()
            }
            className="rounded-2xl border border-border bg-card p-6 space-y-4"
          >
            {!customer && showUnidentifiedSection && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                      Unidentified package
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Record what appears on the label. The package will go to the miscellaneous queue.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnidentifiedSection(false)
                      setLabelName('')
                      setLabelBossId('')
                    }}
                    className="shrink-0 text-xs text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
                <Input
                  label="Name on label"
                  placeholder="As printed on the package"
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                />
                <Input
                  label="BOSS ID on label (if any)"
                  placeholder="BOSS-90009"
                  value={labelBossId}
                  onChange={(e) => setLabelBossId(e.target.value.toUpperCase())}
                />
              </div>
            )}

            {!carrierTracking && (
              <Input
                label="Carrier tracking (scan or type)"
                placeholder="USPS / UPS / FedEx number"
                value={carrierTracking}
                onChange={(e) => setCarrierTracking(e.target.value.toUpperCase())}
                onBlur={() => {
                  if (!customer && carrierTracking.trim()) {
                    void resolvePreAlertForTracking(carrierTracking)
                  }
                }}
              />
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                Shipper
              </label>
              <select
                value={shipper}
                onChange={(e) => updateShipper(e.target.value)}
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
              ref={weightInputRef}
              label="Actual weight (lbs)"
              type="number"
              step="0.01"
              min="0.01"
              max={MAX_RECEIVE_LBS}
              placeholder="7.3"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customer && canPreviewCustomer && !submitLoading) {
                  e.preventDefault()
                  goToPreview(false)
                }
              }}
              required
            />
            <p className="text-xs text-muted">
              Up to {MAX_RECEIVE_LBS} lbs. Standard tier rates apply to {MAX_AUTO_RATE_LBS} lbs or
              less; heavier packages are received with a custom quote.
            </p>

            {requiresCustomQuote && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100">
                {billableWeight(lbs!)} lbs billable — over {MAX_AUTO_RATE_LBS} lbs, freight will be
                quoted separately.
              </p>
            )}

            {!rushMode && (
              <Input
                label="Note (optional)"
                placeholder="Fragile, oversized, etc."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}

            {!rushMode && (
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
            )}

            {!customer && !showUnidentifiedSection && (
              <button
                type="button"
                onClick={() => setShowUnidentifiedSection(true)}
                className="text-sm text-amber-400 hover:underline"
              >
                Can't match owner? Receive as unidentified
              </button>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" onClick={resetAll} className="inline-flex items-center justify-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Cancel
              </Button>
              <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                <Button
                  type="submit"
                  variant="outline"
                  fullWidth
                  disabled={
                    submitLoading ||
                    (customer
                      ? !canPreviewCustomer
                      : showUnidentifiedSection
                        ? !canPreviewUnidentified
                        : true)
                  }
                >
                  {customer
                    ? 'Preview label'
                    : showUnidentifiedSection
                      ? 'Preview unidentified label'
                      : 'Preview label'}
                </Button>
                <Button
                  type="button"
                  fullWidth
                  disabled={
                    submitLoading ||
                    (customer
                      ? !canPreviewCustomer
                      : showUnidentifiedSection
                        ? !canPreviewUnidentified
                        : true)
                  }
                  onClick={handleCompleteDirectly}
                >
                  {submitLoading
                    ? 'Completing…'
                    : customer
                      ? 'Complete receival'
                      : showUnidentifiedSection
                        ? 'Complete unidentified receival'
                        : 'Complete receival'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/15 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
              Review before confirming
            </p>
            <p className="mt-2 text-sm text-muted">
              Check the label details below. Nothing is saved until you confirm receival.
            </p>
            {requiresCustomQuote && (
              <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                This package requires a custom freight quote (over {MAX_AUTO_RATE_LBS} lbs).
              </p>
            )}
          </div>

          <ShippingLabel
            preview
            pkg={buildPreviewPackage(previewUnidentified)}
            customer={previewCustomer(previewUnidentified)}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('receiving')}
              className="inline-flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Back to edit
            </Button>
            <Button
              type="button"
              fullWidth
              disabled={submitLoading}
              onClick={() => void handleConfirmReceive()}
            >
              {submitLoading ? 'Confirming…' : 'Confirm receival'}
            </Button>
          </div>
        </div>
      )}

      {step === 'complete' && completedPackage && (
        <div className="space-y-6">
          <div className="rounded-lg border border-boss-green/30 bg-boss-green/10 p-4 text-center">
            <p className="font-bold text-boss-green">
              {completedPackage.is_unidentified ? 'Added to unidentified queue' : 'Receival complete'}
            </p>
            <p className="mt-1 font-mono text-lg">{completedPackage.tracking_number}</p>
            {matchedPreAlert && (
              <p className="mt-2 text-sm text-boss-green">
                Pre-alert matched ({matchedPreAlert.carrier_tracking})
                {matchedPreAlert.invoice_url ? ' · invoice attached' : ''}
              </p>
            )}
          </div>

          <ShippingLabel pkg={completedPackage} customer={customer} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrintNow}
              className="inline-flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print now
            </Button>
            <Button type="button" fullWidth onClick={handleQueueAndNext}>
              Queue & receive next
            </Button>
          </div>

          <Link
            to="/warehouse/print-queue"
            className="block text-center text-sm text-boss-green hover:underline"
          >
            View print queue →
          </Link>

          {completedPackage.is_unidentified ? (
            <Link
              to="/warehouse/unidentified"
              className="block text-center text-sm text-boss-green hover:underline"
            >
              View unidentified queue →
            </Link>
          ) : (
            <Link
              to={`/track?tracking=${completedPackage.tracking_number}`}
              className="block text-center text-sm text-boss-green hover:underline"
            >
              View tracking page →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
