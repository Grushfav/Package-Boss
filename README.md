# Package Boss

Miami → Kingston logistics platform. Customers sign up, receive a unique `BOSS-XXXXX` shipping ID, and use a Miami warehouse address for US online shopping.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + PWA
- **Backend:** Flask + SQLAlchemy + JWT
- **Database:** Neon PostgreSQL (SQLite for local dev)

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

Copy `.env.example` to `.env` in the project root and set `TRN_ENCRYPTION_KEY`, `TRN_PEPPER`, and `DATABASE_URL`.

```bash
# Generate keys
python -c "from cryptography.fernet import Fernet; print('TRN_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
python -c "import secrets; print('TRN_PEPPER=' + secrets.token_hex(32))"
```

Apply database migrations (required before first run):

```bash
set FLASK_APP=wsgi:app
flask db upgrade
```

For a **new** database:

```bash
flask db upgrade
```

For an **existing** database that already has tables (e.g. Neon from before Flask-Migrate):

```bash
flask db stamp 8004a576854d
flask db upgrade
```

The first command marks the initial revision as applied without re-creating tables. The second applies any newer migrations (such as `label_printed_at`).

After model changes, create a migration with `flask db migrate -m "description"` and apply with `flask db upgrade`.

Run the API:

```bash
set FLASK_APP=wsgi.py
python wsgi.py
```

API: http://localhost:5000/api/health

### 2. Frontend

Requires **Node.js 18+** (20.19+ recommended). Vite is pinned to v6 for compatibility — no Rolldown native bindings needed.

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## API endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/parishes` | Jamaica parishes list |
| POST | `/api/auth/register` | Create account + BOSS ID |
| POST | `/api/auth/login` | Email + password login |
| GET | `/api/me` | Current user (JWT) |
| GET | `/api/me/shipping-address` | Miami address with BOSS ID |
| GET | `/api/rates` | Tiered USD rate table |
| GET | `/api/rates/estimate?weight_lbs=7.3` | Shipping cost (ceil rounding) |
| POST | `/api/auth/forgot-password` | Send password reset email |
| GET | `/api/auth/reset-password/validate?token=` | Check reset link validity |
| POST | `/api/auth/reset-password` | Set new password |

## Register payload

```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "password": "securepass",
  "contact_number": "8765551234",
  "trn": "123456789",
  "parish": "Kingston"
}
```

## Project structure

```
Package-Boss/
├── backend/          Flask API
├── frontend/         Vite React PWA
├── docker-compose.yml
└── .env.example
```

## Phase 2 (complete)

- Tiered USD rates table with ceil rounding
- Shipping estimator on landing + `/rates` page
- Landing login card (email only)
- Password reset via email link

## Phase 3 (complete)

- Public package tracking at `/track` with status timeline
- Customer dashboard package list (`GET /api/me/packages`)
- Staff receive flow at `/staff/receive` (BOSS ID lookup, weight, R2 photos)
- PWA install prompt + offline BOSS address cache on dashboard

### Phase 3 API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/track/<tracking_number>` | Public | Track package + timeline |
| GET | `/api/me/packages` | JWT | List customer's packages |
| GET | `/api/me/packages/<id>` | JWT | Package detail + timeline |
| GET | `/api/staff/customers/<boss_id>` | Staff | Customer lookup for receive |
| POST | `/api/staff/packages/receive` | Staff | Receive package + rate |
| PATCH | `/api/staff/packages/<tracking>/status` | Staff | Update shipment status |
| GET | `/api/staff/packages` | Staff | List packages by received date (bulk status) |
| PATCH | `/api/staff/packages/bulk-status` | Staff | Bulk update shipment status |
| GET | `/api/staff/packages/print-queue` | Staff | Unprinted labels queue |
| PATCH | `/api/staff/packages/mark-printed` | Staff | Mark labels as printed |
| POST | `/api/uploads/presign` | Clerk | R2 presigned upload URL |
| GET | `/api/admin/clerks` | Admin | List clerks |
| POST | `/api/admin/clerks` | Admin | Promote customer or create clerk |
| DELETE | `/api/admin/clerks/<user_id>` | Admin | Demote clerk to customer |

### User roles

