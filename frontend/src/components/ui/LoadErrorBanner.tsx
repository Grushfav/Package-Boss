import { USER_ERROR } from '../../api/client'
import { Button } from './Button'

export function LoadErrorBanner({
  message,
  onRetry,
  className = '',
}: {
  message?: string | null
  onRetry?: () => void
  className?: string
}) {
  if (!message) return null

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 ${className}`}
      role="alert"
    >
      <p>{message || USER_ERROR.generic}</p>
      {onRetry && (
        <Button type="button" variant="outline" className="!text-xs" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
