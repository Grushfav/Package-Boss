# Express migration — health & monitoring

Run before merging or flipping production `VITE_API_URL`:

```bash
cd server
npm run build    # TypeScript compile
npm test         # contract + route parity guardrails
```

Optional smoke against a running API:

```bash
k6 run k6/smoke/regression.js   # defaults to Express :5001
```

## Stage 1 status (auth foundation)

| Item | Status |
|------|--------|
| Drizzle map `users.facebook_id` | Done (no DDL) |
| Drizzle map `data_deletion_requests` | Done (no DDL) |
| Facebook login / complete / data-deletion / deletion-status | Done |
| Google `credential` **and** `access_token` | Done |
| Env: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Required (same as Flask) |
| Contract tests (social auth) | Added |

### Stage 1 inventory notes (Flask vs Express)

**Closed in Stage 1**
- `POST /api/auth/facebook`
- `POST /api/auth/facebook/complete`
- `POST /api/auth/facebook/data-deletion`
- `GET /api/auth/deletion-status/:confirmation_code`
- `POST /api/auth/google` body: `{ credential }` **or** `{ access_token }`
- `GET /api/admin/invoices`
- `POST /api/staff/targeted-announcements` (+ `/preview`)
- Drizzle maps: `facebook_id`, `data_deletion_requests`, announcement `target_mode` / `target_criteria`, `announcement_recipients`

## Stage 2 status (behavioral parity)

| Item | Status |
|------|--------|
| Batch status emails (customs release / bulk status / shipment depart) | Done |
| `skipStatusEmail` on `addPackageEvent` | Done |
| Bank-transfer auto-confirm + unpaid-only confirm | Done |
| Multi-package handling fee ($300) + payment-total | Done |
| Portmore/parish delivery fees + `include_delivery_fee` | Done |
| Targeted announcement visibility + tracking in emails | Done |
| Delivery address fee fields in serializer | Done |
| Admin invoice deep QA vs live data | Pending (manual) |

## Stage 3 status (cutover)

| Item | Status |
|------|--------|
| Vite `/api` proxy → Express `:5001` | Done |
| Local `VITE_API_URL=/api` (proxied) | Done |
| Contract tests: rates + auth validation | Done |
| k6 default + CI → Express on Postgres | Done |
| Root / server docs: Express primary | Done |
| Render blueprint API service = Express | Already (`render.yaml`) |
| Production frontend `VITE_API_URL` → Express host | **Manual** (Render dashboard + redeploy) |
| Retire Flask web process after soak | **Manual** (keep Alembic for DDL) |

**Flask main parity**
- Logistics job routes **not mounted** (no Flask blueprint / no Alembic table on main). Service/schema files may remain unused.
- Warehouse summary and admin overview match Flask keys (no `pending_logistics_jobs` / `logistics_jobs_*`; overview includes `packages_total`)

## Automated checks (`npm test`)

| Test | What it catches |
|------|-----------------|
| `health.test.ts` | Server boots, `/api/health` shape |
| `parishes.test.ts` | Public reference data |
| `rates.test.ts` | Rate table + estimate contract |
| `authErrors.test.ts` | JWT error strings match frontend `client.ts` |
| `authValidation.test.ts` | Register/login validation shapes |
| `socialAuth.test.ts` | Google/Facebook auth error shapes + deletion-status 404 |
| `routeParity.test.ts` | Frontend `src/api/*` paths missing on Express |
| CI `k6-regression.yml` | Smoke suite against Express + Postgres |

## Feature status

| Area | Status | Impact if using Express |
|------|--------|-------------------------|
| **Local logistics** (`/…/logistics-jobs/*`) | Not mounted | Matches Flask main (no logistics API) |
| **Package delivery** (`/me/delivery-requests/*`) | Implemented | Works |
| **Warehouse / staff / admin core** | Stage 2 parity fixes landed | Batch emails, fees, bank-transfer confirm, targeted visibility |
| **Facebook + Google access_token** | Implemented | Matches production SPA |
| **Local/CI cutover defaults** | Stage 3 | Vite + k6 target Express |

## Manual smoke matrix (production cutover)

1. Email/password login
2. Google sign-in (access_token button flow)
3. Facebook sign-in + new-user complete profile
4. Clerk: receive → depart → customs release & bill → checkout
5. Customer: payment total (multi-pkg handling fee) + bank transfer proof
6. Admin stats / invoices (optional)
7. Deletion-status page with a known code (optional)

## Cutover safety

- Local: Express `:5001` is primary; Flask `:5000` optional for comparison
- Production rollback = revert frontend `VITE_API_URL` to Flask + redeploy SPA (shared Postgres)
- **Do not** run Express schema migrations — Flask/Alembic owns DDL

## When to update this file

- New frontend API call added → confirm Express route + extend parity test if needed
- Production `VITE_API_URL` flipped → mark Stage 3 production row Done
