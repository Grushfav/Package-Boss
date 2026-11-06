import type { LucideIcon } from 'lucide-react'

interface IconBadgeProps {
  icon: LucideIcon
  size?: 'sm' | 'md'
  tone?: 'green' | 'gold'
}

export function IconBadge({ icon: Icon, size = 'md', tone = 'green' }: IconBadgeProps) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const toneClass =
    tone === 'gold' ? 'bg-boss-gold/10 text-boss-gold' : 'bg-boss-green/10 text-boss-green'

  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-full ${toneClass}`}>
      <Icon className={iconSize} strokeWidth={1.75} />
    </span>
  )
}
