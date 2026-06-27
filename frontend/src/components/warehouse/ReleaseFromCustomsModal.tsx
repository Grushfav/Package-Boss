import { useMemo, useState } from 'react'
import { getErrorMessage } from '../../api/client'
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

export function ReleaseFromCustomsModal({
  packages,
  onClose,
  onCompleted,
}: ReleaseFromCustomsModalProps) {
  const [feesById, setFeesById] = useState<Record<string, FeeFields>>(() =>
    Object.fromEntries(packages.map((pkg) => [pkg.id, emptyFees()])),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const customsPackages = useMemo(
    () => packages.filter((pkg) => pkg.status === 'customs'),
    [packages],
  )

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
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {customsPackages.map((pkg) => {
            const fees = feesById[pkg.id] ?? emptyFees()
            const weight = pkg.billable_weight_lbs ?? pkg.actual_weight_lbs
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
                  <p className="text-xs text-muted">{weight != null ? `${weight} lbs` : 'No weight'}</p>
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
            <Button type="submit" disabled={loading}>
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
