export const BANK_TRANSFER_DETAILS = {
  accountName: 'Package Boss Shipping & Logistics',
  bankName: 'National Commercial Bank',
  branch: 'Constant Spring',
  branchCode: '00033',
  transitCode: '077',
  swiftCode: 'JNCBJMKX',
  accountNumber: '331825271',
  accountType: 'Current',
  currency: 'JMD',
  referenceNote:
    'Include your BOSS ID and invoice number in the transfer reference so we can match your payment.',
}

export const SENDER_BANKS = [
  { value: 'ncb', label: 'NCB' },
  { value: 'scotiabank', label: 'Scotiabank' },
  { value: 'jmmb', label: 'JMMB' },
  { value: 'sagicor', label: 'Sagicor Bank' },
  { value: 'cibc', label: 'CIBC FirstCaribbean' },
  { value: 'jn_bank', label: 'JN Bank' },
  { value: 'vm_building_society', label: 'Victoria Mutual' },
  { value: 'other', label: 'Other' },
] as const

export type SenderBank = (typeof SENDER_BANKS)[number]['value']

export function senderBankLabel(value?: string | null): string | undefined {
  if (!value) return undefined
  return SENDER_BANKS.find((bank) => bank.value === value)?.label ?? value
}

export function formatBankTransferDetails(shippingId?: string | null): string {
  const b = BANK_TRANSFER_DETAILS
  const lines = [
    `Account name: ${b.accountName}`,
    `Bank: ${b.bankName}`,
    `Branch: ${b.branch}`,
    `Branch code: ${b.branchCode}`,
    `Transit code: ${b.transitCode}`,
    `SWIFT: ${b.swiftCode}`,
    `Account number: ${b.accountNumber}`,
    `Account type: ${b.accountType}`,
    `Currency: ${b.currency}`,
    '',
    b.referenceNote,
  ]
  if (shippingId) {
    lines.push('', `Your BOSS ID: ${shippingId}`)
  }
  return lines.join('\n')
}
