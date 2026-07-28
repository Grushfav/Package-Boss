import { Landmark, MapPin, Package, Sparkles, User, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCustomerData } from '../../context/CustomerDataContext'
import { BANK_TRANSFER_DETAILS } from '../../content/bankTransfer'
import {
  isOnboardingComplete,
  isRecentAccount,
  markOnboardingComplete,
} from '../../lib/onboarding'
import { Button } from '../ui/Button'
import { IconBadge } from '../ui/IconBadge'

type StepId = 'welcome' | 'boss-id' | 'address' | 'packages' | 'bank-transfer'

interface Step {
  id: StepId
  title: string
  icon: typeof User
}

const STEPS: Step[] = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'boss-id', title: 'Your BOSS ID', icon: User },
  { id: 'address', title: 'US address', icon: MapPin },
  { id: 'packages', title: 'Packages', icon: Package },
  { id: 'bank-transfer', title: 'Bank transfer', icon: Landmark },
]

function shouldShowTour(userId: string, createdAt: string | undefined, justSignedUp: boolean): boolean {
  if (isOnboardingComplete(userId)) return false
  if (justSignedUp) return true
  return isRecentAccount(createdAt)
}

export function CustomerOnboardingTour({ justSignedUp = false }: { justSignedUp?: boolean }) {
  const { user } = useAuth()
  const { shippingAddress } = useCustomerData()
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  useEffect(() => {
    if (!user?.id) return
    if (!shouldShowTour(user.id, user.created_at, justSignedUp)) return

    const timer = window.setTimeout(() => setOpen(true), 500)
    return () => window.clearTimeout(timer)
  }, [user?.id, user?.created_at, justSignedUp])

  function closeAndRemember() {
    if (user?.id) markOnboardingComplete(user.id)
    setOpen(false)
  }

  function handleNext() {
    if (isLast) {
      closeAndRemember()
      return
    }
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1))
  }

  function handleBack() {
    setStepIndex((index) => Math.max(index - 1, 0))
  }

  const addressPreview = useMemo(() => {
    if (!shippingAddress) return null
    return [
      shippingAddress.line1,
      shippingAddress.line2,
      `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}`,
      shippingAddress.country,
    ]
      .filter(Boolean)
      .join('\n')
  }, [shippingAddress])

  if (!open || !user || !step) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <IconBadge icon={step.icon} size="sm" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Quick start · {stepIndex + 1} of {STEPS.length}
              </p>
              <h2 id="onboarding-title" className="text-lg font-bold uppercase tracking-wide">
                {step.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAndRemember}
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
            aria-label="Close guide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex justify-center gap-1.5">
            {STEPS.map((item, index) => (
              <span
                key={item.id}
                className={`h-1.5 rounded-full transition-all ${
                  index === stepIndex ? 'w-6 bg-boss-gold' : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          {step.id === 'welcome' && (
            <>
              <p className="text-sm text-muted">
                Hi {user.first_name}! Here is everything you need to start shipping with Package Boss.
                This takes about a minute.
              </p>
              <ul className="space-y-2 text-sm text-foreground/90">
                <li>· Your unique BOSS ID for every order</li>
                <li>· Your Fort Lauderdale shipping address</li>
                <li>· How to track packages and pay</li>
                <li>· Bank transfer details in JMD</li>
              </ul>
            </>
          )}

          {step.id === 'boss-id' && (
            <>
              <p className="text-sm text-muted">
                Your BOSS ID identifies every package you send to our warehouse. Use it when you shop
                online and on bank transfers.
              </p>
              <div className="rounded-xl border border-boss-gold/35 bg-boss-gold/10 px-4 py-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your BOSS ID</p>
                <p className="mt-2 font-mono text-2xl font-black text-boss-gold">{user.shipping_id}</p>
              </div>
              <p className="text-sm text-muted">
                Put this on <span className="font-semibold text-foreground">address line 2</span> at
                checkout. It also appears in the site header — tap it anytime to return to your dashboard.
              </p>
            </>
          )}

          {step.id === 'address' && (
            <>
              <p className="text-sm text-muted">
                Shop in the US using your personal Fort Lauderdale address. We receive packages there
                and fly them to Jamaica for you.
              </p>
              {addressPreview ? (
                <pre className="whitespace-pre-wrap rounded-xl border border-dashed border-boss-gold/45 bg-background px-4 py-4 font-mono text-sm leading-relaxed">
                  {addressPreview}
                </pre>
              ) : (
                <p className="rounded-xl border border-border bg-background px-4 py-4 text-sm text-muted">
                  Loading your address… it will appear on the dashboard home page. Remember to put{' '}
                  <span className="font-mono font-bold text-boss-gold">{user.shipping_id}</span> on line 2.
                </p>
              )}
              <p className="text-sm text-muted">
                Copy the full address from your dashboard whenever you check out online.
              </p>
            </>
          )}

          {step.id === 'packages' && (
            <>
              <p className="text-sm text-muted">
                After you order, submit a <span className="font-semibold text-foreground">pre-alert</span>{' '}
                with the carrier tracking number so we can match your package on arrival.
              </p>
              <ul className="space-y-2 rounded-xl border border-border bg-background px-4 py-4 text-sm">
                <li>
                  <span className="font-semibold text-foreground">Pre-alerts</span> — tell us what is on
                  the way
                </li>
                <li>
                  <span className="font-semibold text-foreground">Packages</span> — track status from
                  received to ready for pickup or delivery
                </li>
                <li>
                  <span className="font-semibold text-foreground">Notifications</span> — updates in your
                  inbox and by email
                </li>
              </ul>
              <Link
                to="/pre-alerts/new"
                className="inline-block text-sm font-semibold text-boss-gold hover:underline"
                onClick={closeAndRemember}
              >
                Create your first pre-alert →
              </Link>
            </>
          )}

          {step.id === 'bank-transfer' && (
            <>
              <p className="text-sm text-muted">
                Pay freight and duties in Jamaican dollars by bank transfer. Include your BOSS ID in the
                reference so we can match your payment.
              </p>
              <div className="rounded-xl border border-border bg-background px-4 py-4 text-sm">
                <p className="font-semibold">{BANK_TRANSFER_DETAILS.bankName}</p>
                <p className="mt-1 font-mono text-boss-gold">{BANK_TRANSFER_DETAILS.accountNumber}</p>
                <p className="mt-2 text-xs text-muted">{BANK_TRANSFER_DETAILS.referenceNote}</p>
              </div>
              <Link
                to="/dashboard/bank-transfer"
                className="inline-block text-sm font-semibold text-boss-gold hover:underline"
                onClick={closeAndRemember}
              >
                Open bank transfer page →
              </Link>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={closeAndRemember}
            className="text-xs font-semibold text-muted hover:text-foreground"
          >
            Skip for now
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button type="button" onClick={handleNext}>
              {isLast ? 'Get started' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
