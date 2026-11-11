import { CheckCircle2, DollarSign, Package, ShoppingBag, UserCircle, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import {
  bulkRequestPackageInvoices,
  bulkUpdatePackageStatus,
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
  clerkHasAnyPermission,
  clerkHasPermission,
} from '../lib/clerkPermissions'
import { formatJmd, sumJmd } from '../lib/money'
import {
  formatPackageCost,
  formatPackageFeeCell,
  formatPackageWeight,
  packageEligibleForPayment,
} from '../lib/packageBilling'
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
  const canMarkDelivered = clerkHasAnyPermission(perms, ['status_pickup', 'billing'], role)
  const [deliverLoadingId, setDeliverLoadingId] = useState<string | null>(null)
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
  const [toast, setToast] = useState<string | null>(null)
  const [completedOffset, setCompletedOffset] = useState(0)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

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
    setCompletedOffset(0)
    void loadAccount()
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

  async function handleOpenBillInvoice(pkg: Pkg) {
    setError('')
    setSuccess('')
    try {
      if (pkg.payment?.checkout_id) {
        await openCheckoutBillInvoice(pkg.payment.checkout_id)
      } else {
        await openPackageBillInvoice(pkg.id)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleOpenCheckoutBillInvoice(checkoutId: string) {
    setError('')
    setSuccess('')
    try {
      await openCheckoutBillInvoice(checkoutId)
    } catch (err) {
      setError(getErrorMessage(err))
    }
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

  function handleCheckoutCompleted(
    checkout: PaymentCheckout,
    packageIds: string[],
    options?: { markDelivered?: boolean; deliveryWarning?: string | null },
  ) {
    setSelectedIds([])
    setCheckoutOpen(false)
    setError('')
    setSuccess('')
    setAccount((prev) => {
      if (!prev) return prev
      const packages = prev.packages.map((pkg) =>
        packageIds.includes(pkg.id)
          ? {
              ...pkg,
              billing_status: 'paid' as const,
              billing_status_label: 'Paid',
              ...(options?.markDelivered
                ? { status: 'delivered' as const, status_label: 'Delivered' }
                : {}),
            }
          : pkg,
      )
      return {
        ...prev,
        packages,
        checkouts: [checkout, ...(prev.checkouts ?? [])],
        summary: recomputeSummary(packages),
      }
    })
    const count = packageIds.length
    let message = `Checkout recorded — ${checkout.invoice_number} · ${count} package${count === 1 ? '' : 's'}`
    if (options?.deliveryWarning) {
      message += ` · Delivery update: ${options.deliveryWarning}`
    }
    setToast(message)
  }

  async function handleMarkDelivered(packageId: string) {
    setError('')
    setSuccess('')
    setDeliverLoadingId(packageId)
    try {
      const result = await bulkUpdatePackageStatus({
        packageIds: [packageId],
        status: 'delivered',
        note: 'Marked delivered from customer account',
      })
      if (result.updated === 0) {
        setError(result.failed[0]?.error ?? 'Could not mark package delivered')
        return
      }
      const updated = result.packages[0]
      setAccount((prev) => {
        if (!prev) return prev
        const packages = prev.packages.map((pkg) =>
          pkg.id === packageId ? { ...pkg, ...updated } : pkg,
        )
        return { ...prev, packages, summary: recomputeSummary(packages) }
      })
      setSuccess(`${updated.tracking_number} marked delivered`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeliverLoadingId(null)
    }
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
    const canBrowseDirectory = clerkHasPermission(perms, 'directory', role)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-red-400">{error || 'Customer not found'}</p>
        <Link
          to={canBrowseDirectory ? '/warehouse/customers' : '/warehouse'}
          className="mt-4 inline-block text-sm text-boss-gold hover:underline"
        >
          {canBrowseDirectory ? 'Back to directory' : 'Back to floor'}
        </Link>
      </div>
    )
  }

  const {
    customer,
    packages,
    checkouts = [],
    summary,
    delivery_addresses = [],
    pending_transfer_proofs = [],
  } = account
  // API omits billing summary/checkouts when the clerk lacks billing permission.
  const billingSummary = summary ?? {
    total_due_jmd: 0,
    ready_count: 0,
    paid_count: packages.filter((pkg) => pkg.billing_status === 'paid').length,
    package_count: packages.length,
    currency: 'JMD' as const,
  }
  const readyForPickupCount = packages.filter((pkg) => pkg.status === 'ready_for_pickup').length
  const readyPaidCount = packages.filter(
    (pkg) => pkg.status === 'ready_for_pickup' && pkg.billing_status === 'paid',
  ).length
  const deliveryAddress =
    delivery_addresses.find((addr) => addr.is_default) ?? delivery_addresses[0] ?? null
  const activePackages = packages.filter((pkg) => pkg.status !== 'delivered')
  const completedPackages = packages.filter((pkg) => pkg.status === 'delivered')
  const completedPageSize = 6
  const completedPage = completedPackages.slice(
    completedOffset,
    completedOffset + completedPageSize,
  )
  const completedTotalPages = Math.max(1, Math.ceil(completedPackages.length / completedPageSize))
  const canBrowseDirectory = clerkHasPermission(perms, 'directory', role)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-28">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-4 right-4 z-40 mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-boss-green/40 bg-card px-4 py-3 shadow-lg md:bottom-6 md:left-auto md:right-6"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-boss-green" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{toast}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="shrink-0 rounded-md p-1 text-muted hover:bg-background/60 hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <IconBadge icon={UserCircle} size="sm" />
          <div>
            <h1 className="text-2xl font-black uppercase">{customer.full_name}</h1>
            <p className="mt-1 font-mono text-boss-gold">{customer.shipping_id}</p>
            <p className="mt-1 text-sm text-muted">
              {customer.email} · {customer.contact_number} · {customer.parish}
            </p>
            {deliveryAddress && (
              <p className="mt-1.5 text-sm text-muted">
                <span className="font-medium text-foreground/80">Delivery: </span>
                {deliveryAddress.label ? `${deliveryAddress.label} · ` : ''}
                {deliveryAddress.formatted.replace(/\n/g, ', ')}
                {delivery_addresses.length > 1
                  ? ` · +${delivery_addresses.length - 1} more`
                  : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canBrowseDirectory ? (
            <Link to="/warehouse/customers">
              <Button variant="outline" className="!text-xs">
                Directory
              </Button>
            </Link>
          ) : (
            <Link to="/warehouse">
              <Button variant="outline" className="!text-xs">
                Floor
              </Button>
            </Link>
          )}
          <Link to={`/warehouse/receive?shipping_id=${encodeURIComponent(customer.shipping_id)}`}>
            <Button className="!text-xs">Receive package</Button>
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {canManageBilling ? (
          <SummaryCard
            icon={DollarSign}
            label="Total due"
            value={formatJmd(billingSummary.total_due_jmd)}
            sub={`${billingSummary.ready_count} bill${billingSummary.ready_count === 1 ? '' : 's'} awaiting payment`}
            tone={billingSummary.total_due_jmd > 0 ? 'due' : 'default'}
          />
        ) : null}
        <SummaryCard
          icon={ShoppingBag}
          label="Ready for pickup"
          value={String(readyForPickupCount)}
          sub={
            readyForPickupCount === 0
              ? 'None waiting'
              : `${readyPaidCount} paid · ready for delivery/pickup`
          }
          tone={readyForPickupCount > 0 ? 'ready' : 'default'}
        />
        <SummaryCard
          icon={Package}
          label="Packages"
          value={String(billingSummary.package_count)}
          sub={`${billingSummary.paid_count} paid`}
        />
        {canManageBilling ? (
          <SummaryCard
            icon={DollarSign}
            label="Checkouts"
            value={String(checkouts.length)}
            sub="Payment history"
          />
        ) : null}
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
          {activePackages.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              {packages.length === 0 ? 'No packages yet.' : 'No active packages.'}
            </p>
          ) : (
            <PackageHistoryTable
              packages={activePackages}
              selectedIds={selectedIds}
              canManagePackages={canManagePackages}
              canManageBilling={canManageBilling}
              canMarkDelivered={canMarkDelivered}
              deliverLoadingId={deliverLoadingId}
              onToggleSelected={toggleSelected}
              onManage={(pkg) => setManagePkg({ ...pkg, customer })}
              onPay={(pkg) => setPayPkg({ ...pkg, customer })}
              onOpenBill={(pkg) => void handleOpenBillInvoice(pkg)}
              onMarkDelivered={(id) => void handleMarkDelivered(id)}
              showSelection
            />
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">
          Completed
          {completedPackages.length > 0 ? ` · ${completedPackages.length}` : ''}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {completedPackages.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              No delivered or picked-up packages yet.
            </p>
          ) : (
            <PackageHistoryTable
              packages={completedPage}
              selectedIds={selectedIds}
              canManagePackages={canManagePackages}
              canManageBilling={canManageBilling}
              canMarkDelivered={canMarkDelivered}
              deliverLoadingId={deliverLoadingId}
              onToggleSelected={toggleSelected}
              onManage={(pkg) => setManagePkg({ ...pkg, customer })}
              onPay={(pkg) => setPayPkg({ ...pkg, customer })}
              onOpenBill={(pkg) => void handleOpenBillInvoice(pkg)}
              onMarkDelivered={(id) => void handleMarkDelivered(id)}
              showSelection={false}
            />
          )}
        </div>
        {completedPackages.length > completedPageSize && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Showing {completedOffset + 1}–
              {Math.min(completedOffset + completedPageSize, completedPackages.length)} of{' '}
              {completedPackages.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="!py-1.5 !text-xs"
                disabled={completedOffset === 0}
                onClick={() => setCompletedOffset((prev) => Math.max(0, prev - completedPageSize))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="!py-1.5 !text-xs"
                disabled={completedOffset + completedPageSize >= completedPackages.length}
                onClick={() =>
                  setCompletedOffset((prev) =>
                    Math.min(
                      prev + completedPageSize,
                      Math.max(0, (completedTotalPages - 1) * completedPageSize),
                    ),
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
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

      {canManageBilling ? (
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
                          onClick={() => void handleOpenCheckoutBillInvoice(checkout.id)}
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
      ) : null}

      {managePkg && (
        <PackageStaffModal
          pkg={managePkg}
          onClose={() => setManagePkg(null)}
          onUpdated={(updated) => handlePackageUpdated({ ...updated, customer })}
          onUnassigned={() => {
            setManagePkg(null)
            loadAccount()
          }}
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
          customerEmail={customer?.email}
          pendingDeliveryRequests={account?.pending_delivery_requests}
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

function PackageHistoryTable({
  packages,
  selectedIds,
  canManagePackages,
  canManageBilling,
  canMarkDelivered,
  deliverLoadingId,
  onToggleSelected,
  onManage,
  onPay,
  onOpenBill,
  onMarkDelivered,
  showSelection,
}: {
  packages: Pkg[]
  selectedIds: string[]
  canManagePackages: boolean
  canManageBilling: boolean
  canMarkDelivered: boolean
  deliverLoadingId: string | null
  onToggleSelected: (id: string) => void
  onManage: (pkg: Pkg) => void
  onPay: (pkg: Pkg) => void
  onOpenBill: (pkg: Pkg) => void
  onMarkDelivered: (id: string) => void
  showSelection: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead className="border-b border-border bg-background/50 text-xs uppercase tracking-wider text-muted">
          <tr>
            {showSelection && <th className="w-10 px-4 py-3" />}
            <th className="px-4 py-3">Tracking</th>
            <th className="px-4 py-3">Weight</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Billing</th>
            <th className="px-4 py-3 text-right">Freight</th>
            <th className="px-4 py-3 text-right">Duties</th>
            <th className="px-4 py-3 text-right">Handling</th>
            <th className="px-4 py-3 text-right">Other</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {packages.map((pkg) => (
            <tr key={pkg.id}>
              {showSelection && (
                <td className="px-4 py-3">
                  {packageEligibleForPayment(pkg) ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(pkg.id)}
                      onChange={() => onToggleSelected(pkg.id)}
                      aria-label={`Select ${pkg.tracking_number}`}
                    />
                  ) : null}
                </td>
              )}
              <td className="px-4 py-3 font-mono text-boss-gold">{pkg.tracking_number}</td>
              <td className="px-4 py-3">{formatPackageWeight(pkg)}</td>
              <td className="px-4 py-3">{pkg.status_label}</td>
              <td className="px-4 py-3">{pkg.billing_status_label}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatPackageFeeCell(pkg.estimated_freight_jmd)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatPackageFeeCell(pkg.duties_jmd)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatPackageFeeCell(pkg.handling_jmd)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatPackageFeeCell(pkg.other_fees_jmd)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatPackageCost(pkg) ?? '—'}
              </td>
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
                    onClick={() => onManage(pkg)}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:border-boss-gold/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border"
                  >
                    Manage
                  </button>
                  {packageEligibleForPayment(pkg) && (
                    <button
                      type="button"
                      disabled={!canManageBilling}
                      title={canManageBilling ? undefined : 'Requires billing permission'}
                      onClick={() => onPay(pkg)}
                      className="rounded-lg border border-boss-gold/30 bg-boss-gold/10 px-2.5 py-1 text-xs font-semibold text-boss-gold hover:bg-boss-gold/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-boss-gold/10"
                    >
                      Pay
                    </button>
                  )}
                  {(pkg.billing_status === 'ready' || pkg.billing_status === 'paid') && (
                    <button
                      type="button"
                      disabled={!canManageBilling}
                      title={canManageBilling ? 'Print payment bill' : 'Requires billing permission'}
                      onClick={() => onOpenBill(pkg)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:border-boss-gold/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border"
                    >
                      Bill
                    </button>
                  )}
                  {pkg.invoice_url && (
                    <a
                      href={pkg.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Customer-uploaded invoice or receipt"
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:border-boss-gold/40 hover:text-boss-gold"
                    >
                      Receipt
                    </a>
                  )}
                  {pkg.status === 'ready_for_pickup' && pkg.billing_status === 'paid' && (
                    <button
                      type="button"
                      disabled={!canMarkDelivered || deliverLoadingId === pkg.id}
                      title={
                        canMarkDelivered
                          ? undefined
                          : 'Requires billing or pickup status permission'
                      }
                      onClick={() => onMarkDelivered(pkg.id)}
                      className="rounded-lg border border-boss-green/30 bg-boss-green/10 px-2.5 py-1 text-xs font-semibold text-boss-green hover:bg-boss-green/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deliverLoadingId === pkg.id ? '…' : 'Deliver'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: typeof DollarSign
  label: string
  value: string
  sub: string
  tone?: 'default' | 'due' | 'ready'
}) {
  const shell =
    tone === 'due'
      ? 'border-boss-gold/50 bg-boss-gold/10 shadow-[0_0_0_1px_rgba(212,175,55,0.12)]'
      : tone === 'ready'
        ? 'border-boss-green/45 bg-boss-green/10 shadow-[0_0_0_1px_rgba(34,197,94,0.12)]'
        : 'border-border bg-card'
  const iconShell =
    tone === 'due'
      ? 'bg-boss-gold/20 text-boss-gold'
      : tone === 'ready'
        ? 'bg-boss-green/20 text-boss-green'
        : 'bg-boss-gold/10 text-boss-gold'
  const valueTone =
    tone === 'due' ? 'text-boss-gold' : tone === 'ready' ? 'text-boss-green' : ''

  return (
    <div className={`rounded-2xl border p-3.5 shadow-sm sm:p-5 ${shell}`}>
      <div className="flex gap-2.5 sm:gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${iconShell}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted sm:text-xs">
            {label}
          </p>
          <p className={`mt-0.5 text-xl font-black sm:mt-1 sm:text-2xl ${valueTone}`}>{value}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted sm:mt-1 sm:text-xs">{sub}</p>
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

