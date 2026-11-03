import { Building2 } from 'lucide-react'
import type { User } from '../../types'

export function BusinessAccountBadge({
  user,
  className = '',
}: {
  user?: Pick<User, 'account_type' | 'company_name'> | null
  className?: string
}) {
  if (!user || user.account_type !== 'business') return null

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-boss-gold/30 bg-boss-gold/10 px-2.5 py-1 text-xs font-semibold text-boss-gold ${className}`}
      title={user.company_name || 'Business account'}
    >
      <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span className="truncate">{user.company_name || 'Business account'}</span>
    </span>
  )
}
