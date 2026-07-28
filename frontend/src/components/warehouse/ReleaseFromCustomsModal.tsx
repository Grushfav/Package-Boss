import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { estimateRate } from '../../api/rates'
import {
  releasePackagesFromCustoms,
  requestPackageInvoice,
  type ReleaseFromCustomsResult,
} from '../../api/staff'
import { useAuth } from '../../context/AuthContext'
import { clerkHasPermission } from '../../lib/clerkPermissions'
import { formatJmd } from '../../lib/money'
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

function billableWeight(lbs: number): number {
  return Math.ceil(lbs)
}

function requiresCustomFreightQuote(
  pkg: Package,
  autoFreight: number | null | undefined,
  estimating: boolean,
): boolean {
  const weight = pkg.billable_weight_lbs ?? pkg.actual_weight_lbs
  if (weight != null && billableWeight(weight) > MAX_AUTO_RATE_LBS) return true
  if (pkg.rate_tier_label === 'Custom quote') return true
  if (!estimating && autoFreight == null && weight != null) return true
  return false
}

function rowTotalJmd(freightJmd: number | null, fees: FeeFields): number | null {
  if (freightJmd == null) return null
  const duties = parseOptionalJmd(fees.duties_jmd) ?? 0
  const handling = parseOptionalJmd(fees.handling_jmd) ?? 0
  const other = parseOptionalJmd(fees.other_fees_jmd) ?? 0
  return freightJmd + duties + handling + other
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
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null)
  const [invoiceNotice, setInvoiceNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLocalPackages(packages.filter((pkg) => pkg.status === 'customs'))
  }, [packages])

  const customsPackages = localPackages

  useEffect(() => {
    let cancelled = false

    async function loadEstimates() {
      setEstimating(true)
      const next: Record<string, number | null> = {}

      await Promise.all(
        customsPackages.map(async (pkg) => {
          if (pkg.estimated_freight_jmd != null && pkg.estimated_freight_jmd > 0) {
            next[pkg.id] = pkg.estimated_freight_jmd
            return
          }
          const weight = pkg.billable_weight_lbs ?? pkg.actual_weight_lbs
          if (weight == null) {
            next[pkg.id] = null
            return
          }
          if (billableWeight(weight) > MAX_AUTO_RATE_LBS || pkg.rate_tier_label === 'Custom quote') {
            next[pkg.id] = null
            return
          }
          try {
            const quote = await estimateRate(weight)
            next[pkg.id] = quote.cost_jmd
          } catch {
            next[pkg.id] = null
          }
        }),
      )

      if (!cancelled) {
        setFreightById(next)
        setEstimating(false)
      }
    }

    if (customsPackages.length > 0) {
      loadEstimates()
    }

    return () => {
      cancelled = true
    }
  }, [customsPackages])

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
      const manual = parseOptionalJmd(freightInputById[pkg.id] ?? '')
      const freight = manual ?? freightById[pkg.id] ?? null
      const rowTotal = rowTotalJmd(freight, feesById[pkg.id] ?? emptyFees())
      if (rowTotal != null) {
        total += rowTotal
        hasAny = true
      }
    }
    return hasAny ? total : null
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
      const autoFreight = freightById[pkg.id] ?? null
      if (requiresCustomFreightQuote(pkg, autoFreight, estimating)) {
        const freight = effectiveFreight(pkg)
        if (freight == null || freight <= 0) {
          setError(`Enter shipping (JMD) for ${pkg.tracking_number}`)
          return
        }
      }
    }

    setLoading(true)
    try {
      const result = await releasePackagesFromCustoms({
        items: customsPackages.map((pkg) => {
          const fees = feesById[pkg.id] ?? emptyFees()
          const autoFreight = freightById[pkg.id] ?? null
          const needsCustom = requiresCustomFreightQuote(pkg, autoFreight, false)
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
            const weight = pkg.billable_weight_lbs ?? pkg.actual_weight_lbs
            const autoFreight = freightById[pkg.id] ?? null
            const needsCustom = requiresCustomFreightQuote(pkg, autoFreight, estimating)
            const freight = effectiveFreight(pkg)
            const rowTotal = rowTotalJmd(freight, fees)
            const feesExpanded = expandedFeeIds.has(pkg.id)
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
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>{weight != null ? `${weight} lbs` : 'No weight'}</p>
                    {!needsCustom && (
                      <p className="mt-0.5 font-semibold text-foreground">
                        {autoFreight != null ? `Shipping ${formatJmd(autoFreight)}` : estimating ? '…' : '—'}
                      </p>
                    )}
                    {rowTotal != null && (
                      <p className="mt-0.5 font-bold text-boss-gold">Total {formatJmd(rowTotal)}</p>
                    )}
                  </div>
                </div>
                {needsCustom ? (
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
