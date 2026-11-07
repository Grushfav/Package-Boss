# PackageLoader — branded loading animation

**Date:** 2026-11-07  
**Status:** Approved for implementation planning  
**Branch context:** `test` (Package Boss frontend)

## Goal

Replace plain “Loading…” placeholders on major customer and warehouse screens with a branded animation: a gold package arrives with green/gold speed stripes, stripes morph into a rotating ring around the box, then on success the box opens with a subtle green/gold burst.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Scope | Shared component with `inline` + `fullscreen` variants |
| Completion | Hybrid: spin until parent `done`, with minimum time in load phase |
| Tech | React phase machine + SVG/CSS (no Lottie/Rive) |
| First ship | Wire main customer + warehouse page/panel loaders (not button micro-spinners) |

## Component

**Path:** `frontend/src/components/ui/PackageLoader.tsx`  
**Styles:** Co-located CSS module or keyframes in `frontend/src/index.css` using existing `--color-boss-green` / `--color-boss-gold`.

### Props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `done` | `boolean` | `false` | Parent sets `true` when data is ready |
| `variant` | `'inline' \| 'fullscreen'` | `'inline'` | Panel vs centered overlay |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Inline scale |
| `label` | `string` | optional | Muted caption under animation |
| `failed` | `boolean` | `false` | Skip success burst; fade out instead |
| `onComplete` | `() => void` | optional | After complete (or error fade) finishes |
| `className` | `string` | optional | Wrapper class |

### Phase machine

1. **Arrive** (~0.6s) — box slides in from the left; green→gold speed stripes trail behind.  
2. **Transform** (~0.5s) — stripes shorten into rounded segments and curve around the box.  
3. **Load** — segments form a rotating circular indicator. **Hold** until `done === true` **and** at least ~0.8s has been spent in this phase.  
4. **Complete** (~0.7s) — ring resolves; box flaps open; gold/green burst; then call `onComplete`.

If `failed` becomes true while loading (or when finishing), skip open/burst and fade out, then call `onComplete`.

### Visual rules

- Flat SVG cardboard box (¾ view), black tape strip when closed; flaps open on complete.  
- Cleaner than the storyboard sketch: ring centered on the box, even segment gaps, soft drop shadow.  
- Brand colors stay gold/green in light and dark; shadow softens in dark mode.  
- `prefers-reduced-motion: reduce` — static closed box + opacity pulse during load; on `done`, show open box without morph/burst; on `failed`, fade out.

## Integration

Parents keep the loader mounted until `onComplete` so the open/burst is not cut off:

```tsx
const [showLoader, setShowLoader] = useState(true)
// when fetch settles: setDone(true) or setFailed(true)
// onComplete={() => setShowLoader(false)} then render content
```

### Wire (replace text placeholders)

**Customer**

- Dashboard first paint when `dashboardLoading && !dashboardStats` (large inline or fullscreen in content area)  
- `PackagesHistoryPanel` primary loading states  
- `PreAlertsPanel`  
- `MessagesSection`

**Warehouse / staff**

- Print queue, Unidentified queue, Departures list (and single-departure loading), Customers, Warehouse pre-alerts, Staff requests main list  
- Receive page: main block loaders only (not every field-level “Loading…”)

### Do not wire

- Button busy labels (`Loading…` / `Refreshing…`)  
- `ShipperSelect` “Loading merchants…”  
- Onboarding tour instructional copy  

## Edge cases

- **Fast loads:** still run arrive → transform → min load hold → complete.  
- **Errors:** fade out (no success burst).  
- **Unmount mid-animation:** clear timers; never call `onComplete` after unmount.  
- **Re-entry:** remounting resets to Arrive.

## Out of scope

- Progress percentage API  
- Replacing every micro-loading string in the app  
- New animation libraries (Lottie, Rive, Framer Motion) unless later justified  

## Success criteria

- Animation reads clearly as arrive → transform → ring → open.  
- Ring is visually centered on the box.  
- Hybrid `done` behavior works for fast and slow fetches.  
- Major customer + warehouse loading placeholders use `PackageLoader`.  
- Reduced-motion path remains usable.  
- Typecheck passes; no new runtime dependencies.
