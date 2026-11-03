import type { AccountType } from '../../types'
import { Input } from '../ui/Input'

interface AccountTypeFieldsProps {
  accountType: AccountType
  companyName: string
  trn: string
  onAccountTypeChange: (value: AccountType) => void
  onCompanyNameChange: (value: string) => void
  onTrnChange: (value: string) => void
}

export function AccountTypeFields({
  accountType,
  companyName,
  trn,
  onAccountTypeChange,
  onCompanyNameChange,
  onTrnChange,
}: AccountTypeFieldsProps) {
  const isBusiness = accountType === 'business'

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="block text-xs font-medium uppercase tracking-wider text-muted">
          Account type
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onAccountTypeChange('personal')}
            className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
              accountType === 'personal'
                ? 'border-boss-gold bg-boss-gold/15 text-boss-gold'
                : 'border-border text-muted hover:border-boss-gold/40 hover:text-foreground'
            }`}
          >
            Personal
          </button>
          <button
            type="button"
            onClick={() => onAccountTypeChange('business')}
            className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
              accountType === 'business'
                ? 'border-boss-gold bg-boss-gold/15 text-boss-gold'
                : 'border-border text-muted hover:border-boss-gold/40 hover:text-foreground'
            }`}
          >
            Business
          </button>
        </div>
      </div>

      {isBusiness && (
        <Input
          label="Company name"
          value={companyName}
          onChange={(e) => onCompanyNameChange(e.target.value)}
          required
          autoComplete="organization"
        />
      )}

      <Input
        label={isBusiness ? 'Business TRN (required, 9 digits)' : 'TRN (optional, 9 digits)'}
        placeholder="123456789"
        value={trn}
        onChange={(e) => onTrnChange(e.target.value)}
        required={isBusiness}
        maxLength={11}
      />
    </div>
  )
}
