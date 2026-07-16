import { DollarSign, Package, UserCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import {
  bulkRequestPackageInvoices,
  fetchCustomerAccount,
  openCheckoutBillInvoice,
  openPackageBillInvoice,
} from '../api/staff'
import { CheckoutPaymentModal } from '../components/warehouse/CheckoutPaymentModal'
import { PackageStaffModal } from '../components/warehouse/PackageStaffModal'
import {
  ReleaseFromCustomsModal,
  formatReleaseSummary,
} from '../components/warehouse/ReleaseFromCustomsModal'
import { RecordPaymentForm } from '../components/warehouse/RecordPaymentForm'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { useAuth } from '../context/AuthContext'
import {
  clerkCanManagePackageActions,
  clerkHasPermission,
} from '../lib/clerkPermissions'
import { formatJmd, sumJmd } from '../lib/money'
import { formatPackageCost, packageEligibleForPayment } from '../lib/packageBilling'
import type {
  CustomerAccount,
  Package as Pkg,
  PackagePaymentSummary,
  PaymentCheckout,
} from '../types'

export function CustomerAccountPage() {
  const { shippingId } = useParams<{ shippingId: string }>()
  const { user } = useAuth()
  const perms = user?.permissions || user?.clerk_permissions
  const role = user?.role
  const canManagePackages = clerkCanManagePackageActions(perms, role)
  const canRequestInvoice = clerkHasPermission(perms, 'invoice_request', role)
  const canManageBilling = clerkHasPermission(perms, 'billing', role)
  const [account, setAccount] = useState<CustomerAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [managePkg, setManagePkg] = useState<Pkg | null>(null)
  const [payPkg, setPayPkg] = useState<Pkg | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const loadAccount = useCallback(async () => {
    if (!shippingId) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchCustomerAccount(shippingId)
      setAccount(data)
      setSelectedIds((current) =>
        current.filter((id) => data.packages.some((pkg) => pkg.id === id && packageEligibleForPayment(pkg))),
      )
    } catch (err) {
      setError(getErrorMessage(err))
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }, [shippingId])

  useEffect(() => {
    loadAccount()
  }, [loadAccount])

  const payablePackages = useMemo(
    () => account?.packages.filter((pkg) => packageEligibleForPayment(pkg)) ?? [],
    [account],
  )

  const customsPackages = useMemo(
    () => account?.packages.filter((pkg) => pkg.status === 'customs') ?? [],
    [account],
  )

  const selectedPackages = useMemo(
    () => account?.packages.filter((pkg) => selectedIds.includes(pkg.id)) ?? [],
    [account, selectedIds],
  )

  const selectedTotal = sumJmd(selectedPackages.map((pkg) => pkg.total_due_jmd))

  function handlePackageUpdated(updated: Pkg) {
    setAccount((prev) => {
      if (!prev) return prev
      const packages = prev.packages.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      return { ...prev, packages, summary: recomputeSummary(packages) }
    })
    setManagePkg((current) => (current?.id === updated.id ? { ...current, ...updated } : current))
    setPayPkg((current) => (current?.id === updated.id ? { ...current, ...updated } : current))
  }

  function handleSinglePaymentCompleted(updated: Pkg, payment: PackagePaymentSummary) {
    handlePackageUpdated({ ...updated, payment })
    setPayPkg(null)
    loadAccount()
  }

  async function handleBulkInvoiceRequest() {
    if (customsPackages.length === 0) return
    setInvoiceLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await bulkRequestPackageInvoices({
        packageIds: customsPackages.map((pkg) => pkg.id),
        channel: 'email',
      })
      await loadAccount()
      if (result.sent === 0) {
        setError('No invoice requests were sent.')
      } else {
        setSuccess(`Invoice requested for ${result.sent} package${result.sent === 1 ? '' : 's'}.`)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setInvoiceLoading(false)
    }
  }

  function handleCheckoutCompleted(checkout: PaymentCheckout, packageIds: string[]) {
    setSelectedIds([])
    setCheckoutOpen(false)
    setAccount((prev) => {
      if (!prev) return prev
      const packages = prev.packages.map((pkg) =>
        packageIds.includes(pkg.id)
          ? {
              ...pkg,
              billing_status: 'paid' as const,
              billing_status_label: 'Paid',
            }
          : pkg,
      )
      return {
        ...prev,
        packages,
        checkouts: [checkout, ...prev.checkouts],
        summary: recomputeSummary(packages),
      }
    })
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  function toggleSelectAllPayable() {
    if (selectedIds.length === payablePackages.length) {
      setSelectedIds([])
      return
    }
    setSelectedIds(payablePackages.map((pkg) => pkg.id))
  }

  if (loading) {
    return <p className="px-4 py-12 text-center text-sm text-muted">Loading customer account…</p>
  }

  if (error || !account) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-red-400">{error || 'Customer not found'}</p>
        <Link to="/warehouse/customers" className="mt-4 inline-block text-sm text-boss-gold hover:underline">
          Back to directory
        </Link>
      </div>
    )
  }

  const { customer, packages, checkouts, summary, pending_transfer_proofs = [] } = account

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <IconBadge icon={UserCircle} size="sm" />
          <div>
            <h1 className="text-2xl font-black uppercase">{customer.full_name}</h1>
            <p className="mt-1 font-mono text-boss-gold">{customer.shipping_id}</p>
            <p className="mt-1 text-sm text-muted">
              {customer.email} · {customer.contact_number} · {customer.parish}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/warehouse/customers">
            <Button variant="outline" className="!text-xs">
              Directory
            </Button>
          </Link>
          <Link to={`/warehouse/receive?shipping_id=${encodeURIComponent(customer.shipping_id)}`}>
            <Button className="!text-xs">Receive package</Button>
          </Link>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={DollarSign}
          label="Total due"
          value={formatJmd(summary.total_due_jmd)}
          sub={`${summary.ready_count} bill${summary.ready_count === 1 ? '' : 's'} awaiting payment`}
        />
        <SummaryCard
          icon={Package}
          label="Packages"
          value={String(summary.package_count)}
          sub={`${summary.paid_count} paid`}
        />
        <SummaryCard
          icon={DollarSign}
          label="Checkouts"
          value={String(checkouts.length)}
          sub="Payment history"
        />
      </div>

      {success && (
        <p className="mb-4 rounded-lg bg-boss-green/10 px-4 py-3 text-sm text-boss-green">{success}</p>
      )}

      {payablePackages.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-boss-gold/30 bg-boss-gold/5 px-4 py-3">
          <p className="text-sm">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected · ${formatJmd(selectedTotal)}`
              : 'Select packages ready for payment'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="!text-xs" onClick={toggleSelectAllPayable}>
              {selectedIds.length === payablePackages.length ? 'Clear selection' : 'Select all due'}
            </Button>
            <Button
              className="!text-xs"
              disabled={selectedIds.length === 0 || !canManageBilling}
              title={canManageBilling ? undefined : 'Requires billing permission'}
              onClick={() => setCheckoutOpen(true)}
            >
              Checkout selected
            </Button>
          </div>
        </div>
      ) : null}

      {customsPackages.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-muted">
            {customsPackages.length} package{customsPackages.length === 1 ? '' : 's'} in customs — request
            invoices or release and bill when ready.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="!text-xs"
              disabled={invoiceLoading || !canRequestInvoice}
              title={canRequestInvoice ? undefined : 'Requires invoice request permission'}
              onClick={handleBulkInvoiceRequest}
            >
              {invoiceLoading ? 'Sending…' : 'Request invoices'}
            </Button>
            <Button
              className="!text-xs"
              disabled={!canManageBilling}
              title={canManageBilling ? undefined : 'Requires billing permission'}
              onClick={() => setReleaseOpen(true)}
            >
              Release &amp; bill
            </Button>
          </div>
        </div>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">Package history</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {packages.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">No packages yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border bg-background/50 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3 w-10" />
                    <th className="px-4 py-3">Tracking</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Billing</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {packages.map((pkg) => (
                    <tr key={pkg.id}>
                      <td className="px-4 py-3">
                        {packageEligibleForPayment(pkg) ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(pkg.id)}
                            onChange={() => toggleSelected(pkg.id)}
                            aria-label={`Select ${pkg.tracking_number}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-boss-gold">{pkg.tracking_number}</td>
                      <td className="px-4 py-3">{pkg.status_label}</td>
                      <td className="px-4 py-3">{pkg.billing_status_label}</td>
                      <td className="px-4 py-3 font-semibold">{formatPackageCost(pkg) ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={!canManagePackages}
                            title={
                              canManagePackages
                                ? undefined
                                : 'Requires billing or invoice request permission'
                            }
                            onClick={() => setManagePkg({ ...pkg, customer })}
                            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:border-boss-gold/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border"
                          >
                            Manage
                          </button>
                          {packageEligibleForPayment(pkg) && (
                            <button
                              type="button"
                              disabled={!canManageBilling}
                              title={canManageBilling ? undefined : 'Requires billing permission'}
                              onClick={() => setPayPkg({ ...pkg, customer })}
                              className="rounded-lg border border-boss-gold/30 bg-boss-gold/10 px-2.5 py-1 text-xs font-semibold text-boss-gold hover:bg-boss-gold/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-boss-gold/10"
                            >
                              Pay
                            </button>
                          )}
                          {(pkg.billing_status === 'ready' || pkg.billing_status === 'paid') && (
                            <button
                              type="button"
                              disabled={!canManageBilling}
                              title={canManageBilling ? undefined : 'Requires billing permission'}
                              onClick={() =>
                                pkg.payment?.checkout_id
                                  ? openCheckoutBillInvoice(pkg.payment.checkout_id)
                                  : openPackageBillInvoice(pkg.id)
                              }
                              className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:border-boss-gold/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border"
                            >
                              Invoice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {canManageBilling && pending_transfer_proofs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">
            Pending bank transfer proofs
          </h2>
          <div className="space-y-3">
            {pending_transfer_proofs.map((proof) => (
              <div
                key={proof.id}
                className="rounded-2xl border border-amber-500/30 bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {new Date(proof.submitted_at).toLocaleString()}
                    </p>
                    {proof.amount_jmd != null && (
                      <p className="mt-1 text-sm text-muted">{formatJmd(proof.amount_jmd)}</p>
                    )}
                    {proof.transfer_reference && (
                      <p className="mt-1 font-mono text-xs text-muted">
                        Ref: {proof.transfer_reference}
                      </p>
                    )}
                    {proof.packages && proof.packages.length > 0 && (
                      <p className="mt-2 text-xs text-muted">
                        Packages:{' '}
                        {proof.packages.map((pkg) => pkg.tracking_number).filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  {proof.proof_url && (
                    <a
                      href={proof.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-boss-gold/40"
                    >
                      View proof
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">Payment history</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {checkouts.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-background/50 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Packages</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Clerk</th>
                    <th className="px-4 py-3 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {checkouts.map((checkout) => (
                    <tr key={checkout.id}>
                      <td className="px-4 py-3 text-muted">
                        {new Date(checkout.recorded_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{checkout.invoice_number}</td>
                      <td className="px-4 py-3">{checkout.package_count}</td>
                      <td className="px-4 py-3">{checkout.method_label}</td>
                      <td className="px-4 py-3 font-semibold">{formatJmd(checkout.total_jmd)}</td>
                      <td className="px-4 py-3 text-muted">{checkout.recorded_by_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={!canManageBilling}
                          title={canManageBilling ? undefined : 'Requires billing permission'}
                          onClick={() => openCheckoutBillInvoice(checkout.id)}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:border-boss-gold/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border"
                        >
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {managePkg && (
        <PackageStaffModal
          pkg={managePkg}
          onClose={() => setManagePkg(null)}
          onUpdated={(updated) => handlePackageUpdated({ ...updated, customer })}
        />
      )}

      {payPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-mono font-bold text-boss-gold">{payPkg.tracking_number}</h2>
                <p className="text-sm text-muted">Record payment</p>
              </div>
              <button type="button" onClick={() => setPayPkg(null)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>
            <div className="mt-4">
              <RecordPaymentForm
                pkg={payPkg}
                compact
                onCompleted={(updated, payment) => handleSinglePaymentCompleted(updated, payment)}
              />
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && shippingId && selectedPackages.length > 0 && (
        <CheckoutPaymentModal
          shippingId={shippingId}
          packages={selectedPackages}
          onClose={() => setCheckoutOpen(false)}
          onCompleted={handleCheckoutCompleted}
        />
      )}

      {releaseOpen && (
        <ReleaseFromCustomsModal
          packages={customsPackages}
          onClose={() => setReleaseOpen(false)}
          onCompleted={(result) => {
            setReleaseOpen(false)
            setSuccess(formatReleaseSummary(result))
            loadAccount()
          }}
        />
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof DollarSign
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-boss-gold/10 text-boss-gold">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
          <p className="mt-1 text-2xl font-black">{value}</p>
          <p className="mt-1 text-xs text-muted">{sub}</p>
        </div>
      </div>
    </div>
  )
}

function recomputeSummary(packages: Pkg[]) {
  let total_due_jmd = 0
  let ready_count = 0
  let paid_count = 0

  for (const pkg of packages) {
    if (packageEligibleForPayment(pkg) && pkg.total_due_jmd != null) {
      total_due_jmd += pkg.total_due_jmd
      ready_count += 1
    } else if (pkg.billing_status === 'paid') {
      paid_count += 1
    }
  }

  return {
    total_due_jmd,
    ready_count,
    paid_count,
    package_count: packages.length,
    currency: 'JMD' as const,
  }
}

