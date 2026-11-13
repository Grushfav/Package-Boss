# Task 2 Report: LocationPickerMap component

**Date:** 2026-11-11  
**Status:** DONE  
**Commits:** none (per instructions)

## Summary

Created `LocationPickerMap` in `frontend/src/components/logistics/LocationPickerMap.tsx` per the task brief: MapLibre map with Jamaica bounds, draggable marker, click-to-place, prop sync via `setLngLat`/`easeTo`, and cleanup on unmount. MapLibre CSS is imported in the component; `index.css` was not changed. `npx tsc --noEmit -p tsconfig.app.json` passes (exit 0).

## Steps completed

### Step 1: Implement component

**Created:** `frontend/src/components/logistics/LocationPickerMap.tsx`

**Public API (per brief):**

- `export type MapLatLng = { lat: number; lng: number }`
- `export function LocationPickerMap(props)` with `lat`, `lng`, `onLocationChange`, optional `className`

**Behavior verified in code:**

| Requirement | Implementation |
|-------------|----------------|
| Mount MapLibre on div ref; destroy on unmount | Single mount `useEffect` with `map.remove()` / `marker.remove()` cleanup |
| Center `[lng, lat]` when finite, else `DEFAULT_JAMAICA_CENTER` | `isFiniteCoord` + `initial` tuple |
| Draggable marker `#E8B923`; `dragend` → `onLocationChange` | `Marker({ draggable: true, color: '#E8B923' })` |
| Map click moves marker and calls `onLocationChange` | `map.on('click', …)` |
| Prop changes update marker without re-creating map | Second `useEffect` on `[lat, lng]` with epsilon compare |
| `minZoom: 8.5`, `maxBounds`, `pitch: 0`, `dragRotate: false` | Map options |
| Imports from `../../lib/mapStyle` | `DEVLABS_MAP_STYLE`, `JAMAICA_MAX_BOUNDS`, `DEFAULT_JAMAICA_CENTER`, `DEFAULT_MAP_ZOOM` |
| Styling / a11y | `h-56 w-full …`, `role="application"`, `aria-label` |

**Stable callback:** `onChangeRef.current = onLocationChange` avoids stale closures on drag/click.

### Step 2: Typecheck

**Command (from `frontend/`):**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

**First run:** Failed (3 errors):

1. `TS1192`: default import from `maplibre-gl` — no default export with `verbatimModuleSyntax` and maplibre-gl v6 named exports.
2. `TS7006`: `click` handler parameter `e` implicitly `any` (cascaded from import failure).
3. `TS18049`: `lng` possibly `null`/`undefined` in prop-sync effect — `isFiniteCoord` type predicate only narrowed `lat`, not `lng`.

**Adjustments (minimal; behavior unchanged):**

- Replaced `import maplibregl from 'maplibre-gl'` with named imports: `Map`, `Marker`, `NavigationControl`, and `type MapMouseEvent` for the click handler.
- Changed `isFiniteCoord` to return `boolean`; after guard in sync effect, use `syncLat` / `syncLng` via `as number` (safe after `isFiniteCoord`).

**Second run:** Exit 0, no errors.

### Step 3: Commit

Skipped as instructed.

## Files changed

| File | Action |
|------|--------|
| `frontend/src/components/logistics/LocationPickerMap.tsx` | Created |

**Not modified:** `frontend/src/index.css` (MapLibre CSS imported in component per brief), `frontend/src/lib/mapStyle.ts`.

## Self-review

**Strengths**

- Matches brief lifecycle: mount-once map, separate prop sync, ref-based callbacks.
- Epsilon guard prevents redundant `easeTo` when parent echoes same coordinates.
- Uses shared map constants from Task 1; no duplicate bounds/center/zoom.

**Risks / follow-ups**

- Brief sample used default `maplibregl` import; this repo’s `tsconfig.app.json` (`verbatimModuleSyntax`) and maplibre-gl v6 require named imports — documented above.
- Runtime smoke test (tiles, drag, click) not run in this task; recommend manual check on local delivery page when wired in Task 3+.
- Initial mount `useEffect` closes over first `lat`/`lng` only; subsequent finite coords before map exists are edge-case rare (map mounts immediately).

## Concerns

None blocking. Named-import deviation is required for `tsc` PASS in this project.

## NEEDS_CONTEXT / BLOCKED

None.
