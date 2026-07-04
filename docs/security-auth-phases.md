# Auth & secrets hardening — phased plan

Goals: production-safe secrets, consistent session enforcement, and immediate invalidation when accounts are deactivated or credentials change — without over-engineering for the current Render deployment.

**Stack context:** Flask + Flask-JWT-Extended, JWT in `localStorage`, Gunicorn on Render, PostgreSQL (Neon). **No Redis** — password-reset tokens and rate limits use in-process storage; JWT revocation uses DB `token_version` (Phase 3), not a blocklist.

---

## Phase 1 — Production secrets & config (1 PR, ~1–2 hours)

**Objective:** App must not start in production with default or missing secrets.

### Tasks

| # | Task | Files |
|---|------|-------|
| 1.1 | Split config into `DevelopmentConfig` and `ProductionConfig` | `backend/app/config.py` |
| 1.2 | `ProductionConfig.validate()` — fail if `SECRET_KEY`, `JWT_SECRET_KEY`, or `DATABASE_URL` is missing or in a blocklist (`dev-secret-change-me`, `change-me-in-production`, empty) | `backend/app/config.py` |
| 1.3 | Select config in `create_app()` from `FLASK_ENV` / `ENV` (treat `production` as prod) | `backend/app/__init__.py` |
| 1.4 | Require **distinct** `JWT_SECRET_KEY` in production (not equal to `SECRET_KEY`) | `backend/app/config.py` |
| 1.5 | Document required env vars | `.env.example`, README (optional) |

### Render / ops

1. Generate two values: `python -c "import secrets; print(secrets.token_hex(32))"`
2. Set on backend service:
   - `FLASK_ENV=production`
   - `SECRET_KEY=<random>`
   - `JWT_SECRET_KEY=<different random>`
   - `DATABASE_URL=<neon url>`
3. Redeploy — confirm boot succeeds; temporarily unset a secret to confirm **fail-fast**.

### Acceptance criteria

- [x] Local dev still runs without setting secrets (defaults OK).
- [x] Production deploy crashes on startup if secrets missing or insecure.
- [x] Health check never serves traffic with dev secrets in prod.

### Risk

Low. No API contract change.

---

## Phase 2 — Unified auth checks & shorter JWT TTL (1 PR, ~2–3 hours)

**Objective:** Every protected route rejects deactivated users; tokens don’t live for 7 days without a revocation story.

### Tasks

| # | Task | Files |
|---|------|-------|
| 2.1 | Extend `get_user_from_jwt()` to enforce `user.is_active` (return `None` or raise a shared `AuthError`) | `backend/app/utils/auth_decorators.py` |
| 2.2 | Remove duplicate `_get_current_user()` — use `get_user_from_jwt()` in `me.py`, `packages.py`, `uploads.py` | route modules |
| 2.3 | Ensure customer routes return **403** with `{"error": "Account deactivated"}` when inactive | `me.py`, `packages.py`, `pre_alerts.py` |
| 2.4 | Register JWT error handlers: expired → 401, invalid → 401, missing → 401 | `backend/app/__init__.py` or `extensions.py` |
| 2.5 | Shorten `JWT_ACCESS_TOKEN_EXPIRES` to **24 hours** (or 8h for staff via role claim — optional in this phase) | `backend/app/config.py` |
| 2.6 | Frontend Axios **response interceptor**: on 401/403 from API, clear token + redirect to `/login?next=...` | `frontend/src/api/client.ts` |
| 2.7 | Avoid redirect loop on `/auth/login` failures | `frontend/src/api/client.ts` |

### Acceptance criteria

- [x] Deactivated clerk blocked on warehouse routes (already true — regression test).
- [x] Deactivated **customer** gets 403 on `GET /api/me` and `GET /api/me/packages`.
- [x] Admin deactivates user → next API call logs them out in UI (interceptor).
- [x] Expired JWT returns 401 JSON, not opaque 422.

### Risk

Medium. All logged-in users re-login after deploy if TTL changes from 7d → 24h (acceptable; communicate if clients are live).

