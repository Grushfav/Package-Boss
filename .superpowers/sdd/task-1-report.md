# Task 1 Report: CSS foundation for PackageLoader

**Status:** DONE_WITH_CONCERNS  
**Branch:** `test`  
**Commit:** `18aff41` Add PackageLoader CSS phase keyframes.

## What changed

Appended the PackageLoader keyframe block to the end of `frontend/src/index.css` (lines 381–574, 195 insertions). No other files were committed. No React component, no new runtime dependencies.

The task brief’s fenced CSS had mojibake in two comments (`â€"` / `â†'`). The bytes were taken from the plan fence in `docs/superpowers/plans/2026-11-07-package-loader.md`, which is the same rules with the intended em dashes and arrow. A Python compare of the appended block against that fence was an exact match (trailing newline ignored).

## Classes produced

Present as specified in the CSS block:

- `.pb-loader`, `.pb-loader--sm`, `.pb-loader--md`, `.pb-loader--lg`, `.pb-loader--fullscreen`
- `.pb-loader--phase-arrive`, `--phase-transform`, `--phase-load`, `--phase-complete`, `--phase-fade`
- `.pb-loader__stage`, `.pb-loader__box` (animated via phase selectors), `.pb-loader__box-open`, `.pb-loader__box-closed`
- `.pb-loader__stripes`, `.pb-loader__ring`, `.pb-loader__burst`, `.pb-loader__label`, `.pb-loader__shadow`
- `.pb-loader--reduced` inside `@media (prefers-reduced-motion: reduce)`
- Custom properties `--pb-green` / `--pb-gold` alias `--color-boss-green` / `--color-boss-gold` (both tokens already exist in `:root`)
- Keyframes: `pb-loader-arrive`, `pb-loader-stripes-curl`, `pb-loader-ring-in`, `pb-loader-spin`, `pb-loader-ring-out`, `pb-loader-pop`, `pb-loader-burst`, `pb-loader-fade`, `pb-loader-pulse`

`.pb-loader__stripe` has no rule of its own. Task 2’s SVG uses that class on stripe rects; motion is on the parent `.pb-loader__stripes` group. That matches the plan markup.

The interface line in the plan says `.pb-loader__box--open`. The CSS block and the Task 2 markup both use `.pb-loader__box-open` and `.pb-loader__box-closed`. This task followed the CSS block, which is what the component will select.

## Verification

- Brace balance: whole `index.css` 102 `{` / 102 `}`; appended block 57 / 57.
- Appended CSS equals the plan’s Task 1 code fence.
- From `frontend`: `npx tsc -b --pretty false --noEmit` exited 0. No frontend unit-test runner; CSS is not typechecked. This only confirms the TypeScript project is still clean.
- `git show --stat` equivalent: commit contains only `frontend/src/index.css` (+195). `.superpowers/` stayed untracked.

## Self-review

- Scope stayed CSS-only. Hybrid `done` timing, failed-path behavior, and reduced-motion class toggling remain later tasks. The fade and `prefers-reduced-motion` rules are in this commit because they are inside the Task 1 CSS the plan says to append.
- Brand colors go through existing tokens. Dark-mode shadow uses `:root.dark` and `.dark`.
- Size scale is 72 / 120 / 160. Fullscreen is `min-height: 40vh; width: 100%`.
- Reduced-motion path: stripes, ring, and burst forced to `opacity: 0`; arrive/transform/load pulse the box; complete shows `.pb-loader__box-open` and hides `.pb-loader__box-closed`. The root fade animation on `.pb-loader--phase-fade` is not cancelled by the reduced-motion block, so a failed fade can still run.

## Concerns

1. **Ring exit may be invisible.** `.pb-loader__ring` sets `opacity: 0`. Only `.pb-loader--phase-load` overrides that to `opacity: 1`. `pb-loader-ring-out` (used on complete and fade) has no `from` opacity, and `animation-fill-mode: both` will take the underlying computed opacity, which is 0 once the load rule no longer matches. The ring can vanish instead of scaling/fading out. Left as specified; fix belongs with the component task or a follow-up CSS tweak (`opacity: 1` on the complete/fade ring rule, or a `from { opacity: 1 }` keyframe).

2. **Interface name vs selector.** Plan “Produces” lists `.pb-loader__box--open`. Implemented selector is `.pb-loader__box-open`, which is what Task 2’s JSX uses. No change made.

## Commit

```
18aff41 Add PackageLoader CSS phase keyframes.
```