| Role | Access |
|------|--------|
| `customer` | Dashboard, tracking, rates (default at signup) |
| `clerk` | Receive packages, update statuses, upload photos |
| `admin` | Everything clerks can do + create/manage clerks |

### Role setup

1. Set `ADMIN_EMAIL` and/or `CLERK_EMAIL` in `.env`
2. Restart the backend — matching accounts are auto-promoted
3. Admins can also promote customers or create clerk accounts at `/admin/clerks`
4. Clerks land on `/warehouse` after login (receive + status updates)
5. Admins land on `/admin` after login

### Warehouse receive flow (hybrid)

| Step | Action |
|------|--------|
| 1a | **Scan** carrier barcode → Start receival |
| 1b | **Or** search customer by name/BOSS ID → Start receival |
| 1c | **Or** no match → record label details → **unidentified queue** |
| 2 | Confirm customer (or label info) + enter shipper, weight |
| 3 | Complete receival → `PB-2026-…` tracking + **printable label** |

API: `GET /api/shippers`, `GET /api/warehouse/customers/search?q=`

### Unidentified (miscellaneous) queue

Packages with no matching BOSS ID or customer name are received into a clerk queue at `/warehouse/unidentified`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/staff/packages/receive-unidentified` | Clerk | Receive without matched owner |
| GET | `/api/staff/packages/unidentified` | Clerk | List queue |
| POST | `/api/staff/packages/<id>/assign` | Clerk | Assign package to customer |
| POST | `/api/uploads/presign-unidentified` | Clerk | R2 photo upload for unidentified packages |

### Print queue

When receival volume is high, clerks can **Queue & receive next** instead of printing immediately. Unprinted packages appear at `/warehouse/print-queue` (shared across all clerks, last 7 days). Labels do not show shipping price.

### R2 photo uploads (optional)

Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_PUBLIC_URL` in `.env`. Without R2, receive still works — photos are simply skipped.

## Phase 4 (complete)

- Customer pre-alerts with carrier tracking + invoice upload (R2)
- Dashboard pre-alert list with cancel for pending items
- `/pre-alerts/new` submission form

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me/pre-alerts` | Customer | List pre-alerts |
| POST | `/api/me/pre-alerts` | Customer | Create pre-alert |
| GET | `/api/me/pre-alerts/<id>` | Customer | Pre-alert detail |
| DELETE | `/api/me/pre-alerts/<id>` | Customer | Cancel pending pre-alert |
| POST | `/api/me/uploads/invoice/presign` | Customer | R2 presigned invoice URL |

## Phase 5 (complete)

- Clerk package **audit log** (`package.received`, `package.status_updated`)
- Admin **metrics dashboard** at `/admin` (KPIs + Recharts visualizations)
- Full **activity log** at `/admin/activity`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats/overview` | KPI summary |
| GET | `/api/admin/stats/packages-timeline` | Received per day |
| GET | `/api/admin/stats/by-status` | Status breakdown |
| GET | `/api/admin/stats/weight-distribution` | Weight buckets |
| GET | `/api/admin/stats/pre-alerts-vs-receives` | Daily comparison |
| GET | `/api/admin/activity` | Clerk package action log |

### Database migrations

Schema is managed with **Flask-Migrate** (Alembic). Migrations live in `backend/migrations/`.

| Command | Purpose |
|---------|---------|
| `flask db upgrade` | Apply pending migrations |
| `flask db migrate -m "…"` | Generate migration after model changes |
| `flask db stamp 8004a576854d` | Mark existing DB at initial revision (skip table creation) |
| `flask db current` | Show current revision |

Run commands from `backend/` with `FLASK_APP=wsgi:app` (or use `backend/.flaskenv`).

### Official rates & terms

- **Rates:** `$4.00` for the first lb + `$2.50` per additional lb, billable weight rounded up (1–30 lbs). JMD shown at **160 JMD = 1 USD**. Over 30 lbs → custom quote.
- **Terms:** `/terms` — Package Boss Shipping & Logistics, effective **June 21, 2026**. Signup requires acceptance (`terms_accepted_at` on user).
- **Migration:** `flask db upgrade` applies `c3d4e5f6a7b8` (adds `terms_accepted_at`).
