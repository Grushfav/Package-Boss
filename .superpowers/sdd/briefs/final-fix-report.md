# Final fix report — local delivery map picker

Status: DONE (not committed)

## Files changed
- `frontend/src/lib/mapStyle.ts` — `layers('protomaps', namedTheme(theme), { lang: 'en' })`; import `namedTheme`; attribution uses `&copy;`.
- `frontend/src/types/protomaps-themes-base.d.ts` — DELETED (package's own types now used).
- `frontend/src/components/logistics/LocalDeliveryBookingForm.tsx`
  - Added `pickupSeqRef` / `dropoffSeqRef` (`useRef`).
  - `applyReverseGeocode`: bumps seq, sets coords before await, ignores stale results/errors/busy-reset; failure on latest seq shows "Couldn't read address for this pin — edit the fields." Pickup pin move also clears `locating`.
  - `handleUseMyLocation`: shares `pickupSeqRef`; checks seq after GPS fix and after reverse geocode; stale errors ignored; `locating` reset only if still latest.
- Saved/Boss ID untouched.

## Verification
Command: `npx tsc --noEmit -p tsconfig.app.json` (cwd `frontend`, without .d.ts shim)

Output: (none) — exit code 0

## Concerns
- `applyReverseGeocode` reads `pickupMode` from the render closure at call time (pre-existing behaviour); if mode switches mid-request the result goes to the mode at call time.
- No runtime/browser test performed; only typecheck.
