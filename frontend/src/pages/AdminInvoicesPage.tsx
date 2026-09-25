import { FileText, Printer, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAdminInvoices, type AdminInvoice, type AdminInvoiceSummary } from '../api/admin'
import { getErrorMessage } from '../api/client'
import { openCheckoutBillInvoice } from '../api/staff'
import { Button } from '../components/ui/Button'
import { IconBadge } from '../components/ui/IconBadge'
import { Input } from '../components/ui/Input'
import { formatJmd } from '../lib/money'

const JAMAICA_TZ = 'America/Jamaica'

function jamaicaIsoDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JAMAICA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function monthStart() {
  const today = jamaicaIsoDate()
  return `${today.slice(0, 8)}01`
}

const PAGE_SIZE = 25

const EMPTY_SUMMARY: AdminInvoiceSummary = {
  count: 0,
  total_jmd: 0,
  packages_jmd: 0,
  delivery_fee_jmd: 0,
  processing_fee_jmd: 0,
}

export function AdminInvoicesPage() {
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(jamaicaIsoDate)
  const [method, setMethod] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [invoices, setInvoices] = useState<AdminInvoice[]>([])
  const [summary, setSummary] = useState<AdminInvoiceSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [printingId, setPrintingId] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminInvoices({ from, to, method, q: query, limit: PAGE_SIZE, offset })
      if (seq !== requestSeq.current) return
      setInvoices(data.invoices)
      setSummary(data.summary)
      setTotal(data.total)
    } catch (err) {
      if (seq !== requestSeq.current) return
      setError(getErrorMessage(err))
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [from, to, method, query, offset])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  function resetPage() {
    setOffset(0)
  }

  useEffect(() => {
    void load()
  }, [load])

  async function handlePrint(id: string) {
    setError('')
    setPrintingId(id)
    try {
      await openCheckoutBillInvoice(id)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setPrintingId(null)
    }
  }

  return (
    <div className="px-4 py-8 print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2.5">
          <IconBadge icon={FileText} size="sm" />
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wide">Invoices</h1>
            <p className="mt-1 text-sm text-muted">
              Recorded payments for accounting. Print opens the checkout invoice.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print list
        </Button>
      </div>

      <h1 className="mb-4 hidden text-lg font-bold uppercase print:block">Invoice ledger</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-xs font-semibold text-muted">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              resetPage()
            }}
            className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs font-semibold text-muted">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              resetPage()
            }}
            className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs font-semibold text-muted">
          Method
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value)
              resetPage()
            }}
            className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">All</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </label>
        <div className="min-w-[220px] flex-1">
          <Input
            label="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              resetPage()
            }}
            placeholder="Invoice, BOSS ID, or customer"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          <Search className="h-4 w-4" />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Invoices" value={String(summary.count)} />
        <Summary label="Package charges" value={formatJmd(summary.packages_jmd)} />
        <Summary label="Delivery fees" value={formatJmd(summary.delivery_fee_jmd)} />
        <Summary label="Collected" value={formatJmd(summary.total_jmd)} emphasis />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Packages</th>
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Processing</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3 text-right print:hidden">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted">
                  No invoices in this range.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-muted">
                    {new Date(invoice.recorded_at).toLocaleString(undefined, {
                      timeZone: JAMAICA_TZ,
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-boss-gold">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{invoice.customer_name ?? '—'}</p>
                    {invoice.shipping_id && (
                      <p className="mt-0.5 font-mono text-xs text-muted">{invoice.shipping_id}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{invoice.method_label}</td>
                  <td className="px-4 py-3 tabular-nums">{formatJmd(invoice.packages_jmd)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatJmd(invoice.delivery_fee_jmd ?? 0)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatJmd(invoice.processing_fee_jmd ?? 0)}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {formatJmd(invoice.total_jmd)}
                  </td>
                  <td className="px-4 py-3 text-right print:hidden">
                    <Button
                      type="button"
                      variant="outline"
                      className="!text-xs"
                      disabled={printingId === invoice.id}
                      onClick={() => void handlePrint(invoice.id)}
                    >
                      {printingId === invoice.id ? 'Opening…' : 'Print'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between print:hidden">
          <p className="text-sm text-muted">
            Page {currentPage} of {totalPages} ({total} invoices)
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="!py-2 !text-xs"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={offset + PAGE_SIZE >= total || loading}
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

function Summary({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${emphasis ? 'text-boss-green' : ''}`}>
        {value}
      </p>
    </div>
  )
}
