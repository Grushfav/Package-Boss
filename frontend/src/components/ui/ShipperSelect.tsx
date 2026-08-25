import type { Shipper } from '../../types'

type ShipperSelectProps = {
  label: string
  value: string
  shippers: Shipper[]
  onChange: (code: string) => void
  required?: boolean
  placeholder?: string
  disabled?: boolean
}

export function ShipperSelect({
  label,
  value,
  shippers,
  onChange,
  required = false,
  placeholder = 'Select merchant',
  disabled = false,
}: ShipperSelectProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-wider text-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled || shippers.length === 0}
        className="w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground focus:border-boss-gold focus:outline-none focus:ring-1 focus:ring-boss-gold disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="" disabled>
          {shippers.length === 0 ? 'Loading merchants…' : placeholder}
        </option>
        {shippers.map((shipper) => (
          <option key={shipper.code} value={shipper.code}>
            {shipper.label}
          </option>
        ))}
      </select>
    </div>
  )
}