---

## Phase 3 — Token versioning (DB-backed revocation) (1 PR, ~3–4 hours)

**Objective:** Invalidate **all** outstanding JWTs when password changes, account deactivates, or role/permissions change materially.

### Tasks

| # | Task | Files |
|---|------|-------|
| 3.1 | Migration: add `users.token_version INTEGER NOT NULL DEFAULT 0` | `backend/migrations/versions/` |
| 3.2 | Include `tv` claim in `create_access_token(..., additional_claims={"tv": user.token_version})` | `backend/app/routes/auth.py` |
| 3.3 | In `get_user_from_jwt()`, compare JWT `tv` to `user.token_version`; mismatch → treat as unauthenticated | `auth_decorators.py` |
| 3.4 | Bump `token_version` on: deactivate clerk, password change, admin role change (customer → clerk, clerk demote) | `admin.py`, `profile_service.py`, `auth.py` (reset-password) |
| 3.5 | Optional: `POST /api/auth/logout` that bumps version (invalidates all devices) | `auth.py` |
| 3.6 | k6 / manual test: old token fails after deactivate | `k6/` scripts |

### Bump `token_version` when

| Event | Bump? |
|-------|-------|
| User deactivated | Yes |
| Password changed / reset | Yes |
| Role changed (customer ↔ clerk ↔ admin) | Yes |
| Profile edit (name, phone) | No |
| Clerk permissions JSON updated | Yes (recommended) |

### Acceptance criteria

- [x] Token issued before deactivation fails within one request (401).
- [x] Password reset invalidates old sessions.
- [x] New login after bump works normally.

### Risk

Low–medium. Requires migration on Neon before deploy (`flask db upgrade` in Render release command).

---

## Phase 4 — Optional polish (defer until post-launch)

Pick based on product need; not required for a safe demo or small production.

| Item | When to add |
|------|-------------|
| **Role-based TTL** (customers 7d, staff 8h) | If 24h re-login annoys customers |
| **Refresh tokens** (httpOnly cookie) | If you want “stay logged in” + short access tokens |
| **Audit log** for auth events (login fail, deactivate, token bump) | Compliance / admin visibility |
| **Automated tests** for auth flows | CI regression (`pytest` + extend k6) |

---

## Suggested PR order

```
PR1  phase-1/production-config-secrets
PR2  phase-2/unified-auth-and-jwt-errors
PR3  phase-2/frontend-401-interceptor      (can merge with PR2)
PR4  phase-3/token-version-revocation
```

Phases 1 and 2 can ship before a client demo. Phase 3 before real customer data at scale.

---

## Test checklist (run after each phase)

### Manual

1. Register → login → `GET /api/me` → 200
2. Admin deactivates user → `GET /api/me` → 403 → UI redirects to login
3. Wrong `JWT_SECRET_KEY` on server → all tokens 401
4. Production boot without `SECRET_KEY` → process exits non-zero

### k6 (existing workflow)

- Extend `k6/load/` with authenticated smoke using a test user JWT
- Run `.github/workflows/k6-regression.yml` against staging after each phase

---

## Render deploy notes

| Step | Command / setting |
|------|-------------------|
| Release command | `flask db upgrade` (required before Phase 3) |
| Env | Set secrets **before** enabling Phase 1 production config |
| Rollback | Keep previous deploy if migration fails; never run downgrade on prod without backup |

---

## Out of scope (from codebase review)

These are separate efforts — do not mix into auth phases:

- TRN encryption at rest
- Public track API (already removed)
- Distributed rate-limit store (would need Redis or DB; current limits are in-process per worker)
- Refresh token / httpOnly cookie migration

---

## Effort summary

| Phase | Effort | Ship before demo? | Ship before launch? |
|-------|--------|-------------------|---------------------|
| 1 Secrets | ~2h | Recommended | Required |
| 2 Active user + TTL + interceptor | ~3h | Recommended | Required |
| 3 Token version | ~4h | Optional | Required |
| 4 Polish | Variable | No | As needed |
