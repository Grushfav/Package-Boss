# PackageLoader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a branded `PackageLoader` (arrive → transform → ring → open) and wire it into major customer and warehouse loading placeholders.

**Architecture:** One React phase-machine component plus CSS keyframes (no animation libraries). Parents pass `done` / `failed` and stay mounted until `onComplete`. A thin `PackageLoaderGate` helper keeps wiring DRY. Styles live in `index.css` under a `.pb-loader` namespace using existing boss-green / boss-gold tokens.

**Tech Stack:** React 19, TypeScript, Tailwind v4 + custom CSS keyframes in `frontend/src/index.css`, SVG markup in the component. Verification via `npx tsc -b` and manual visual checks (no frontend unit-test runner in this repo).

## Global Constraints

- No new runtime dependencies (no Lottie, Rive, Framer Motion).
- Use `--color-boss-green` / `--color-boss-gold` (Tailwind `boss-green` / `boss-gold`).
- Hybrid completion: hold load phase until `done` **and** ≥ ~0.8s in load.
- On `failed`, fade out — no open/burst.
- Honor `prefers-reduced-motion: reduce`.
- Do not replace button busy labels, ShipperSelect copy, or onboarding tour text.
- Spec: `docs/superpowers/specs/2026-11-07-package-loader-design.md`.

## File map

| File | Responsibility |
| --- | --- |
| `frontend/src/index.css` | `.pb-loader` keyframes, phase classes, reduced-motion overrides |
| `frontend/src/components/ui/PackageLoader.tsx` | SVG + phase machine + `PackageLoaderGate` |
| Customer / warehouse screens listed in Tasks 3–4 | Swap text loaders for `PackageLoaderGate` |

---

### Task 1: CSS foundation for PackageLoader

**Files:**
- Modify: `frontend/src/index.css` (append at end of file)

**Interfaces:**
- Produces: CSS classes `.pb-loader`, `.pb-loader--sm|md|lg`, `.pb-loader--fullscreen`, `.pb-loader--phase-arrive|transform|load|complete|fade`, `.pb-loader__stage`, `.pb-loader__box`, `.pb-loader__box--open`, `.pb-loader__stripes`, `.pb-loader__stripe`, `.pb-loader__ring`, `.pb-loader__burst`, `.pb-loader__label`, `.pb-loader--reduced`

- [ ] **Step 1: Append loader CSS**

Append to `frontend/src/index.css`:

