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

For each file, find the early `Loadingâ€¦` paragraph used as the page placeholder and replace with:

```tsx
import { PackageLoader } from '../components/ui/PackageLoader'

// when loading && !data:
<PackageLoader done={false} size="md" label="Loading queueâ€¦" />
// or appropriate label: customers / pre-alerts / requests / departures
```

Exact labels:

| Page | Label |
| --- | --- |
| PrintQueuePage | `Loading queueâ€¦` |
| UnidentifiedQueuePage | `Loading queueâ€¦` |
| DeparturesPage (list) | `Loading departuresâ€¦` |
| DeparturesPage (single) | `Loading departureâ€¦` |
| CustomersPage | `Loading customersâ€¦` |
| WarehousePreAlertsPage | `Loading pre-alertsâ€¦` |
| StaffRequestsPage (main list) | `Loading requestsâ€¦` |

When the parent currently does `if (loading) return <p>â€¦`, change to:

```tsx
if (loading) {
  return <PackageLoader done={false} size="md" label="Loading â€¦" />
}
```

Burst will cut on unmount â€” acceptable for full-page swaps **or** introduce local state:

```tsx
const [bootDone, setBootDone] = useState(false)
if (loading || !bootDone) {
  return (
    <PackageLoader
      done={!loading}
      failed={Boolean(error) && !loading}
      size="md"
      label="â€¦"
      onComplete={() => setBootDone(true)}
    />
  )
}
```

Use the `bootDone` pattern on full-page returns so the outro can finish.

- [ ] **Step 2: ReceivePage main blocks only**

Replace only the larger section placeholders (batch list / main empty loading), **not** tiny inline field hints. Search for `Loading batches` and the main `Loadingâ€¦` under primary panels; leave micro copy under inputs alone.

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

