import type { LucideIcon } from 'lucide-react'

interface IconBadgeProps {
  icon: LucideIcon
  size?: 'sm' | 'md'
}

export function IconBadge({ icon: Icon, size = 'md' }: IconBadgeProps) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-boss-green/10 text-boss-green`}
    >
      <Icon className={iconSize} strokeWidth={1.75} />
    </span>
  )
}
