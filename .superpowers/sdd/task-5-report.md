# Task 5 Report: Visual QA checklist + polish pass

## Status

PASS with authenticated-route visual coverage limited by unavailable test credentials.

## Changes

- Added an explicit `opacity: 1` start state to `pb-loader-ring-out`, so the completion/failure transition visibly fades and scales the ring instead of inheriting the base zero opacity.
- Confirmed the SVG ring and package share the intended horizontal center (`cx="60"` and box center `x=60`) and retained the ring's specified `cy="56"`; no geometry change was needed.
- Fixed the optional late failure race in four lines: a loader already in `complete` now moves to `fade` if `failed` becomes true, while normal and hybrid `done` completion behavior is unchanged.

## Verification

- `cd frontend; npx tsc -b --pretty false --noEmit` — PASS.
- `git diff --check` — PASS.
- IDE diagnostics for the two edited files — PASS (no errors).
- Targeted ESLint exposed four pre-existing React hook-rule errors in `PackageLoader.tsx` (render-time ref assignment and synchronous effect state updates); none originates from the added branch.
- `npm run dev -- --host 127.0.0.1` — PASS; Vite served the application at `http://127.0.0.1:5173/`.
- Public landing page rendered successfully in dark theme.
- Live-CSS storyboard covered arrive, transform, load, complete, and fade. The ring was centered on the package, and computed ring opacity during the paused completion exit was `0.881216`, confirming a visible ring-out.
- Customer and warehouse route-by-route checks were not feasible without authenticated customer/warehouse sessions. Reduced-motion behavior was reviewed from the existing media-query rules but not OS-toggled in the browser.

## Evidence

- `.superpowers/sdd/task-5-home.png`
- `.superpowers/sdd/task-5-loader-storyboard.png`

## Commit

`2310208 Polish PackageLoader geometry and motion timing.`

## Fix: ring spin transform origin

`.pb-loader__ring` `transform-origin` changed from `50% 50%` (viewBox point 60,60) to `60px 56px`, matching the ring circle at `cx="60"` `cy="56"`. Checked in Chrome at rendered sizes 72, 120, and 160: a 90° spin around `60px 56px` kept the circle center (delta 0,0); `50% 50%` shifted it by 4px,4px on the 120px stage. Authenticated customer/warehouse visual QA remains deferred.

### Verification

Command:

```
cd frontend; npx tsc -b --pretty false --noEmit
```

Output:

```
EXIT:0
```

No type diagnostics. Exit code 0.

Commit: `fe48bbc Fix PackageLoader ring spin transform origin.`
