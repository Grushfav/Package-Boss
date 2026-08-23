import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getErrorMessage } from '../../api/client'
import { fetchMyPackageBillInvoiceHtml } from '../../api/packages'
import { Button } from '../../components/ui/Button'

export function PackageBillPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!packageId) {
      setError('Package not found.')
      setLoading(false)
      return
    }

    fetchMyPackageBillInvoiceHtml(packageId)
      .then(setHtml)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [packageId])

  if (loading) {
    return <p className="text-sm text-muted">Loading invoice...</p>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-red-400">{error}</p>
        <Link to="/dashboard/packages" className="mt-4 inline-block">
          <Button type="button" variant="outline">
            Back to packages
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wide">Package invoice</h2>
          <p className="text-sm text-muted">Review your bill and print a copy for your records.</p>
        </div>
        <Link to="/dashboard/packages">
          <Button type="button" variant="outline">
            Back to packages
          </Button>
        </Link>
      </div>
      <iframe
        title="Package invoice"
        srcDoc={html}
        className="min-h-[80vh] w-full rounded-xl border border-border bg-white"
      />
    </div>
  )
}
