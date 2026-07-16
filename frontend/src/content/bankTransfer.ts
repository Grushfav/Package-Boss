export const BANK_TRANSFER_DETAILS = {
  bankName: '— Bank name —',
  branch: '— Branch —',
  accountName: 'Package Boss Ltd',
  accountNumber: '— Account number —',
  accountType: 'Chequing',
  currency: 'JMD',
  referenceNote:
    'Include your BOSS ID and invoice number in the transfer reference so we can match your payment.',
}

export function formatBankTransferDetails(shippingId?: string | null): string {
  const b = BANK_TRANSFER_DETAILS
  const lines = [
    `Account name: ${b.accountName}`,
    `Bank: ${b.bankName}`,
    `Branch: ${b.branch}`,
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
