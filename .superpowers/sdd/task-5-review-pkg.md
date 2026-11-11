# Review package Task 5 (re-review after fix)
BASE: 9c719e021652c443f7dd9a8f4c5d842bd5b2e201
HEAD: fe48bbc8d43272f5aa6a41dda9ef13610e8bb337

## Commits
fe48bbc Fix PackageLoader ring spin transform origin. 2310208 Polish PackageLoader geometry and motion timing.

## Stat
 frontend/src/components/ui/PackageLoader.tsx | 4 ++++  frontend/src/index.css                       | 3 ++-  2 files changed, 6 insertions(+), 1 deletion(-)

## Diff
```diff
diff --git a/frontend/src/components/ui/PackageLoader.tsx b/frontend/src/components/ui/PackageLoader.tsx index c337a60..c86a545 100644 --- a/frontend/src/components/ui/PackageLoader.tsx +++ b/frontend/src/components/ui/PackageLoader.tsx @@ -94,20 +94,24 @@ export function PackageLoader({        const entered = loadEnteredAt.current ?? performance.now()        const waited = performance.now() - entered        const remaining = Math.max(0, MIN_LOAD_MS - waited)        const t = window.setTimeout(() => {          setPhase(failed ? 'fade' : 'complete')        }, remaining)        return () => window.clearTimeout(t)      }        if (phase === 'complete') { +      if (failed) { +        setPhase('fade') +        return +      }        const t = window.setTimeout(() => {          finishedRef.current = true          onCompleteRef.current?.()        }, COMPLETE_MS)        return () => window.clearTimeout(t)      }        if (phase === 'fade') {        const t = window.setTimeout(() => {          finishedRef.current = true diff --git a/frontend/src/index.css b/frontend/src/index.css index 2529bc2..eaab421 100644 --- a/frontend/src/index.css +++ b/frontend/src/index.css @@ -448,21 +448,21 @@ body {    pointer-events: none;  }    @keyframes pb-loader-stripes-curl {    from { opacity: 1; transform: scaleX(1) rotate(0deg); }    to { opacity: 0; transform: scaleX(0.35) rotate(-55deg); }  }    /* Ring appears after transform; spins during load */  .pb-loader__ring { -  transform-origin: 50% 50%; +  transform-origin: 60px 56px;    opacity: 0;  }    .pb-loader--phase-transform .pb-loader__ring {    animation: pb-loader-ring-in 0.5s ease-out both;  }    .pb-loader--phase-load .pb-loader__ring {    opacity: 1;    animation: pb-loader-spin 1.05s linear infinite; @@ -476,20 +476,21 @@ body {  @keyframes pb-loader-ring-in {    from { opacity: 0; transform: scale(0.7) rotate(-40deg); }    to { opacity: 1; transform: scale(1) rotate(0deg); }  }    @keyframes pb-loader-spin {    to { transform: rotate(360deg); }  }    @keyframes pb-loader-ring-out { +  from { opacity: 1; }    to { opacity: 0; transform: scale(1.08); }  }    /* Closed vs open box */  .pb-loader__box-open {    opacity: 0;  }    .pb-loader--phase-complete .pb-loader__box-closed {    opacity: 0;
```
