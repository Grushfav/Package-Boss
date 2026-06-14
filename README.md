# Package Boss

Miami → Kingston logistics platform. Customers sign up, receive a unique `BOSS-XXXXX` shipping ID, and use a Miami warehouse address for US online shopping.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + PWA
- **Backend:** Flask + SQLAlchemy + JWT
- **Database:** Neon PostgreSQL (SQLite for local dev)
- **Cache:** Redis (BOSS ID generation, password reset in Phase 2)

## Quick start

### 1. Redis

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

Copy `.env.example` to `backend/.env` and set `TRN_ENCRYPTION_KEY` and `TRN_PEPPER`.

```bash
# Generate keys
python -c "from cryptography.fernet import Fernet; print('TRN_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
python -c "import secrets; print('TRN_PEPPER=' + secrets.token_hex(32))"
```

Run the API:

```bash
set FLASK_APP=wsgi.py
python wsgi.py
```

API: http://localhost:5000/api/health

### 3. Frontend

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
- Password reset via email link (Redis + console email in dev)

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
| 2 | Confirm customer + enter shipper, weight |
| 3 | Complete receival → `PB-2026-…` tracking + **printable label** |

API: `GET /api/shippers`, `GET /api/warehouse/customers/search?q=`

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

### Existing database upgrades

On startup the API runs a lightweight schema sync (`app/db_schema.py`) that adds missing Phase 3 columns (e.g. `users.role`) and creates package tables. Restart the backend after pulling Phase 3 — no manual SQL required.
