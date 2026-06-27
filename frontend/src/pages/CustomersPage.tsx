import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomers } from '../api/staff'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import type { StaffCustomer } from '../types'

const PAGE_SIZE = 25

export function CustomersPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
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
    fetchCustomers({ q: debouncedQuery || undefined, limit: PAGE_SIZE, offset })
      .then((data) => {
        setCustomers(data.customers)
        setTotal(data.total)
      })
      .catch(() => {
        setCustomers([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [debouncedQuery, offset])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <IconBadge icon={Users} size="sm" />
          <div>
            <h1 className="text-2xl font-black uppercase">Customer Directory</h1>
            <p className="text-sm text-muted">Browse customers, view accounts, or start a receival</p>
          </div>
        </div>
        <Link to="/warehouse/receive">
          <Button variant="outline" className="!text-xs">
            Scan instead
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <Input
          label="Search by name, BOSS ID, email, or phone"
          placeholder="Jane Doe or BOSS-90009"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted">Loading customers...</p>
        ) : customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            {debouncedQuery ? 'No customers match your search.' : 'No customers registered yet.'}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/50 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">BOSS ID</th>
                <th className="px-4 py-3 hidden sm:table-cell">Parish</th>
                <th className="px-4 py-3 hidden md:table-cell">Contact</th>
                <th className="px-4 py-3 text-right">Action</th>
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
      <td className="px-4 py-3">
        <p className="font-semibold">{customer.full_name}</p>
        <p className="text-xs text-muted sm:hidden">{customer.shipping_id}</p>
      </td>
      <td className="px-4 py-3 font-mono text-boss-green hidden sm:table-cell">
        {customer.shipping_id}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">{customer.parish}</td>
      <td className="px-4 py-3 hidden md:table-cell">
        <p>{customer.email}</p>
        <p className="text-xs text-muted">{customer.contact_number}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            to={`/warehouse/customers/${encodeURIComponent(customer.shipping_id)}`}
            className="inline-flex rounded-lg border border-border px-3 py-1.5 text-xs font-semibold uppercase hover:border-boss-green/40"
          >
            View account
          </Link>
          <Link
            to={`/warehouse/receive?shipping_id=${encodeURIComponent(customer.shipping_id)}`}
            className="inline-flex rounded-lg border border-boss-green/30 bg-boss-green/10 px-3 py-1.5 text-xs font-semibold uppercase text-boss-green hover:bg-boss-green/20"
          >
            Start receival
          </Link>
        </div>
      </td>
    </tr>
  )
}
