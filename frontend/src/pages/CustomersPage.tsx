import { Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { fetchCustomerAccount, fetchCustomers } from '../api/staff'
import { CheckoutPaymentModal } from '../components/warehouse/CheckoutPaymentModal'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { clerkHasPermission } from '../lib/clerkPermissions'
import { resolveCheckoutDelivery } from '../lib/checkoutDelivery'
import { packageEligibleForPayment } from '../lib/packageBilling'
import { WORKFLOW_STATUSES } from '../lib/packageStatuses'
import type { DeliveryRequest, Package, PaymentCheckout, StaffCustomer } from '../types'

/** Prefer a package set the checkout modal can submit (no partial delivery mismatch). */
function packagesForDirectoryCheckout(
  payable: Package[],
  pendingRequests: DeliveryRequest[],
): Package[] | null {
  if (payable.length === 0) return null

  const byId = new Map(payable.map((pkg) => [pkg.id, pkg]))
  const trySet = (ids: string[]) => {
    const pkgs = ids.map((id) => byId.get(id)).filter((pkg): pkg is Package => Boolean(pkg))
    if (pkgs.length === 0 || pkgs.length !== ids.length) return null
    const state = resolveCheckoutDelivery(
      pkgs.map((pkg) => pkg.id),
      pendingRequests,
    )
    if (state.isPartialMatch || state.hasMultipleRequests) return null
    return pkgs
  }

  // 1) Exact match for a single open delivery request (all those packages payable).
  for (const request of pendingRequests) {
    const ids = (request.packages ?? []).map((pkg) => pkg.package_id)
    const matched = trySet(ids)
    if (matched) return matched
  }

  // 2) All payable packages (counter pickup / no delivery conflict).
  const all = trySet(payable.map((pkg) => pkg.id))
  if (all) return all

  // 3) Payable packages that are not on any open delivery request.
  const onRequest = new Set(
    pendingRequests.flatMap((request) => (request.packages ?? []).map((pkg) => pkg.package_id)),
  )
  const counterOnly = payable.filter((pkg) => !onRequest.has(pkg.id))
  const counter = trySet(counterOnly.map((pkg) => pkg.id))
  if (counter) return counter

  return null
}

const PAGE_SIZE = 15

type ActivePackagesFilter = 'any' | 'has' | 'none'

const PACKAGE_STATUS_FILTERS = WORKFLOW_STATUSES.filter((s) => s.value !== 'delivered')

export function CustomersPage() {
  const { user } = useAuth()
  const perms = user?.permissions || user?.clerk_permissions
  const role = user?.role
  const canManageBilling = clerkHasPermission(perms, 'billing', role)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [packageStatus, setPackageStatus] = useState('')
  const [activePackages, setActivePackages] = useState<ActivePackagesFilter>('any')
  const [openRequest, setOpenRequest] = useState(false)
  const [customers, setCustomers] = useState<StaffCustomer[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [listSuccess, setListSuccess] = useState('')

  const [checkoutShippingId, setCheckoutShippingId] = useState<string | null>(null)
  const [checkoutPackages, setCheckoutPackages] = useState<Package[]>([])
  const [checkoutEmail, setCheckoutEmail] = useState<string | null>(null)
  const [checkoutDeliveryRequests, setCheckoutDeliveryRequests] = useState<DeliveryRequest[]>([])
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null)
  const checkoutSeqRef = useRef(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
      setOffset(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setLoading(true)
    setListError('')
    setListSuccess('')
    fetchCustomers({
      q: debouncedQuery || undefined,
      limit: PAGE_SIZE,
      offset,
      packageStatus: packageStatus || undefined,
      activePackages,
      openRequest,
    })
      .then((data) => {
        setCustomers(data.customers)
        setTotal(data.total)
      })
      .catch((err) => {
        setCustomers([])
        setTotal(0)
        setListError(getErrorMessage(err) || 'Could not load customers')
      })
      .finally(() => setLoading(false))
  }, [debouncedQuery, offset, packageStatus, activePackages, openRequest])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const filtersActive = Boolean(packageStatus) || activePackages !== 'any' || openRequest

  async function handleCheckoutClick(customer: StaffCustomer) {
    if (!canManageBilling) return
    const seq = ++checkoutSeqRef.current
    setListError('')
    setListSuccess('')
    setCheckoutLoadingId(customer.shipping_id)
    try {
      const account = await fetchCustomerAccount(customer.shipping_id)
      if (seq !== checkoutSeqRef.current) return
      const payable = account.packages.filter(packageEligibleForPayment)
      const pendingRequests = account.pending_delivery_requests ?? []
      if (payable.length === 0) {
        setListError(
          `${customer.full_name} has no packages ready for checkout (need Ready for Pickup + bill ready).`,
        )
        return
      }
      const checkoutPkgs = packagesForDirectoryCheckout(payable, pendingRequests)
      if (!checkoutPkgs) {
        setListError(
          `${customer.full_name} has a delivery-request mismatch — open View to select packages, then checkout.`,
        )
        return
      }
      setCheckoutShippingId(customer.shipping_id)
      setCheckoutPackages(checkoutPkgs)
      setCheckoutEmail(account.customer?.email ?? customer.email ?? null)
      setCheckoutDeliveryRequests(pendingRequests)
    } catch (err) {
      if (seq !== checkoutSeqRef.current) return
      setListError(getErrorMessage(err) || 'Could not load checkout packages')
    } finally {
      if (seq === checkoutSeqRef.current) setCheckoutLoadingId(null)
    }
  }

  function handleCheckoutCompleted(
    checkout: PaymentCheckout,
    _packageIds: string[],
    options?: { markDelivered?: boolean; deliveryWarning?: string | null },
  ) {
    setCheckoutShippingId(null)
    setCheckoutPackages([])
    setCheckoutDeliveryRequests([])
    setCheckoutEmail(null)
    let message = `Checkout recorded — ${checkout.invoice_number}`
    if (options?.deliveryWarning) message += ` · ${options.deliveryWarning}`
    setListSuccess(message)
    // Refresh counts after checkout (packages may leave "active" when delivered).
    setLoading(true)
    fetchCustomers({
      q: debouncedQuery || undefined,
      limit: PAGE_SIZE,
      offset,
      packageStatus: packageStatus || undefined,
      activePackages,
      openRequest,
    })
      .then((data) => {
        setCustomers(data.customers)
        setTotal(data.total)
      })
      .catch(() => {
        /* keep current list */
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={Users} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Customer Directory</h1>
          <p className="text-sm text-muted">Browse customers, view accounts, or start a receival</p>
        </div>
      </div>

      {listError && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
          {listError}
        </p>
      )}
      {listSuccess && (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
          {listSuccess}
        </p>
      )}

      <div className="mb-4">
        <Input
          label="Search by name, company, BOSS ID, email, or phone"
          placeholder="Jane Doe, Acme Ltd, or BOSS-01009"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-3 sm:gap-3">
        <div className="space-y-1">
          <label
            htmlFor="directory-package-status"
            className="block text-[10px] font-medium uppercase tracking-wider text-muted sm:text-xs"
          >
            Status
          </label>
          <select
            id="directory-package-status"
            value={packageStatus}
            onChange={(e) => {
              setPackageStatus(e.target.value)
              setOffset(0)
            }}
            className="w-full rounded-lg border border-border bg-input px-2.5 py-2 text-xs text-foreground focus:border-boss-gold focus:outline-none focus:ring-1 focus:ring-boss-gold sm:px-3 sm:py-2.5 sm:text-sm"
          >
            <option value="">Any status</option>
            {PACKAGE_STATUS_FILTERS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="directory-active-packages"
            className="block text-[10px] font-medium uppercase tracking-wider text-muted sm:text-xs"
          >
            Active pkgs
          </label>
          <select
            id="directory-active-packages"
            value={activePackages}
            onChange={(e) => {
              setActivePackages(e.target.value as ActivePackagesFilter)
              setOffset(0)
            }}
            className="w-full rounded-lg border border-border bg-input px-2.5 py-2 text-xs text-foreground focus:border-boss-gold focus:outline-none focus:ring-1 focus:ring-boss-gold sm:px-3 sm:py-2.5 sm:text-sm"
          >
            <option value="any">Any</option>
            <option value="has">Has active</option>
            <option value="none">None active</option>
          </select>
        </div>

        <div className="col-span-2 space-y-1 sm:col-span-1">
          <label
            htmlFor="directory-open-request"
            className="block text-[10px] font-medium uppercase tracking-wider text-muted sm:text-xs"
          >
            Request
          </label>
          <select
            id="directory-open-request"
            value={openRequest ? 'open' : 'any'}
            onChange={(e) => {
              setOpenRequest(e.target.value === 'open')
              setOffset(0)
            }}
            className="w-full rounded-lg border border-border bg-input px-2.5 py-2 text-xs text-foreground focus:border-boss-gold focus:outline-none focus:ring-1 focus:ring-boss-gold sm:px-3 sm:py-2.5 sm:text-sm"
          >
            <option value="any">Any</option>
            <option value="open">Open delivery/pickup</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted">Loading customers...</p>
        ) : customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            {debouncedQuery || filtersActive
              ? 'No customers match your search or filters.'
              : 'No customers registered yet.'}
          </p>
        ) : (
          <table className="w-full table-fixed text-left text-sm sm:table-auto">
            <thead className="border-b border-border bg-background/50 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-3 sm:px-4">Name</th>
                <th className="hidden px-4 py-3 sm:table-cell">BOSS ID</th>
                <th className="hidden px-4 py-3 sm:table-cell">Parish</th>
                <th className="hidden px-4 py-3 md:table-cell">Contact</th>
                <th className="w-16 px-2 py-3 text-center sm:w-auto sm:px-4">Pkgs</th>
                <th className="w-[9.5rem] px-2 py-3 text-right sm:w-auto sm:min-w-[11rem] sm:px-4">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  canCheckout={canManageBilling}
                  checkoutLoading={checkoutLoadingId === customer.shipping_id}
                  onCheckout={() => void handleCheckoutClick(customer)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            Page {currentPage} of {totalPages} ({total} customers)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="!py-2 !text-xs"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="!py-2 !text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {checkoutShippingId && checkoutPackages.length > 0 && (
        <CheckoutPaymentModal
          shippingId={checkoutShippingId}
          packages={checkoutPackages}
          customerEmail={checkoutEmail}
          pendingDeliveryRequests={checkoutDeliveryRequests}
          onClose={() => {
            setCheckoutShippingId(null)
            setCheckoutPackages([])
            setCheckoutDeliveryRequests([])
            setCheckoutEmail(null)
          }}
          onCompleted={handleCheckoutCompleted}
        />
      )}
    </div>
  )
}

function CustomerRow({
  customer,
  canCheckout,
  checkoutLoading,
  onCheckout,
}: {
  customer: StaffCustomer
  canCheckout: boolean
  checkoutLoading: boolean
  onCheckout: () => void
}) {
  const activeCount = customer.active_package_count ?? 0
  const showCheckout = canCheckout && activeCount > 0

  return (
    <tr>
      <td className="px-3 py-3 sm:px-4">
        <p className="font-semibold leading-snug">{customer.full_name}</p>
        {customer.account_type === 'business' && (
          <p className="mt-0.5 text-xs font-semibold text-boss-gold">
            Business{customer.company_name ? ` · ${customer.company_name}` : ''}
          </p>
        )}
        <p className="mt-0.5 font-mono text-xs text-boss-gold sm:hidden">{customer.shipping_id}</p>
        {customer.contact_number && (
          <p className="mt-0.5 text-xs text-muted sm:hidden">{customer.contact_number}</p>
        )}
      </td>
      <td className="hidden px-4 py-3 font-mono text-boss-gold sm:table-cell">
        {customer.shipping_id}
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">{customer.parish}</td>
      <td className="hidden px-4 py-3 md:table-cell">
        <p>{customer.email}</p>
        <p className="text-xs text-muted">{customer.contact_number}</p>
      </td>
      <td className="px-2 py-3 text-center font-semibold tabular-nums sm:px-4">{activeCount}</td>
      <td className="px-2 py-3 text-right sm:px-4">
        <div className="inline-flex flex-col items-stretch gap-1.5 sm:flex-row sm:justify-end">
          {showCheckout && (
            <button
              type="button"
              onClick={onCheckout}
              disabled={checkoutLoading}
              className="inline-flex items-center justify-center rounded-lg border border-boss-gold/50 bg-boss-gold/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase text-boss-gold hover:border-boss-gold disabled:opacity-60 sm:px-3 sm:text-xs"
            >
              {checkoutLoading ? '…' : 'Checkout'}
            </button>
          )}
          <Link
            to={`/warehouse/customers/${encodeURIComponent(customer.shipping_id)}`}
            className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase hover:border-boss-gold/40 sm:px-3 sm:text-xs"
          >
            <span className="sm:hidden">View</span>
            <span className="hidden sm:inline">View</span>
          </Link>
        </div>
      </td>
    </tr>
  )
}
