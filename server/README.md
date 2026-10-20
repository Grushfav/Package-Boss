# Package Boss Express API

Node.js / Express backend replacing the legacy Flask API. Uses Drizzle ORM against the same PostgreSQL database.

## Local development

```bash
cd server
npm install
```

Set `DATABASE_URL` in the repo root `.env` (PostgreSQL connection string). The Express server reads the root `.env` file automatically.

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `5001` | Express listen port (Flask default was `5000`) |
| `FRONTEND_URL` | `http://localhost:5173` | Used for CORS, email links, invite URLs |
| `VITE_API_URL` | — | Set in frontend `.env` / build env (see cutover below) |
| `EMAIL_PROVIDER` | `console` | `console` logs emails; `worker` sends via `EMAIL_API_URL` |
| `WHATSAPP_PROVIDER` | `console` | `console` logs messages; `meta` uses Cloud API |

Run the API:

```bash
npm run dev
```

Health check: `GET http://localhost:5001/api/health`

Run tests:

```bash
npm test
```

Clear test data (keeps admin/clerk users and rate tiers):

```bash
npm run clear-test-data -- --preview   # counts only
npm run clear-test-data                # delete
npm run clear-test-data -- --keep-announcements
```

## Stage 3 cutover (Express is primary)

Local defaults already point at Express:

- Vite proxies `/api` → `http://127.0.0.1:5001`
- `frontend/.env.local` uses `VITE_API_URL=/api`
- k6 defaults to `http://localhost:5001`

### Production cutover checklist

1. Confirm `package-boss-api` on Render is the Express service (`server/`, health `/api/health`).
2. Copy the same secrets Flask used: `DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET_KEY`, email/upload/WhatsApp keys, `FRONTEND_URL`, `CORS_ORIGINS`, OAuth client IDs/secrets.
3. Set frontend `VITE_API_URL` to the Express public URL **with** `/api` suffix, e.g. `https://package-boss-api.onrender.com/api`.
4. Redeploy the static frontend so the baked-in `VITE_API_URL` updates.
5. Smoke: login (email/Google/Facebook), receive package, release & bill, checkout, admin stats.
6. Keep Flask deploy available until soak is clean, then scale it down (do not delete until confident).

### Ports

| Service | Port |
|---------|------|
| Vite dev server | `5173` |
| Express (primary) | `5001` |
| Flask (legacy / DDL only) | `5000` |

## Rollback

If Express causes issues in production:

1. Set `VITE_API_URL` back to the Flask URL (e.g. `https://your-flask-service.onrender.com/api`).
2. Redeploy the frontend static site.
3. Stop or scale down the Express web service on Render.

No database rollback is required — both APIs share the same Postgres schema and migrations managed by Flask/Alembic.

## Render deployment

`render.yaml` at the repo root defines:

- **package-boss-frontend** — static Vite build
- **package-boss-api** — Express web service (`server/`)

Sync the blueprint after pushing. Set secrets on the API service: `DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET_KEY`, and optional email/WhatsApp keys.

Build command: `cd server && npm ci && npm run build`  
Start command: `cd server && npm start`

## Startup hooks

On boot, the server:

1. Seeds shipping rate tiers if the table is empty
2. Ensures the unidentified package holder account (`BOSS-00000`)
3. Promotes `ADMIN_EMAIL` to admin and `CLERK_EMAIL` / `STAFF_EMAIL` to clerk

These mirror the Flask `create_app()` startup behavior.
