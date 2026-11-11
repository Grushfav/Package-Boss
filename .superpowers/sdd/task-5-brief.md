### Task 5: Visual QA checklist + polish pass

**Files:**
- Possibly tweak: `frontend/src/index.css`, `frontend/src/components/ui/PackageLoader.tsx` (geometry only)

- [ ] **Step 1: Run app and verify storyboard beats**

```bash
cd frontend
npm run dev
```

Check:

1. Arrive: box enters from left with stripes  
2. Transform: stripes curl / fade as ring fades in  
3. Load: ring spins, centered on box  
4. Complete: flaps open + burst (on success)  
5. Failed path: fade, no burst  
6. Light + dark theme  
7. Reduced motion (OS setting): pulse then open / fade  
8. Customer dashboard, packages, pre-alerts, messages  
9. Warehouse: print queue, unidentified, departures, customers, pre-alerts, staff requests  
10. Buttons / ShipperSelect still use text busy states  

- [ ] **Step 2: Fix any alignment issues**

If the ring is off-center, adjust SVG `viewBox` circle `cx/cy/r` so the ring shares the box center (`60,56` in the template). Keep shadow under the box.

- [ ] **Step 3: Final typecheck**

```bash
cd frontend
npx tsc -b --pretty false --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit polish if any**

```bash
git add frontend/src/index.css frontend/src/components/ui/PackageLoader.tsx
git commit -m "Polish PackageLoader geometry and motion timing."
```

(Skip commit if no changes.)

---

