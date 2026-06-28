import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { estimateRate } from '../../api/rates'
import { releasePackagesFromCustoms, type ReleaseFromCustomsResult } from '../../api/staff'
import { formatJmd } from '../../lib/money'
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
}: ReleaseFromCustomsModalProps) {
  const [feesById, setFeesById] = useState<Record<string, FeeFields>>(() =>
    Object.fromEntries(packages.map((pkg) => [pkg.id, emptyFees()])),
  )
  const [freightById, setFreightById] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [error, setError] = useState('')

  const customsPackages = useMemo(
    () => packages.filter((pkg) => pkg.status === 'customs'),
    [packages],
  )

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

  const previewTotal = useMemo(() => {
    let total = 0
    let hasAny = false
    for (const pkg of customsPackages) {
      const rowTotal = rowTotalJmd(freightById[pkg.id] ?? null, feesById[pkg.id] ?? emptyFees())
      if (rowTotal != null) {
        total += rowTotal
        hasAny = true
      }
    }
    return hasAny ? total : null
  }, [customsPackages, feesById, freightById])

  function updateFees(id: string, patch: Partial<FeeFields>) {
    setFeesById((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (customsPackages.length === 0) return

    setError('')
    setLoading(true)
    try {
      const result = await releasePackagesFromCustoms({
        items: customsPackages.map((pkg) => {
          const fees = feesById[pkg.id] ?? emptyFees()
          return {
            package_id: pkg.id,
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
              Shipping is calculated from weight. Add optional duties or fees, then publish bills and
              mark packages ready for pickup.
            </p>
            {previewTotal != null && (
              <p className="mt-2 text-sm font-semibold text-boss-green">
                Estimated total: {formatJmd(previewTotal)}
                {estimating ? ' (calculating…)' : ''}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {customsPackages.map((pkg) => {
            const fees = feesById[pkg.id] ?? emptyFees()
            const weight = pkg.billable_weight_lbs ?? pkg.actual_weight_lbs
            const freight = freightById[pkg.id] ?? null
            const rowTotal = rowTotalJmd(freight, fees)
            return (
              <div key={pkg.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-boss-green">{pkg.tracking_number}</p>
                    {pkg.customer && (
                      <p className="text-xs text-muted">
                        {pkg.customer.full_name} · {pkg.customer.shipping_id}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>{weight != null ? `${weight} lbs` : 'No weight'}</p>
                    <p className="mt-0.5 font-semibold text-foreground">
                      {freight != null ? `Shipping ${formatJmd(freight)}` : estimating ? '…' : '—'}
                    </p>
                    {rowTotal != null && (
                      <p className="mt-0.5 font-bold text-boss-green">Total {formatJmd(rowTotal)}</p>
                    )}
                  </div>
                </div>
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
