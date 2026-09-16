# Express migration — health & monitoring

Run before merging or switching `VITE_API_URL`:

```bash
cd server
npm run build    # TypeScript compile
npm test         # contract + route parity guardrails
```

## Automated checks (`npm test`)

| Test | What it catches |
|------|-----------------|
| `health.test.ts` | Server boots, `/api/health` shape |
| `parishes.test.ts` | Public reference data |
| `authErrors.test.ts` | JWT error strings match frontend `client.ts` |
| `routeParity.test.ts` | Frontend `src/api/*` paths missing on Express |

## Feature status (Delivery-branch)

| Area | Status | Impact if using Express |
|------|--------|-------------------------|
| **Local logistics** (`/…/logistics-jobs/*`) | Enabled | Customer/clerk/admin logistics APIs mounted |
| **Package delivery** (`/me/delivery-requests/*`) | Implemented | Works |
| **Warehouse / staff / admin core** | Implemented | Works |

Logistics is mounted via `logisticsJobsRouter` (customer) plus staff/admin route appendages. `DEFERRED_PATH_PREFIXES` is empty.

## Manual smoke matrix (after changes)

1. **Customer:** login → packages list → pre-alert create → delivery address → local delivery request
2. **Clerk:** receive package → print queue → status update → checkout → logistics job actions
3. **Admin:** stats overview → clerk list → assign/reject logistics jobs

## Cutover safety

- Keep Flask on `:5000` until smoke matrix passes on Express `:5001`
- Rollback = revert `VITE_API_URL` only (shared Postgres)

## When to update this file

- New frontend API call added → confirm Express route + extend parity test if needed
- Feature deferred again → add path prefixes back to `DEFERRED_PATH_PREFIXES`
