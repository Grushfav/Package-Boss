import { STATUS_BADGE_CLASS } from '../../lib/packageWorkflow'

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        STATUS_BADGE_CLASS[status] ?? 'bg-muted/20 text-muted'
      }`}
    >
      {label}
    </span>
  )
}
