import { FileUp, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../api/client'
import {
  fetchMyBankTransferProofs,
  submitBankTransferProof,
} from '../../api/bankTransferProofs'
import { fetchPaymentTotal, DELIVERY_FEE_JMD } from '../../api/deliveryRequests'
import { useAuth } from '../../context/AuthContext'
import { useCustomerData } from '../../context/CustomerDataContext'
import {
  BANK_TRANSFER_DETAILS,
  SENDER_BANKS,
  type SenderBank,
} from '../../content/bankTransfer'
import { packageEligibleForPayment } from '../../lib/packageBilling'
import { formatJmd, sumJmd } from '../../lib/money'
import { uploadBankTransferProof } from '../../lib/uploadBankTransferProof'
import type { BankTransferProof } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="font-mono text-sm font-semibold text-foreground sm:text-right">{value}</dd>
    </div>
  )
}

function BankTransferProofUpload() {
  const { packages } = useCustomerData()
  const payablePackages = useMemo(
    () => packages.filter(packageEligibleForPayment),
    [packages],
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [senderBank, setSenderBank] = useState<SenderBank | ''>('')
  const [transferReference, setTransferReference] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [recentProofs, setRecentProofs] = useState<BankTransferProof[]>([])
  const [selectedTotal, setSelectedTotal] = useState(0)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [includeDeliveryFee, setIncludeDeliveryFee] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedTotal(0)
      setDeliveryFee(0)
      setIncludeDeliveryFee(false)
      return
    }
    fetchPaymentTotal(selectedIds)
      .then((totals) => {
        setSelectedTotal(totals.packages_total_jmd)
        setDeliveryFee(totals.delivery_fee_jmd)
        setIncludeDeliveryFee(totals.delivery_fee_jmd > 0)
      })
      .catch(() => {
        setSelectedTotal(
          sumJmd(
            payablePackages
              .filter((pkg) => selectedIds.includes(pkg.id))
              .map((pkg) => pkg.total_due_jmd),
          ),
        )
        setDeliveryFee(0)
        setIncludeDeliveryFee(false)
      })
  }, [payablePackages, selectedIds])

  const appliedDeliveryFee = includeDeliveryFee
    ? deliveryFee > 0
      ? deliveryFee
      : DELIVERY_FEE_JMD
    : 0
  const paymentTotal = selectedTotal + appliedDeliveryFee

  useEffect(() => {
    fetchMyBankTransferProofs()
      .then(setRecentProofs)
      .catch(() => {})
  }, [])

  function togglePackage(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!proofFile) {
      setError('Please choose a screenshot or photo of your transfer')
      return
    }
    if (!senderBank) {
      setError('Please select the bank you transferred from')
      return
    }

    setLoading(true)
    try {
      const proofKey = await uploadBankTransferProof(proofFile)
      const proof = await submitBankTransferProof({
        proof_object_key: proofKey,
        package_ids: selectedIds.length > 0 ? selectedIds : undefined,
        transfer_reference: transferReference.trim() || undefined,
        sender_bank: senderBank,
        amount_jmd: selectedIds.length > 0 ? paymentTotal : undefined,
        include_delivery_fee: selectedIds.length > 0 ? includeDeliveryFee : undefined,
      })
      setRecentProofs((prev) => [proof, ...prev])
      setProofFile(null)
      setSenderBank('')
      setTransferReference('')
      setSelectedIds([])
      setSubmitted(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="mt-8 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          Transfer proof received
        </p>
        <p className="mt-1 text-sm text-muted">
          Our team will review your upload and match it to your account. You can close this window
          or upload another proof if needed.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 !text-xs"
          onClick={() => setSubmitted(false)}
        >
          Upload another proof
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 border-t border-border pt-6">
      <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
        Upload transfer confirmation
      </h3>
      <p className="mt-2 text-sm text-muted">
        After you transfer, upload a screenshot or photo of the receipt so we can confirm your
        payment.
      </p>

      {payablePackages.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Packages this payment is for
          </p>
          <div className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
            {payablePackages.map((pkg) => (
              <label
                key={pkg.id}
                className="flex cursor-pointer items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(pkg.id)}
                  onChange={() => togglePackage(pkg.id)}
                  className="mt-0.5 rounded border-border"
                />
                <span>
                  <span className="font-mono font-semibold">{pkg.tracking_number}</span>
                  {pkg.total_due_jmd != null && (
                    <span className="ml-2 text-muted">{formatJmd(pkg.total_due_jmd)}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          {selectedIds.length > 0 && (
            <div className="space-y-1 text-xs text-muted">
              <p>
                Package bills:{' '}
                <span className="font-semibold text-foreground">{formatJmd(selectedTotal)}</span>
              </p>
              <label className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={includeDeliveryFee}
                  onChange={(e) => setIncludeDeliveryFee(e.target.checked)}
                  disabled={deliveryFee > 0}
                  className="mt-0.5 rounded border-border"
                />
                <span>
                  Include delivery fee (
                  {formatJmd(deliveryFee > 0 ? deliveryFee : DELIVERY_FEE_JMD)})
                  {deliveryFee > 0
                    ? ' — required for your delivery request'
                    : ' — add home delivery to this transfer'}
                </span>
              </label>
              {includeDeliveryFee && (
                <p>
                  Delivery fee:{' '}
                  <span className="font-semibold text-foreground">
                    {formatJmd(appliedDeliveryFee)}
                  </span>
                </p>
              )}
              <p>
                Total due:{' '}
                <span className="font-semibold text-foreground">{formatJmd(paymentTotal)}</span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        <label
          htmlFor="sender-bank"
          className="block text-xs font-medium uppercase tracking-wider text-muted"
        >
          Bank you transferred from
        </label>
        <select
          id="sender-bank"
          value={senderBank}
          onChange={(e) => setSenderBank(e.target.value as SenderBank | '')}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
        >
          <option value="">Select your bank</option>
          {SENDER_BANKS.map((bank) => (
            <option key={bank.value} value={bank.value}>
              {bank.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <Input
          label="Transfer reference (optional)"
          placeholder="Reference from your bank app"
          value={transferReference}
          onChange={(e) => setTransferReference(e.target.value)}
        />
      </div>

      <div className="mt-4 space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted">
          Transfer screenshot
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-5 hover:border-boss-gold/40">
          <FileUp className="h-5 w-5 shrink-0 text-muted" />
          <span className="text-sm text-muted">
            {proofFile ? proofFile.name : 'JPEG, PNG, or WebP'}
          </span>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/*"
            className="sr-only"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Button type="submit" className="mt-4" disabled={loading}>
        {loading ? 'Uploading…' : 'Submit transfer proof'}
      </Button>

      {recentProofs.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Recent uploads
          </p>
          <ul className="space-y-2 text-sm">
            {recentProofs.slice(0, 3).map((proof) => (
              <li
                key={proof.id}
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">
                    {new Date(proof.submitted_at).toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold uppercase">{proof.status_label}</span>
                </div>
                {proof.amount_jmd != null && (
                  <p className="mt-1 text-xs text-muted">{formatJmd(proof.amount_jmd)}</p>
                )}
                {proof.sender_bank_label && (
                  <p className="mt-1 text-xs text-muted">From: {proof.sender_bank_label}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  )
}

function BankTransferDetailsBody() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const b = BANK_TRANSFER_DETAILS

  async function copyAccountNumber() {
    await navigator.clipboard.writeText(b.accountNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <p className="text-sm text-muted">
        Pay freight and duties by bank transfer in Jamaican dollars. {b.referenceNote}
      </p>

      <div className="mt-6 rounded-lg border-[3px] border-dashed border-boss-gold/55 bg-background p-6 shadow-sm shadow-boss-gold/30">
        <dl className="space-y-4">
          <DetailRow label="Account name" value={b.accountName} />
          <DetailRow label="Bank" value={b.bankName} />
          <DetailRow label="Branch" value={b.branch} />
          <DetailRow label="Branch code" value={b.branchCode} />
          <DetailRow label="Transit code" value={b.transitCode} />
          <DetailRow label="SWIFT code" value={b.swiftCode} />
          <DetailRow label="Account number" value={b.accountNumber} />
          <DetailRow label="Account type" value={b.accountType} />
          <DetailRow label="Currency" value={b.currency} />
        </dl>
        {user?.shipping_id && (
          <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
            Your BOSS ID for the transfer reference:{' '}
            <span className="font-mono font-bold text-boss-gold">{user.shipping_id}</span>
          </p>
        )}
      </div>

      <Button onClick={copyAccountNumber} className="mt-6">
        {copied ? 'Copied!' : 'Copy account number'}
      </Button>

      <BankTransferProofUpload />
    </>
  )
}

export function BankTransferDetailsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">
            Bank transfer details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <BankTransferDetailsBody />
      </div>
    </div>
  )
}

export const bankTransferGridCardClassName =
  'w-full rounded-xl border border-boss-gold/30 bg-card p-4 text-left text-sm font-semibold shadow-sm shadow-boss-gold/15 transition-colors hover:border-boss-gold/50 hover:shadow-md hover:shadow-boss-gold/25'
