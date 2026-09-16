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

## Frontend cutover

Point the Vite frontend at the Express API:

```env
# frontend/.env.local (development)
VITE_API_URL=http://localhost:5001/api
```

Production (Render or other host):

```env
VITE_API_URL=https://package-boss-api.onrender.com/api
```

Rebuild/redeploy the frontend after changing `VITE_API_URL`. The SPA calls `${VITE_API_URL}/...` for all API requests.

### Ports

| Service | Port |
|---------|------|
| Vite dev server | `5173` |
| Flask (legacy) | `5000` |
| Express (new) | `5001` |

Run Flask and Express side-by-side during migration; switch `VITE_API_URL` when ready.

## Rollback

If Express causes issues in production:

1. Set `VITE_API_URL` back to the Flask URL (e.g. `https://your-flask-service.onrender.com/api`).
2. Redeploy the frontend static site.
3. Stop or scale down the Express web service on Render.

No database rollback is required — both APIs share the same Postgres schema and migrations managed by Flask/Alembic today.

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
