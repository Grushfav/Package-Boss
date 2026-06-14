import { CheckCircle2, Circle } from 'lucide-react'
import type { PackageEvent } from '../../types'

interface PackageTimelineProps {
  events: PackageEvent[]
  currentStatus?: string
}

export function PackageTimeline({ events, currentStatus }: PackageTimelineProps) {
  if (!events.length) {
    return <p className="text-sm text-muted">No tracking events yet.</p>
  }

  return (
    <ol className="space-y-4">
      {events.map((event, index) => {
        const isLast = index === events.length - 1
        const isCurrent = event.status === currentStatus && isLast

        return (
          <li key={event.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              {isCurrent ? (
                <CheckCircle2 className="h-5 w-5 text-boss-green" strokeWidth={2} />
              ) : (
                <Circle className="h-5 w-5 text-muted" strokeWidth={2} />
              )}
              {!isLast && <span className="mt-1 h-full w-px flex-1 bg-border" />}
            </div>
            <div className="pb-2">
              <p className={`font-semibold ${isCurrent ? 'text-boss-green' : 'text-foreground'}`}>
                {event.status_label}
              </p>
              {event.note && <p className="mt-1 text-sm text-muted">{event.note}</p>}
              <p className="mt-1 text-xs text-muted">
                {new Date(event.created_at).toLocaleString()}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
