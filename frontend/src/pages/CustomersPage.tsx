import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomers } from '../api/staff'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { WORKFLOW_STATUSES } from '../lib/packageStatuses'
import type { StaffCustomer } from '../types'

const PAGE_SIZE = 25

type ActivePackagesFilter = 'any' | 'has' | 'none'

const PACKAGE_STATUS_FILTERS = WORKFLOW_STATUSES.filter((s) => s.value !== 'delivered')

export function CustomersPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [packageStatus, setPackageStatus] = useState('')
  const [activePackages, setActivePackages] = useState<ActivePackagesFilter>('any')
  const [openRequest, setOpenRequest] = useState(false)
  const [customers, setCustomers] = useState<StaffCustomer[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
      setOffset(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
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
        setCustomers([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [debouncedQuery, offset, packageStatus, activePackages, openRequest])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const filtersActive = Boolean(packageStatus) || activePackages !== 'any' || openRequest

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <IconBadge icon={Users} size="sm" />
        <div>
          <h1 className="text-2xl font-black uppercase">Customer Directory</h1>
          <p className="text-sm text-muted">Browse customers, view accounts, or start a receival</p>
        </div>
      </div>

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
                <th className="w-[7.5rem] px-2 py-3 text-right sm:w-auto sm:px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer) => (
                <CustomerRow key={customer.id} customer={customer} />
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
    </div>
  )
}

function CustomerRow({ customer }: { customer: StaffCustomer }) {
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
      <td className="px-2 py-3 text-center font-semibold tabular-nums sm:px-4">
        {customer.active_package_count ?? 0}
      </td>
      <td className="px-2 py-3 text-right sm:px-4">
        <Link
          to={`/warehouse/customers/${encodeURIComponent(customer.shipping_id)}`}
          className="inline-flex rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase hover:border-boss-gold/40 sm:px-3 sm:text-xs"
        >
          <span className="sm:hidden">View</span>
          <span className="hidden sm:inline">View account</span>
        </Link>
      </td>
    </tr>
  )
}
