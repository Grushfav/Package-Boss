import type { LogisticsJob } from '../../types'

export const LOGISTICS_TRACKING_STEPS = [
  { key: 'pending', label: 'Searching for driver' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'completed', label: 'Delivered' },
] as const

export type LogisticsTrackingStepKey = (typeof LOGISTICS_TRACKING_STEPS)[number]['key']

const STEP_ORDER: LogisticsJob['status'][] = [
  'pending',
  'picked_up',
  'in_transit',
  'completed',
]

export function logisticsTrackingStepIndex(status: LogisticsJob['status']): number {
  if (status === 'cancelled' || status === 'rejected') return -1
  const index = STEP_ORDER.indexOf(status)
  return index >= 0 ? index : 0
}

interface LogisticsStatusTrackerProps {
  status: LogisticsJob['status']
  driverName?: string | null
  compact?: boolean
}

export function LogisticsStatusTracker({
  status,
  driverName,
  compact = false,
}: LogisticsStatusTrackerProps) {
  if (status === 'cancelled') {
    return (
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Cancelled</p>
    )
  }

  if (status === 'rejected') {
    return (
      <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Rejected</p>
    )
  }

  const currentIndex = logisticsTrackingStepIndex(status)
  const pendingStepLabel =
    status === 'pending' && driverName ? 'Driver assigned' : LOGISTICS_TRACKING_STEPS[0].label

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <ol className="grid gap-2 sm:grid-cols-4">
        {LOGISTICS_TRACKING_STEPS.map((step, index) => {
          const stepLabel = index === 0 ? pendingStepLabel : step.label
          const done = currentIndex > index || status === 'completed'
          const active = currentIndex === index && status !== 'completed'
          return (
            <li
              key={step.key}
              className={`rounded-lg border px-3 py-2.5 ${
                done
                  ? 'border-boss-green/40 bg-boss-green/10'
                  : active
                    ? 'border-boss-gold bg-boss-gold/10 ring-1 ring-boss-gold/30'
                    : 'border-border bg-background/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    done
                      ? 'bg-boss-green text-black'
                      : active
                        ? 'bg-boss-gold text-black'
                        : 'bg-muted/30 text-muted'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
                <span
                  className={`text-[11px] font-semibold leading-tight ${
                    done || active ? 'text-foreground' : 'text-muted'
                  }`}
                >
                  {stepLabel}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
