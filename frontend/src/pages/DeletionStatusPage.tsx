import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import { Seo } from '../components/seo/Seo'
import { PAGE_SEO } from '../lib/seo'

interface DeletionStatus {
  confirmation_code: string
  status: string
  created_at?: string | null
  completed_at?: string | null
}

export function DeletionStatusPage() {
  const [searchParams] = useSearchParams()
  const code = (searchParams.get('code') || '').trim()
  const [status, setStatus] = useState<DeletionStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(code))

  useEffect(() => {
    if (!code) {
      setError('Missing confirmation code.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    api
      .get<DeletionStatus>(`/auth/deletion-status/${encodeURIComponent(code)}`)
      .then(({ data }) => {
        if (!cancelled) setStatus(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Seo
        {...PAGE_SEO.dataDeletion}
        title="Deletion request status — Package Boss"
        path="/deletion-status"
        noindex
      />
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-black uppercase">Deletion request status</h1>
        <p className="mt-2 text-sm text-muted">
          Status for a Facebook / Meta data deletion request linked to Package Boss.
        </p>

        {loading && <p className="mt-6 text-sm text-muted">Checking status…</p>}
        {error && (
          <p className="mt-6 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
        )}
        {status && (
          <div className="mt-6 space-y-2 text-sm">
            <p>
              <span className="text-muted">Confirmation code:</span>{' '}
              <span className="font-mono font-semibold">{status.confirmation_code}</span>
            </p>
            <p>
              <span className="text-muted">Status:</span>{' '}
              <span className="font-semibold capitalize text-boss-green">{status.status}</span>
            </p>
            {status.completed_at && (
              <p className="text-muted">
                Completed at {new Date(status.completed_at).toLocaleString()}
              </p>
            )}
          </div>
        )}

        <p className="mt-8 text-sm text-muted">
          To request full account deletion by email, see our{' '}
          <Link to="/data-deletion" className="text-boss-gold hover:underline">
            data deletion instructions
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
