import { useState } from 'react'
import { getErrorMessage } from '../../api/client'
import { openPackageBillInvoice, recordPackagePayment } from '../../api/staff'
import { formatJmd } from '../../lib/money'
import type { Package, PackagePaymentSummary } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface RecordPaymentFormProps {
  pkg: Package
  onCompleted: (pkg: Package, payment: PackagePaymentSummary) => void
  compact?: boolean
}

export function RecordPaymentForm({ pkg, onCompleted, compact = false }: RecordPaymentFormProps) {
  const [method, setMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    setLoading(true)
    try {
      const result = await recordPackagePayment(pkg.id, {
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      if (result.package.payment) {
        onCompleted(result.package, result.package.payment)
      }
      await openPackageBillInvoice(pkg.id)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (pkg.billing_status === 'paid' && pkg.payment) {
    return (
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        <p className="text-sm text-muted">
          Paid via {pkg.payment.method_label ?? pkg.payment.method}
          {pkg.payment.reference ? ` · Ref ${pkg.payment.reference}` : ''}
        </p>
        <p className="font-mono text-sm font-semibold text-boss-gold">{pkg.payment.invoice_number}</p>
        <Button variant="outline" className="!text-xs" onClick={() => openPackageBillInvoice(pkg.id)}>
          View / print invoice
        </Button>
      </div>
    )
  }

  if (pkg.billing_status !== 'ready') {
    return (
      <p className="text-sm text-muted">
        Bill must be ready before payment ({pkg.billing_status_label ?? 'bill pending'}).
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <p className="text-sm font-semibold">Amount due: {formatJmd(pkg.total_due_jmd)}</p>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted">
          Payment method
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank transfer</option>
        </select>
      </div>

      <Input
        label={method === 'bank_transfer' ? 'Transfer reference' : 'Reference (optional)'}
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />

      <Input
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Processing…' : 'Record payment & invoice'}
        </Button>
        <Button
          variant="outline"
          className="!text-xs"
          disabled={loading}
          onClick={() => openPackageBillInvoice(pkg.id)}
        >
          Preview bill
        </Button>
      </div>
    </div>
  )
}
