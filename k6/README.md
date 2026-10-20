# k6 API testing

[Grafana k6](https://grafana.com/docs/k6/latest/) scripts for Package Boss API **regression** (smoke) and **load** testing.

## Install k6

- **Windows:** `winget install Grafana.k6` or [download](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- **macOS:** `brew install k6`
- **Linux:** see [k6 install docs](https://grafana.com/docs/k6/latest/set-up/install-k6/)

## Prerequisites

Start the Express API locally (default `http://localhost:5001`). Schema DDL still comes from Flask/Alembic:

```bash
cd backend
set FLASK_APP=wsgi:app
flask db upgrade

cd ../server
npm run dev
```

## Regression (smoke) tests

One iteration, strict checks aligned with Express contract tests (`server/tests/contract`):

- Public: health, parishes, rates table (`revised-rates-newest`), rate estimate (incl. >50 lbs)
- Auth: validation errors, social login rejects, bearer token errors
- Customer: `/me`, packages, pre-alerts, shippers, delivery addresses, authorized pickups, announcements inbox, delivery requests, bank-transfer proofs
- Fulfillment: pickup/delivery request validation (no address required for pickup)
- Clerk: warehouse summary, customers, search, pre-alerts, receive batches, unidentified/print queues, delivery requests, shipments, activity
- Admin: stats suite, clerks, announcements (create/preview/delete), invoices, email settings, access to warehouse
- Access control: customer cannot hit staff/admin; clerk cannot hit admin-only routes

Creates a customer test user on first run if needed. **Admin and clerk accounts must be seeded first:**

```bash
cd server
npx tsx scripts/seedTestUsers.ts
cd ..
k6 run k6/smoke/regression.js
```

Optional env vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `K6_BASE_URL` | `http://localhost:5001` | API origin (no `/api` suffix) |
| `K6_TEST_EMAIL` | `k6-regression@package-boss.test` | Customer login/register email |
| `K6_TEST_PASSWORD` | `K6TestPass123!` | Customer password |
| `K6_ADMIN_EMAIL` | `admin@package-boss.test` | Seeded admin email |
| `K6_CLERK_EMAIL` | `clerk@package-boss.test` | Seeded clerk email |
| `K6_STAFF_PASSWORD` | `TestPass123!` | Shared staff seed password |

Example against staging:

```powershell
$env:K6_BASE_URL = "https://api-staging.example.com"
k6 run k6/smoke/regression.js
```

## Load tests

**Public read endpoints** (health, parishes, rates table) — safe for sustained load:

```bash
k6 run k6/load/public-read.js
```

**Mixed landing traffic** (includes rate estimates; may see occasional `429` from estimate rate limits):

```bash
k6 run k6/load/mixed-traffic.js
```

Tune load in each script’s `options.scenarios` block. Run load tests only against environments you own (local, staging).

## CI

GitHub Actions runs regression on push/PR to `main` (`.github/workflows/k6-regression.yml`).
