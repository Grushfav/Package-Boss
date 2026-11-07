import { useEffect, useRef, useState, type ReactNode } from 'react'

export type PackageLoaderPhase = 'arrive' | 'transform' | 'load' | 'complete' | 'fade'

export type PackageLoaderProps = {
  done?: boolean
  failed?: boolean
  variant?: 'inline' | 'fullscreen'
  size?: 'sm' | 'md' | 'lg'
  label?: string
  onComplete?: () => void
  className?: string
}

const ARRIVE_MS = 600
const TRANSFORM_MS = 500
const MIN_LOAD_MS = 800
const COMPLETE_MS = 700
const FADE_MS = 400

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

export function PackageLoader({
  done = false,
  failed = false,
  variant = 'inline',
  size = 'md',
  label,
  onComplete,
  className = '',
}: PackageLoaderProps) {
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<PackageLoaderPhase>('arrive')
  const loadEnteredAt = useRef<number | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const finishedRef = useRef(false)

  useEffect(() => {
    finishedRef.current = false
    setPhase('arrive')
    loadEnteredAt.current = null
  }, [])

  useEffect(() => {
    if (finishedRef.current) return

    if (reduced) {
      if (failed) {
        setPhase('fade')
        const t = window.setTimeout(() => {
          finishedRef.current = true
          onCompleteRef.current?.()
        }, FADE_MS)
        return () => window.clearTimeout(t)
      }
      if (done) {
        setPhase('complete')
        const t = window.setTimeout(() => {
          finishedRef.current = true
          onCompleteRef.current?.()
        }, 250)
        return () => window.clearTimeout(t)
      }
      setPhase('load')
      return
    }

    if (phase === 'arrive') {
      const t = window.setTimeout(() => setPhase('transform'), ARRIVE_MS)
      return () => window.clearTimeout(t)
    }

    if (phase === 'transform') {
      const t = window.setTimeout(() => {
        loadEnteredAt.current = performance.now()
        setPhase('load')
      }, TRANSFORM_MS)
      return () => window.clearTimeout(t)
    }

    if (phase === 'load') {
      if (!done && !failed) return
      const entered = loadEnteredAt.current ?? performance.now()
      const waited = performance.now() - entered
      const remaining = Math.max(0, MIN_LOAD_MS - waited)
      const t = window.setTimeout(() => {
        setPhase(failed ? 'fade' : 'complete')
      }, remaining)
      return () => window.clearTimeout(t)
    }

    if (phase === 'complete') {
      if (failed) {
        setPhase('fade')
        return
      }
      const t = window.setTimeout(() => {
        finishedRef.current = true
        onCompleteRef.current?.()
      }, COMPLETE_MS)
      return () => window.clearTimeout(t)
    }

    if (phase === 'fade') {
      const t = window.setTimeout(() => {
        finishedRef.current = true
        onCompleteRef.current?.()
      }, FADE_MS)
      return () => window.clearTimeout(t)
    }
  }, [phase, done, failed, reduced])

  const classes = [
    'pb-loader',
    `pb-loader--${size}`,
    variant === 'fullscreen' ? 'pb-loader--fullscreen' : '',
    `pb-loader--phase-${phase}`,
    reduced ? 'pb-loader--reduced' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} role="status" aria-live="polite" aria-busy={phase !== 'complete' && phase !== 'fade'}>
      <div className="pb-loader__stage">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <ellipse className="pb-loader__shadow" cx="60" cy="102" rx="28" ry="6" />

          <g className="pb-loader__stripes">
            <rect className="pb-loader__stripe" x="8" y="38" width="34" height="5" rx="2.5" fill="url(#pbStripeGold)" />
            <rect className="pb-loader__stripe" x="4" y="50" width="42" height="5" rx="2.5" fill="url(#pbStripeGreen)" />
            <rect className="pb-loader__stripe" x="10" y="62" width="30" height="5" rx="2.5" fill="url(#pbStripeMix)" />
            <rect className="pb-loader__stripe" x="6" y="74" width="36" height="5" rx="2.5" fill="url(#pbStripeGreen)" />
          </g>

          <g className="pb-loader__ring">
            <circle
              cx="60"
              cy="56"
              r="40"
              fill="none"
              stroke="url(#pbRingGrad)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="70 180"
            />
            <circle cx="60" cy="16" r="3.5" fill="var(--pb-green, #22c55e)" />
          </g>

          <g className="pb-loader__box pb-loader__box-closed">
            <path
              d="M38 44 L60 32 L82 44 L82 72 L60 84 L38 72 Z"
              fill="var(--pb-gold, #eab308)"
              stroke="#111"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M38 44 L60 56 L82 44" fill="none" stroke="#111" strokeWidth="1.5" />
            <path d="M60 56 L60 84" fill="none" stroke="#111" strokeWidth="1.5" />
            <path d="M48 38 L72 38" stroke="#111" strokeWidth="4" strokeLinecap="round" />
          </g>

          <g className="pb-loader__box pb-loader__box-open">
            <path
              d="M38 50 L60 38 L82 50 L82 76 L60 88 L38 76 Z"
              fill="var(--pb-gold, #eab308)"
              stroke="#111"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M38 50 L60 62 L82 50" fill="none" stroke="#111" strokeWidth="1.5" />
            <path d="M60 62 L60 88" fill="none" stroke="#111" strokeWidth="1.5" />
            <path d="M60 38 L48 22 L38 50" fill="var(--pb-gold, #eab308)" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M60 38 L72 22 L82 50" fill="var(--pb-gold, #eab308)" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M48 22 L60 14 L72 22" fill="#fde68a" stroke="#111" strokeWidth="1" opacity="0.9" />
          </g>

          <g className="pb-loader__burst">
            <path d="M60 8 L64 20 L56 20 Z" fill="var(--pb-gold, #eab308)" />
            <path d="M88 28 L82 38 L76 30 Z" fill="var(--pb-green, #22c55e)" />
            <path d="M32 28 L38 38 L44 30 Z" fill="var(--pb-green, #22c55e)" />
            <path d="M92 52 L84 54 L88 62 Z" fill="var(--pb-gold, #eab308)" />
            <path d="M28 52 L36 54 L32 62 Z" fill="var(--pb-gold, #eab308)" />
          </g>

          <defs>
            <linearGradient id="pbStripeGold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
            <linearGradient id="pbStripeGreen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
            <linearGradient id="pbStripeMix" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
            <linearGradient id="pbRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {label ? <p className="pb-loader__label">{label}</p> : null}
    </div>
  )
}

export function PackageLoaderGate({
  ready,
  failed = false,
  children,
  ...loaderProps
}: {
  ready: boolean
  failed?: boolean
  children: ReactNode
} & Omit<PackageLoaderProps, 'done' | 'failed' | 'onComplete'>) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!ready && !failed) setRevealed(false)
  }, [ready, failed])

  if (revealed) return <>{children}</>

  return (
    <PackageLoader
      {...loaderProps}
      done={ready && !failed}
      failed={failed}
      onComplete={() => setRevealed(true)}
    />
  )
}
