# PackageLoader final fix report

## 2026-11-07

- Important #1: Scoped arrive and reduced-motion pulse animations to the closed box group, preserving the open box's default hidden state until the complete phase.
- Important #2: Moved `bootDone` reset out of `DepartureDetail.load()` and into the shipment-dependent initial-load effect, so scan/remove refreshes retain the detail screen.
- Scope: Left PackageLoaderGate coverage and accepted unmount behavior unchanged.
- Verification: `cd frontend; npx tsc -b --pretty false --noEmit` (exit 0); edited-file IDE diagnostics reported no errors.