```css
/* —— PackageLoader —— */
.pb-loader {
  --pb-green: var(--color-boss-green);
  --pb-gold: var(--color-boss-gold);
  --pb-size: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.pb-loader--sm { --pb-size: 72px; }
.pb-loader--md { --pb-size: 120px; }
.pb-loader--lg { --pb-size: 160px; }

.pb-loader--fullscreen {
  min-height: 40vh;
  width: 100%;
}

.pb-loader__stage {
  position: relative;
  width: var(--pb-size);
  height: var(--pb-size);
}

.pb-loader__stage svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.pb-loader__label {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

/* Box slide-in */
.pb-loader--phase-arrive .pb-loader__box {
  animation: pb-loader-arrive 0.6s ease-out both;
}

@keyframes pb-loader-arrive {
  from { transform: translateX(-42%); opacity: 0.35; }
  to { transform: translateX(0); opacity: 1; }
}

/* Stripes: horizontal in arrive → arc slots in transform → hidden when ring owns motion */
.pb-loader__stripes {
  transform-origin: 50% 50%;
}

.pb-loader--phase-arrive .pb-loader__stripes {
  opacity: 1;
}

.pb-loader--phase-transform .pb-loader__stripes {
  animation: pb-loader-stripes-curl 0.5s ease-in-out both;
}

.pb-loader--phase-load .pb-loader__stripes,
.pb-loader--phase-complete .pb-loader__stripes,
.pb-loader--phase-fade .pb-loader__stripes {
  opacity: 0;
  pointer-events: none;
}

@keyframes pb-loader-stripes-curl {
  from { opacity: 1; transform: scaleX(1) rotate(0deg); }
  to { opacity: 0; transform: scaleX(0.35) rotate(-55deg); }
}

/* Ring appears after transform; spins during load */
.pb-loader__ring {
  transform-origin: 50% 50%;
  opacity: 0;
}

.pb-loader--phase-transform .pb-loader__ring {
  animation: pb-loader-ring-in 0.5s ease-out both;
}

.pb-loader--phase-load .pb-loader__ring {
  opacity: 1;
  animation: pb-loader-spin 1.05s linear infinite;
}

.pb-loader--phase-complete .pb-loader__ring,
.pb-loader--phase-fade .pb-loader__ring {
  animation: pb-loader-ring-out 0.35s ease-in both;
}

@keyframes pb-loader-ring-in {
  from { opacity: 0; transform: scale(0.7) rotate(-40deg); }
  to { opacity: 1; transform: scale(1) rotate(0deg); }
}

@keyframes pb-loader-spin {
  to { transform: rotate(360deg); }
}

@keyframes pb-loader-ring-out {
  to { opacity: 0; transform: scale(1.08); }
}

/* Closed vs open box */
.pb-loader__box-open {
  opacity: 0;
}

.pb-loader--phase-complete .pb-loader__box-closed {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.pb-loader--phase-complete .pb-loader__box-open {
  opacity: 1;
  animation: pb-loader-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}

@keyframes pb-loader-pop {
  from { transform: scale(0.92); }
  60% { transform: scale(1.06); }
  to { transform: scale(1); }
}

.pb-loader__burst {
  opacity: 0;
  transform-origin: 50% 40%;
}

.pb-loader--phase-complete .pb-loader__burst {
  animation: pb-loader-burst 0.7s ease-out both;
}

@keyframes pb-loader-burst {
  0% { opacity: 0; transform: scale(0.4); }
  35% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.25); }
}

.pb-loader--phase-fade {
  animation: pb-loader-fade 0.4s ease-in both;
}

@keyframes pb-loader-fade {
  to { opacity: 0; }
}

.pb-loader__shadow {
  fill: rgb(15 23 42 / 0.18);
}

:root.dark .pb-loader__shadow,
.dark .pb-loader__shadow {
  fill: rgb(0 0 0 / 0.45);
}

@media (prefers-reduced-motion: reduce) {
  .pb-loader--reduced .pb-loader__box,
  .pb-loader--reduced .pb-loader__stripes,
  .pb-loader--reduced .pb-loader__ring,
  .pb-loader--reduced .pb-loader__burst {
    animation: none !important;
  }

  .pb-loader--reduced.pb-loader--phase-arrive .pb-loader__box,
  .pb-loader--reduced.pb-loader--phase-transform .pb-loader__box,
  .pb-loader--reduced.pb-loader--phase-load .pb-loader__box {
    animation: pb-loader-pulse 1.2s ease-in-out infinite !important;
  }

  .pb-loader--reduced .pb-loader__stripes,
  .pb-loader--reduced .pb-loader__ring,
  .pb-loader--reduced .pb-loader__burst {
    opacity: 0 !important;
  }

  .pb-loader--reduced.pb-loader--phase-complete .pb-loader__box-closed {
    opacity: 0;
  }

  .pb-loader--reduced.pb-loader--phase-complete .pb-loader__box-open {
    opacity: 1;
  }
}

@keyframes pb-loader-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
```

- [ ] **Step 2: Confirm CSS parses with the app**

Run from `frontend`: `npx vite build` is heavy; instead open `index.css` and ensure no unclosed braces. Optionally run:

```bash
cd frontend
npx tsc -b --pretty false --noEmit
```

