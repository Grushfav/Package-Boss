import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import {
  releasePackagesFromCustoms,
  requestPackageInvoice,
  type ReleaseFromCustomsResult,
} from '../../api/staff'
import { useAuth } from '../../context/AuthContext'
import { clerkHasPermission } from '../../lib/clerkPermissions'
import { formatJmd } from '../../lib/money'
import { billableWeightLbs, freightFromRatesTable } from '../../lib/rateEstimate'
import { loadRates } from '../../lib/ratesCache'
import { MAX_AUTO_RATE_LBS } from '../../lib/warehouseConstants'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { Package } from '../../types'

interface FeeFields {
  duties_jmd: string
  handling_jmd: string
  other_fees_jmd: string
  note: string
}

interface ReleaseFromCustomsModalProps {
  packages: Package[]
  onClose: () => void
  onCompleted: (result: ReleaseFromCustomsResult) => void
  onPackageUpdated?: (pkg: Package) => void
}

function emptyFees(): FeeFields {
  return { duties_jmd: '', handling_jmd: '', other_fees_jmd: '', note: '' }
}

function parseOptionalJmd(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function packageWeight(pkg: Package): number | null {
  return pkg.billable_weight_lbs ?? pkg.actual_weight_lbs ?? null
}

/** True only when the package genuinely needs a manual freight quote. */
function requiresCustomFreightQuote(pkg: Package): boolean {
  if (pkg.rate_tier_label === 'Custom quote') return true
  const weight = packageWeight(pkg)
  if (weight == null) return false
  try {
    return billableWeightLbs(weight) > MAX_AUTO_RATE_LBS
  } catch {
    return false
  }
}

function rowTotalJmd(freightJmd: number | null, fees: FeeFields): number | null {
  if (freightJmd == null) return null
  const duties = parseOptionalJmd(fees.duties_jmd) ?? 0
  const handling = parseOptionalJmd(fees.handling_jmd) ?? 0
  const other = parseOptionalJmd(fees.other_fees_jmd) ?? 0
  return freightJmd + duties + handling + other
}

function estimateSignature(pkgs: Package[]): string {
  return pkgs
    .map((pkg) => {
      const w = packageWeight(pkg)
      return `${pkg.id}:${w ?? ''}:${pkg.estimated_freight_jmd ?? ''}:${pkg.rate_tier_label ?? ''}`
    })
    .sort()
    .join('|')
}

export function ReleaseFromCustomsModal({
  packages,
  onClose,
  onCompleted,
  onPackageUpdated,
}: ReleaseFromCustomsModalProps) {
  const { user } = useAuth()
  const perms = user?.permissions || user?.clerk_permissions
  const role = user?.role
  const canRequestInvoice = clerkHasPermission(perms, 'invoice_request', role)

  const [localPackages, setLocalPackages] = useState<Package[]>(() =>
    packages.filter((pkg) => pkg.status === 'customs'),
  )
  const [feesById, setFeesById] = useState<Record<string, FeeFields>>(() =>
    Object.fromEntries(packages.map((pkg) => [pkg.id, emptyFees()])),
  )
  const [expandedFeeIds, setExpandedFeeIds] = useState<Set<string>>(new Set())
  const [freightById, setFreightById] = useState<Record<string, number | null>>({})
  const [freightInputById, setFreightInputById] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      packages
        .filter((pkg) => pkg.estimated_freight_jmd != null && pkg.estimated_freight_jmd > 0)
        .map((pkg) => [pkg.id, String(pkg.estimated_freight_jmd)]),
    ),
  )
  const [loading, setLoading] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState('')
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null)
  const [invoiceNotice, setInvoiceNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLocalPackages(packages.filter((pkg) => pkg.status === 'customs'))
  }, [packages])

  const customsPackages = localPackages
  const ratesSig = useMemo(() => estimateSignature(customsPackages), [customsPackages])

  useEffect(() => {
    let cancelled = false

    async function loadEstimates() {
      if (customsPackages.length === 0) return

      setEstimating(true)
      setEstimateError('')
      const next: Record<string, number | null> = {}

      try {
        const rates = await loadRates()
        if (cancelled) return

        for (const pkg of customsPackages) {
          if (pkg.estimated_freight_jmd != null && pkg.estimated_freight_jmd > 0) {
            next[pkg.id] = pkg.estimated_freight_jmd
            continue
          }
          if (requiresCustomFreightQuote(pkg)) {
            next[pkg.id] = null
            continue
          }
          const weight = packageWeight(pkg)
          if (weight == null) {
            next[pkg.id] = null
            continue
          }
          try {
            const quote = freightFromRatesTable(weight, rates)
            next[pkg.id] = quote?.cost_jmd ?? null
          } catch {
            next[pkg.id] = null
          }
        }

        if (!cancelled) {
          setFreightById(next)
        }
      } catch (err) {
        if (!cancelled) {
          setEstimateError(getErrorMessage(err))
          setFreightById({})
        }
      } finally {
        if (!cancelled) {
          setEstimating(false)
        }
      }
    }

    void loadEstimates()

    return () => {
      cancelled = true
    }
    // ratesSig captures id/weight/freight/label — avoid refetch on unrelated package object churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratesSig])

  function effectiveFreight(pkg: Package): number | null {
    const manual = parseOptionalJmd(freightInputById[pkg.id] ?? '')
    if (manual != null) return manual
    return freightById[pkg.id] ?? null
  }

  function updateFreightInput(id: string, value: string) {
    setFreightInputById((prev) => ({ ...prev, [id]: value }))
  }

  const previewTotal = useMemo(() => {
    let total = 0
    let hasAny = false
    for (const pkg of customsPackages) {
      const freight = effectiveFreight(pkg)
      const rowTotal = rowTotalJmd(freight, feesById[pkg.id] ?? emptyFees())
      if (rowTotal != null) {
        total += rowTotal
        hasAny = true
      }
    }
    return hasAny ? total : null
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effectiveFreight reads freightInputById/freightById
  }, [customsPackages, feesById, freightById, freightInputById])

  function updateFees(id: string, patch: Partial<FeeFields>) {
    setFeesById((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  function toggleFeeFields(id: string) {
    setExpandedFeeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function hasExtraFeeFields(fees: FeeFields): boolean {
    return Boolean(
      fees.duties_jmd.trim() ||
        fees.handling_jmd.trim() ||
        fees.other_fees_jmd.trim() ||
        fees.note.trim(),
    )
  }

  function canRequestInvoiceForPackage(pkg: Package): boolean {
    return pkg.invoice_status === 'pending' || pkg.invoice_status === 'requested'
  }

  async function handleRequestInvoice(packageId: string) {
    setError('')
    setInvoiceNotice('')
    setInvoiceLoadingId(packageId)
    try {
      const result = await requestPackageInvoice(packageId, { channel: 'email' })
      setLocalPackages((prev) =>
        prev.map((pkg) => (pkg.id === packageId ? { ...pkg, ...result.package } : pkg)),
      )
      onPackageUpdated?.(result.package)
      const parts: string[] = []
      if (result.channels_sent.includes('email') && result.email_recipient) {
        parts.push(`Email sent to ${result.email_recipient}`)
      }
      setInvoiceNotice(
        parts.join(' · ') ||
          `Invoice request sent for ${result.package.tracking_number}`,
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setInvoiceLoadingId(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (customsPackages.length === 0) return

    setError('')
    for (const pkg of customsPackages) {
      if (requiresCustomFreightQuote(pkg)) {
        const freight = effectiveFreight(pkg)
        if (freight == null || freight <= 0) {
          setError(`Enter shipping (JMD) for ${pkg.tracking_number}`)
          return
        }
      } else if (effectiveFreight(pkg) == null) {
        setError(
          `Shipping could not be calculated for ${pkg.tracking_number}. Wait for rates to load or enter a custom amount.`,
        )
        return
      }
    }

    setLoading(true)
    try {
      const result = await releasePackagesFromCustoms({
        items: customsPackages.map((pkg) => {
          const fees = feesById[pkg.id] ?? emptyFees()
          const needsCustom = requiresCustomFreightQuote(pkg)
          const manualInput = freightInputById[pkg.id]?.trim()
          const freight = effectiveFreight(pkg)
          return {
            package_id: pkg.id,
            ...(freight != null && (needsCustom || manualInput)
              ? { estimated_freight_jmd: freight }
              : {}),
            duties_jmd: parseOptionalJmd(fees.duties_jmd),
            handling_jmd: parseOptionalJmd(fees.handling_jmd),
            other_fees_jmd: parseOptionalJmd(fees.other_fees_jmd),
            note: fees.note.trim() || undefined,
          }
        }),
      })
      onCompleted(result)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (customsPackages.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
          <p className="text-sm text-muted">No packages in customs are selected.</p>
          <Button className="mt-4" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold uppercase">Release &amp; Bill</h2>
            <p className="mt-1 text-sm text-muted">
              Shipping is calculated from weight for standard packages. Packages over{' '}
              {MAX_AUTO_RATE_LBS} lbs need a custom shipping quote. Add optional duties or fees,
              then publish bills and mark packages ready for pickup.
            </p>
            {previewTotal != null && (
              <p className="mt-2 text-sm font-semibold text-boss-gold">
                Estimated total: {formatJmd(previewTotal)}
                {estimating ? ' (calculating…)' : ''}
              </p>
            )}
            {estimateError && (
              <p className="mt-2 text-sm text-amber-400">
                Could not load rate table: {estimateError}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        {invoiceNotice && (
          <p className="mt-4 rounded-lg border border-boss-green/30 bg-boss-green/10 px-4 py-3 text-sm text-boss-green">
            {invoiceNotice}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {customsPackages.map((pkg) => {
            const fees = feesById[pkg.id] ?? emptyFees()
            const weight = packageWeight(pkg)
            const autoFreight = freightById[pkg.id] ?? null
            const needsCustom = requiresCustomFreightQuote(pkg)
            const freight = effectiveFreight(pkg)
            const rowTotal = rowTotalJmd(freight, fees)
            const feesExpanded = expandedFeeIds.has(pkg.id)
            const estimateFailed =
              !needsCustom && !estimating && weight != null && autoFreight == null
            return (
              <div key={pkg.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-boss-gold">{pkg.tracking_number}</p>
                    {pkg.customer && (
                      <p className="text-xs text-muted">
                        {pkg.customer.full_name} · {pkg.customer.shipping_id}
                      </p>
                    )}
                    {needsCustom && (
                      <p className="mt-1 text-xs text-amber-400">
                        Custom quote required (over {MAX_AUTO_RATE_LBS} lbs)
                      </p>
                    )}
                    {estimateFailed && (
                      <p className="mt-1 text-xs text-amber-400">
                        Auto shipping unavailable — enter a custom amount or reopen after rates
                        load.
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>{weight != null ? `${weight} lbs` : 'No weight'}</p>
                    {!needsCustom && (
                      <p className="mt-0.5 font-semibold text-foreground">
                        {autoFreight != null
                          ? `Shipping ${formatJmd(autoFreight)}`
                          : estimating
                            ? '…'
                            : '—'}
                      </p>
                    )}
                    {rowTotal != null && (
                      <p className="mt-0.5 font-bold text-boss-gold">Total {formatJmd(rowTotal)}</p>
                    )}
                  </div>
                </div>
                {needsCustom || estimateFailed ? (
                  <Input
                    label="Shipping (JMD)"
                    type="number"
                    step="1"
                    className="mt-3"
                    value={freightInputById[pkg.id] ?? ''}
                    onChange={(e) => updateFreightInput(pkg.id, e.target.value)}
                    placeholder="Enter custom freight quote"
                  />
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    Invoice:{' '}
                    <span className="font-semibold text-foreground">
                      {pkg.invoice_status_label ?? '—'}
                    </span>
                  </p>
                  {canRequestInvoice && canRequestInvoiceForPackage(pkg) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="!px-2.5 !py-1 !text-xs"
                      disabled={invoiceLoadingId === pkg.id || loading}
                      onClick={() => void handleRequestInvoice(pkg.id)}
                    >
                      {invoiceLoadingId === pkg.id
                        ? 'Sending…'
                        : pkg.invoice_status === 'requested'
                          ? 'Resend invoice'
                          : 'Request invoice'}
                    </Button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleFeeFields(pkg.id)}
                  className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2 text-left transition-colors hover:border-boss-gold/40"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Duties &amp; optional fees
                    {hasExtraFeeFields(fees) && !feesExpanded ? (
                      <span className="ml-1 normal-case text-boss-gold">· added</span>
                    ) : null}
                  </span>
                  {feesExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                  )}
                </button>
                {feesExpanded && (
                  <>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Input
                        label="Duties (JMD)"
                        type="number"
                        step="1"
                        value={fees.duties_jmd}
                        onChange={(e) => updateFees(pkg.id, { duties_jmd: e.target.value })}
                      />
                      <Input
                        label="Handling (JMD)"
                        type="number"
                        step="1"
                        value={fees.handling_jmd}
                        onChange={(e) => updateFees(pkg.id, { handling_jmd: e.target.value })}
                      />
                      <Input
                        label="Other fees (JMD)"
                        type="number"
                        step="1"
                        value={fees.other_fees_jmd}
                        onChange={(e) => updateFees(pkg.id, { other_fees_jmd: e.target.value })}
                      />
                    </div>
                    <Input
                      label="Note (optional)"
                      className="mt-3"
                      value={fees.note}
                      onChange={(e) => updateFees(pkg.id, { note: e.target.value })}
                    />
                  </>
                )}
              </div>
            )
          })}

          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || estimating}>
              {loading
                ? 'Releasing…'
                : `Release ${customsPackages.length} package${customsPackages.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function formatReleaseSummary(result: ReleaseFromCustomsResult): string {
  const parts = [`${result.released} released`]
  if (result.packages.length > 0) {
    const total = result.packages.reduce((sum, pkg) => sum + (pkg.total_due_jmd ?? 0), 0)
    if (total > 0) parts.push(formatJmd(total))
  }
  return parts.join(' · ')
}
