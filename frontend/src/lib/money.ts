export function formatJmd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  if (amount === Math.trunc(amount)) {
    return `J$${amount.toLocaleString('en-JM')}`
  }
  return `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function sumJmd(values: Array<number | null | undefined>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
}
