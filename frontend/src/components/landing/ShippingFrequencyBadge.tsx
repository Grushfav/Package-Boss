import { Plane } from 'lucide-react'
import { SHIPPING_FREQUENCY_BADGE } from '../../content/marketing'

interface ShippingFrequencyBadgeProps {
  className?: string
  showIcon?: boolean
}

export function ShippingFrequencyBadge({
  className = '',
  showIcon = true,
}: ShippingFrequencyBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-boss-green/40 bg-boss-green/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-boss-green ${className}`}
    >
      {showIcon && <Plane className="h-3.5 w-3.5" strokeWidth={2.25} />}
      {SHIPPING_FREQUENCY_BADGE}
    </span>
  )
}
