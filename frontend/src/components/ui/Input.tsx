import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...props },
  ref,
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium uppercase tracking-wider text-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground placeholder:text-muted/60 focus:border-boss-green focus:outline-none focus:ring-1 focus:ring-boss-green ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
})
