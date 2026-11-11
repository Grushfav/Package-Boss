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
<PackageLoaderGate ready={!loading} failed={Boolean(dashboardError)} size="lg" label="Loading your packagesâ€¦">
  {/* existing grid of StatCards */}
</PackageLoaderGate>
```

Keep the title row and `LoadErrorBanner` outside the gate. When `dashboardError && !dashboardStats`, show the banner (already present) and still allow fade via `failed` if the gate is shown â€” if error with no stats, prefer banner only (skip loader):

```tsx
{loading && !dashboardError ? (
  <PackageLoader size="lg" label="Loading your packagesâ€¦" />
) : (
  <div className="grid grid-cols-2 gap-3">...</div>
)}
```

Use the simpler branch above (direct `PackageLoader` while `loading`, no gate needed for always-visible stats skeleton replacement) **or** gate if you hide the whole grid. Prefer:

```tsx
{loading && !dashboardError ? (
  <PackageLoader done={false} size="lg" variant="inline" label="Loading your packagesâ€¦" />
) : (
  <>
    {dashboardError && (...banner...)}
    <div className="grid ...">...</div>
  </>
)}
```

Note: first paint often ends by `dashboardStats` arriving; unmounting mid-spin is OK for dashboard if we accept cutting the burst. Spec prefers finishing the outro â€” so use gate:

```tsx
const showInitial = !dashboardStats
// ...
{showInitial ? (
  <PackageLoaderGate
    ready={Boolean(dashboardStats)}
    failed={Boolean(dashboardError)}
    size="lg"
    label="Loading your packagesâ€¦"
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

Once revealed once, subsequent refreshes keep the grid (stale stats) and optional banner â€” do not re-show the full loader on every soft refresh. Implement with a `hasRevealed` ref or by only using the gate when `!dashboardStats` on first mount as above (after reveal, `dashboardStats` is set so gate path is abandoned on next render of parent â€” **but** `PackageLoaderGate` sets `revealed` then renders children; if parent switches away from gate entirely when stats exist, thatâ€™s fine).

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
        label="Loading your packagesâ€¦"
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
    label="Loading packagesâ€¦"
  >
    {null}
  </PackageLoaderGate>
) : ...}
```

For the empty-children case after complete, the parent structure already branches â€” better approach: keep structural branches, only swap the loading `<p>` nodes:

```tsx
{activeLoading && activePackages.length === 0 ? (
  <PackageLoader done={!activeLoading} size="sm" label="Loading active packagesâ€¦" />
) : ...}
```

Using `done={!activeLoading}` without gate will unmount when loading flips false and may cut the burst. Prefer gate when the loading branch owns the whole section:

```tsx
{activePackages.length === 0 && (activeLoading || activePendingReveal) ? (
  <PackageLoaderGate ready={!activeLoading} failed={Boolean(activeError)} size="sm" label="Loading active packagesâ€¦">
    {activeTotal === 0 && !activeError ? <p>No active packagesâ€¦</p> : null}
  </PackageLoaderGate>
) : activePackages.length > 0 ? ( ...cards... ) : ...}
```

Keep selection/pager logic unchanged. Minimum acceptable: swap text for `<PackageLoader done={!activeLoading} size="sm" label="â€¦" />` even if burst is sometimes cut â€” **prefer gate**.

- [ ] **Step 3: PreAlertsPanel + MessagesSection**

`PreAlertsPanel.tsx` â€” replace loading card text:

```tsx
{preAlertsLoading && pending.length === 0 ? (
  <PackageLoaderGate ready={!preAlertsLoading} size="sm" label="Loading pre-alertsâ€¦">
    {null}
  </PackageLoaderGate>
) : pending.length === 0 ? (
  ...
```

When gate completes with empty pending, children `null` would flash empty â€” instead:

```tsx
{preAlertsLoading && pending.length === 0 ? (
  <div className="mt-4">
    <PackageLoader done={!preAlertsLoading} size="sm" label="Loading pre-alertsâ€¦" />
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

