# k6 API testing

[Grafana k6](https://grafana.com/docs/k6/latest/) scripts for Package Boss API **regression** (smoke) and **load** testing.

## Install k6

- **Windows:** `winget install Grafana.k6` or [download](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- **macOS:** `brew install k6`
- **Linux:** see [k6 install docs](https://grafana.com/docs/k6/latest/set-up/install-k6/)

## Prerequisites

Start the backend locally (default `http://localhost:5000`):

```bash
cd backend
set FLASK_APP=wsgi:app
flask db upgrade
python wsgi.py
```

## Regression (smoke) tests

One iteration, strict checks on core public + authenticated customer endpoints. Creates a test user on first run if needed.

```bash
k6 run k6/smoke/regression.js
```

Optional env vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `K6_BASE_URL` | `http://localhost:5000` | API origin (no `/api` suffix) |
| `K6_TEST_EMAIL` | `k6-regression@package-boss.test` | Login/register email |
| `K6_TEST_PASSWORD` | `K6TestPass123!` | Password for test user |

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