Expected: PASS (CSS not typechecked; this just confirms repo still clean).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "Add PackageLoader CSS phase keyframes."
```

---

### Task 2: PackageLoader + PackageLoaderGate components

**Files:**
- Create: `frontend/src/components/ui/PackageLoader.tsx`

**Interfaces:**
- Consumes: CSS classes from Task 1
- Produces:
  - `PackageLoaderProps`: `{ done?: boolean; failed?: boolean; variant?: 'inline' | 'fullscreen'; size?: 'sm' | 'md' | 'lg'; label?: string; onComplete?: () => void; className?: string }`
  - `PackageLoader(props)`
  - `PackageLoaderGate({ ready, failed?, children, ...loaderProps })` — shows loader until outro finishes after `ready` (or `failed`), then renders `children`

- [ ] **Step 1: Create `PackageLoader.tsx`**

Create `frontend/src/components/ui/PackageLoader.tsx` with this full implementation:

```tsx
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
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend
npx tsc -b --pretty false --noEmit
```

Expected: PASS with exit code 0.

- [ ] **Step 3: Manual smoke (optional in agent; required before merge)**

Temporarily render `<PackageLoader label="Demo" />` on any page, confirm arrive → transform → spinning ring. Pass `done` after a few seconds and confirm open/burst. Pass `failed` and confirm fade. Remove the temp render before committing if used.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/PackageLoader.tsx
git commit -m "Add PackageLoader phase animation and gate helper."
```

---

### Task 3: Wire customer screens

**Files:**
- Modify: `frontend/src/components/account/DashboardPackageStatsCard.tsx`
- Modify: `frontend/src/components/account/PackagesHistoryPanel.tsx`
- Modify: `frontend/src/components/account/PreAlertsPanel.tsx`
- Modify: `frontend/src/components/account/MessagesSection.tsx`

**Interfaces:**
- Consumes: `PackageLoaderGate` from `../ui/PackageLoader` (or correct relative path)
- Produces: same page behavior with branded loader instead of text

- [ ] **Step 1: Dashboard first paint**

In `DashboardPackageStatsCard.tsx`:

1. Import `PackageLoaderGate`.
2. When `loading` (`!dashboardStats && dashboardLoading`) **and** no `dashboardError`, replace the stats grid with:

```tsx
<PackageLoaderGate ready={!loading} failed={Boolean(dashboardError)} size="lg" label="Loading your packages…">
  {/* existing grid of StatCards */}
</PackageLoaderGate>
```

Keep the title row and `LoadErrorBanner` outside the gate. When `dashboardError && !dashboardStats`, show the banner (already present) and still allow fade via `failed` if the gate is shown — if error with no stats, prefer banner only (skip loader):

```tsx
{loading && !dashboardError ? (
  <PackageLoader size="lg" label="Loading your packages…" />
) : (
  <div className="grid grid-cols-2 gap-3">...</div>
)}
```

Use the simpler branch above (direct `PackageLoader` while `loading`, no gate needed for always-visible stats skeleton replacement) **or** gate if you hide the whole grid. Prefer:

```tsx
{loading && !dashboardError ? (
  <PackageLoader done={false} size="lg" variant="inline" label="Loading your packages…" />
) : (
  <>
    {dashboardError && (...banner...)}
    <div className="grid ...">...</div>
  </>
)}
```

Note: first paint often ends by `dashboardStats` arriving; unmounting mid-spin is OK for dashboard if we accept cutting the burst. Spec prefers finishing the outro — so use gate:

```tsx
const showInitial = !dashboardStats
// ...
{showInitial ? (
  <PackageLoaderGate
    ready={Boolean(dashboardStats)}
    failed={Boolean(dashboardError)}
    size="lg"
    label="Loading your packages…"
  >
    <div className="grid grid-cols-2 gap-3">{/* StatCards with loading=false */}</div>
  </PackageLoaderGate>
) : (
  <>
    {dashboardError && <LoadErrorBanner ... />}
    <div className="grid ...">...</div>
  </>
)}
```

Once revealed once, subsequent refreshes keep the grid (stale stats) and optional banner — do not re-show the full loader on every soft refresh. Implement with a `hasRevealed` ref or by only using the gate when `!dashboardStats` on first mount as above (after reveal, `dashboardStats` is set so gate path is abandoned on next render of parent — **but** `PackageLoaderGate` sets `revealed` then renders children; if parent switches away from gate entirely when stats exist, that’s fine).

Simplest durable pattern for dashboard:

