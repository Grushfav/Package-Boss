# Task 1 Report: Dependencies + map style helper

**Date:** 2026-11-11  
**Status:** DONE  
**Commits:** none (per instructions)

## Summary

Installed `maplibre-gl` and `protomaps-themes-base` in the frontend workspace, added `frontend/src/lib/mapStyle.ts` per the task brief, and added a minimal ambient module declaration so TypeScript accepts `layers()` with `MapTheme`. Full-project `tsc` for the app config passes with no errors.

## Steps completed

### Step 1: Install packages

**Command (from `frontend/`):**

```bash
npm install maplibre-gl protomaps-themes-base
```

**Result:** Success (exit 0). Added 24 packages.

**`package.json` dependencies (verified):**

- `maplibre-gl`: `^6.18.0`
- `protomaps-themes-base`: `^4.5.0`

**npm output note:** `protomaps-themes-base@4.5.0` is deprecated in favor of `@protomaps/basemaps`. The brief explicitly requires `protomaps-themes-base`; no migration performed in this task.

### Step 2: Create style helper

**Created:** `frontend/src/lib/mapStyle.ts`

Implements verbatim from brief:

| Export | Purpose |
|--------|---------|
| `MapTheme` | `'light' \| 'dark'` |
| `JAMAICA_MAX_BOUNDS` | `[[-78.5, 17.6], [-76.1, 18.6]]` |
| `DEFAULT_JAMAICA_CENTER` | `[-76.7936, 18.0179]` |
| `DEFAULT_MAP_ZOOM` | `12` |
| `getDevLabsMapStyle(theme?)` | Returns `StyleSpecification` with DevLabsJa vector tiles |
| `DEVLABS_MAP_STYLE` | Prebuilt light style |

Env overrides: `VITE_MAPS_HOST`, `VITE_MAPS_API_KEY` with brief defaults.

**Optional `frontend/.env.local`:** Not created (optional per brief).

### Step 3: Verify TypeScript

**Command:**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

**First run:** Failed with:

```
src/lib/mapStyle.ts(32,33): error TS2345: Argument of type 'string' is not assignable to parameter of type 'Theme'.
```

Cause: shipped types on `protomaps-themes-base` expect a narrower `Theme` type than our `MapTheme` union when passed to `layers()`.

**Fix (per brief):** Created `frontend/src/types/protomaps-themes-base.d.ts` with the minimal module declaration (`theme: string`).

**Second run:** Exit 0, no errors.

### Step 4: Commit

Skipped as instructed.

## Files changed

| File | Action |
|------|--------|
| `frontend/package.json` | Modified (dependencies) |
| `frontend/package-lock.json` | Modified (npm install) |
| `frontend/src/lib/mapStyle.ts` | Created |
| `frontend/src/types/protomaps-themes-base.d.ts` | Created (type workaround) |

## Self-review

- **Brief fidelity:** `mapStyle.ts` matches the brief source (including attribution string with `Â©` as given).
- **Interfaces:** All required exports present with correct types and constants.
- **Security:** Default live API key is embedded per brief; production should prefer `VITE_MAPS_API_KEY` in env (documented in brief as optional `.env.local`).
- **Deprecation:** Package deprecation warning is informational only for this task scope.
- **Type declaration:** Ambient `d.ts` is included via `tsconfig.app.json` `"include": ["src"]`; resolves theme typing without changing brief’s `mapStyle.ts` body.

## Test summary

`npx tsc --noEmit -p tsconfig.app.json` — **pass** (exit 0).

## Concerns

1. **npm deprecation:** `protomaps-themes-base` deprecated; future tasks may migrate to `@protomaps/basemaps`.
2. **Type shim:** Required because package `Theme` ≠ `MapTheme` in strict check; shim is brief-approved.
3. **Attribution encoding:** Brief uses `Â©`; may render incorrectly in UI if source encoding was intended as `©` — left verbatim per brief.

## Blockers / context needed

None.
