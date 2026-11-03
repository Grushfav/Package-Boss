export const ACCOUNT_TYPES = ['personal', 'business'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export function parseAccountTypeFields(data: Record<string, unknown>): {
  accountType: AccountType
  companyName: string | null
} {
  const raw = String(data.account_type ?? 'personal').trim().toLowerCase()
  if (!(ACCOUNT_TYPES as readonly string[]).includes(raw)) {
    throw new Error('account_type must be personal or business')
  }
  const accountType = raw as AccountType
  const companyName = String(data.company_name ?? '').trim() || null

  if (accountType === 'business') {
    if (!companyName) throw new Error('Company name is required for business accounts')
    const trn = String(data.trn ?? '').trim()
    if (!trn) throw new Error('TRN is required for business accounts')
  }

  return {
    accountType,
    companyName: accountType === 'business' ? companyName : null,
  }
}