```tsx
const [introDone, setIntroDone] = useState(false)
const waiting = !dashboardStats && !introDone

if (waiting) {
  return (
    <div className="space-y-4">
      ...header...
      <PackageLoader
        done={Boolean(dashboardStats)}
        failed={Boolean(dashboardError) && !dashboardStats}
        size="lg"
        label="Loading your packages…"
        onComplete={() => setIntroDone(true)}
      />
    </div>
  )
}
// existing return with grid + banner
```

- [ ] **Step 2: PackagesHistoryPanel**

Replace:

- `Loading packages...` (both sections still loading, no totals)
- `Loading active packages...`
- `Loading completed packages...`

with centered `PackageLoader` / `PackageLoaderGate`:

```tsx
{activeLoading && completedLoading && !hasPackages ? (
  <PackageLoaderGate
    ready={!activeLoading && !completedLoading}
    failed={Boolean(activeError || completedError)}
    size="md"
    label="Loading packages…"
  >
    {null}
  </PackageLoaderGate>
) : ...}
```

For the empty-children case after complete, the parent structure already branches — better approach: keep structural branches, only swap the loading `<p>` nodes:

```tsx
{activeLoading && activePackages.length === 0 ? (
  <PackageLoader done={!activeLoading} size="sm" label="Loading active packages…" />
) : ...}
```

Using `done={!activeLoading}` without gate will unmount when loading flips false and may cut the burst. Prefer gate when the loading branch owns the whole section:

```tsx
{activePackages.length === 0 && (activeLoading || activePendingReveal) ? (
  <PackageLoaderGate ready={!activeLoading} failed={Boolean(activeError)} size="sm" label="Loading active packages…">
    {activeTotal === 0 && !activeError ? <p>No active packages…</p> : null}
  </PackageLoaderGate>
) : activePackages.length > 0 ? ( ...cards... ) : ...}
```

Keep selection/pager logic unchanged. Minimum acceptable: swap text for `<PackageLoader done={!activeLoading} size="sm" label="…" />` even if burst is sometimes cut — **prefer gate**.

- [ ] **Step 3: PreAlertsPanel + MessagesSection**

`PreAlertsPanel.tsx` — replace loading card text:

```tsx
{preAlertsLoading && pending.length === 0 ? (
  <PackageLoaderGate ready={!preAlertsLoading} size="sm" label="Loading pre-alerts…">
    {null}
  </PackageLoaderGate>
) : pending.length === 0 ? (
  ...
```

When gate completes with empty pending, children `null` would flash empty — instead:

```tsx
{preAlertsLoading && pending.length === 0 ? (
  <div className="mt-4">
    <PackageLoader done={!preAlertsLoading} size="sm" label="Loading pre-alerts…" />
  </div>
) : pending.length === 0 ? (
```

Same for `MessagesSection.tsx` loading branch.

- [ ] **Step 4: Typecheck**

```bash
cd frontend
npx tsc -b --pretty false --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/account/DashboardPackageStatsCard.tsx frontend/src/components/account/PackagesHistoryPanel.tsx frontend/src/components/account/PreAlertsPanel.tsx frontend/src/components/account/MessagesSection.tsx
git commit -m "Wire PackageLoader into customer loading states."
```

---

### Task 4: Wire warehouse / staff screens

**Files:**
- Modify: `frontend/src/pages/PrintQueuePage.tsx`
- Modify: `frontend/src/pages/UnidentifiedQueuePage.tsx`
- Modify: `frontend/src/pages/DeparturesPage.tsx`
- Modify: `frontend/src/pages/CustomersPage.tsx`
- Modify: `frontend/src/pages/WarehousePreAlertsPage.tsx`
- Modify: `frontend/src/pages/StaffRequestsPage.tsx`
- Modify: `frontend/src/pages/ReceivePage.tsx` (main block loaders only)

**Interfaces:**
- Consumes: `PackageLoader` from `../components/ui/PackageLoader`

- [ ] **Step 1: Queue / list pages**

For each file, find the early `Loading…` paragraph used as the page placeholder and replace with:

