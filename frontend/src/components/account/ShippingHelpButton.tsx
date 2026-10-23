import { HelpCircle, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { MULTI_PACKAGE_HANDLING_NOTE } from '../../lib/checkoutHandling'
import {
  PICKUP_HOURS_SUMMARY,
  PICKUP_LOCATION_LABEL,
} from '../../lib/pickupLocation'
import { SHIPPING_FREQUENCY_BLURB } from '../../content/marketing'

const details = [
  SHIPPING_FREQUENCY_BLURB,
  MULTI_PACKAGE_HANDLING_NOTE,
  `When packages are ready, open Packages, select them, and choose Request pickup or delivery. Home delivery is $800 JMD in Kingston & St. Andrew and $1,000 JMD in Portmore. Pickup at ${PICKUP_LOCATION_LABEL} is free on ${PICKUP_HOURS_SUMMARY}.`,
]

export function ShippingHelpButton() {
  const [open, setOpen] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Shipping help"
        title="Shipping help"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-boss-green hover:text-boss-green"
      >
        <HelpCircle className="h-4 w-4" strokeWidth={2} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-lg font-bold">
                How shipping works
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1 text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              {details.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
