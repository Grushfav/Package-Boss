import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost'
  fullWidth?: boolean
}

const variants = {
  primary:
    'bg-boss-gold hover:bg-boss-gold-dim text-black font-semibold',
  outline:
    'border border-border hover:border-boss-green hover:text-boss-green text-foreground',
  ghost: 'text-muted hover:text-foreground',
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-lg px-5 py-2.5 text-sm uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