```tsx
import { PackageLoader } from '../components/ui/PackageLoader'

// when loading && !data:
<PackageLoader done={false} size="md" label="Loading queue…" />
// or appropriate label: customers / pre-alerts / requests / departures
```

Exact labels:

| Page | Label |
| --- | --- |
| PrintQueuePage | `Loading queue…` |
| UnidentifiedQueuePage | `Loading queue…` |
| DeparturesPage (list) | `Loading departures…` |
| DeparturesPage (single) | `Loading departure…` |
| CustomersPage | `Loading customers…` |
| WarehousePreAlertsPage | `Loading pre-alerts…` |
| StaffRequestsPage (main list) | `Loading requests…` |

When the parent currently does `if (loading) return <p>…`, change to:

```tsx
if (loading) {
  return <PackageLoader done={false} size="md" label="Loading …" />
}
```

Burst will cut on unmount — acceptable for full-page swaps **or** introduce local state:

```tsx
const [bootDone, setBootDone] = useState(false)
if (loading || !bootDone) {
  return (
    <PackageLoader
      done={!loading}
      failed={Boolean(error) && !loading}
      size="md"
      label="…"
      onComplete={() => setBootDone(true)}
    />
  )
}
```

Use the `bootDone` pattern on full-page returns so the outro can finish.

- [ ] **Step 2: ReceivePage main blocks only**

Replace only the larger section placeholders (batch list / main empty loading), **not** tiny inline field hints. Search for `Loading batches` and the main `Loading…` under primary panels; leave micro copy under inputs alone.

- [ ] **Step 3: Typecheck**

```bash
cd frontend
npx tsc -b --pretty false --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PrintQueuePage.tsx frontend/src/pages/UnidentifiedQueuePage.tsx frontend/src/pages/DeparturesPage.tsx frontend/src/pages/CustomersPage.tsx frontend/src/pages/WarehousePreAlertsPage.tsx frontend/src/pages/StaffRequestsPage.tsx frontend/src/pages/ReceivePage.tsx
git commit -m "Wire PackageLoader into warehouse loading placeholders."
```

---

### Task 5: Visual QA checklist + polish pass

**Files:**
- Possibly tweak: `frontend/src/index.css`, `frontend/src/components/ui/PackageLoader.tsx` (geometry only)

- [ ] **Step 1: Run app and verify storyboard beats**

```bash
cd frontend
npm run dev
```

Check:

1. Arrive: box enters from left with stripes  
2. Transform: stripes curl / fade as ring fades in  
3. Load: ring spins, centered on box  
4. Complete: flaps open + burst (on success)  
5. Failed path: fade, no burst  
6. Light + dark theme  
7. Reduced motion (OS setting): pulse then open / fade  
8. Customer dashboard, packages, pre-alerts, messages  
9. Warehouse: print queue, unidentified, departures, customers, pre-alerts, staff requests  
10. Buttons / ShipperSelect still use text busy states  

- [ ] **Step 2: Fix any alignment issues**

If the ring is off-center, adjust SVG `viewBox` circle `cx/cy/r` so the ring shares the box center (`60,56` in the template). Keep shadow under the box.

- [ ] **Step 3: Final typecheck**

```bash
cd frontend
npx tsc -b --pretty false --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit polish if any**

```bash
git add frontend/src/index.css frontend/src/components/ui/PackageLoader.tsx
git commit -m "Polish PackageLoader geometry and motion timing."
```

(Skip commit if no changes.)

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Shared inline + fullscreen | Task 2 (`variant`) |
| Hybrid done + min load time | Task 2 (`MIN_LOAD_MS`) |
| React + SVG/CSS, no new deps | Tasks 1–2 |
| Phases arrive/transform/load/complete | Tasks 1–2 |
| failed → fade | Task 2 |
| reduced motion | Tasks 1–2 |
| Customer wiring | Task 3 |
| Warehouse wiring | Task 4 |
| Skip buttons / ShipperSelect / onboarding | Task 4 notes + Task 5 checklist |
| Typecheck / no new deps | Tasks 2–5 |

## Placeholder scan

No TBD/TODO left in tasks; wiring steps include concrete props and labels.
