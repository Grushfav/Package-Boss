import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, type, ...props },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false)
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  const isPassword = type === 'password'
  const inputClassName = `w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground placeholder:text-muted/60 focus:border-boss-green focus:outline-none focus:ring-1 focus:ring-boss-green${isPassword ? ' pr-11' : ''} ${className}`

  const input = (
    <input
      ref={ref}
      id={inputId}
      type={isPassword && showPassword ? 'text' : type}
      className={inputClassName}
      {...props}
    />
  )

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium uppercase tracking-wider text-muted">
          {label}
        </label>
      )}
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" strokeWidth={2} />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
      ) : (
        input
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
})
