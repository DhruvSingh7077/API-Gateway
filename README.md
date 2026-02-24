# API Gateway

Lightweight TypeScript API gateway for AI workloads with:
- API key auth
- per-key rate limits and daily budgets
- Redis response caching
- cost + token tracking
- live dashboard updates via Socket.IO
- Prometheus and Grafana observability

## Architecture

- **Gateway API (Express)**: request auth, rate limiting, proxying, metrics, admin endpoints
- **PostgreSQL**: API keys + request/cost history
- **Redis**: cache, rate-limit counters, pub/sub for realtime dashboard updates
- **Dashboard (React + Vite)**: user-level spend, latency, cache-hit, and endpoint/model metrics
- **Prometheus + Grafana**: system and HTTP telemetry

## Tech Stack

- Node.js 18+
- TypeScript
- Express
- PostgreSQL 16
- Redis 7
- React + Vite
- Prometheus + Grafana

## Quick Start (Local)

### 1) Install dependencies

```bash
npm install
cd dashboard && npm install && cd ..
```

### 2) Start infrastructure

```bash
docker compose up -d
```

This brings up:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- Prometheus on `localhost:9090`
- Grafana on `localhost:3005` (admin/admin)

### 3) Configure environment

The repository already includes a `.env` file for local development defaults.

Important values to review before running:
- `ADMIN_API_KEY`
- `JWT_SECRET`
- `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`
- `MOCK_BACKEND` (`true` by default for demo/testing)

### 4) Run backend

```bash
npm run dev
```

Backend default URL: `http://localhost:3000`

### 5) Run dashboard (separate terminal)

```bash
cd dashboard
npm run dev
```

Dashboard default URL: `http://localhost:5173`

## Environment Variables

Core server + security:
- `PORT` (default `3000`)
- `NODE_ENV` (default `development`)
- `ADMIN_API_KEY`
- `JWT_SECRET`

PostgreSQL:
- `POSTGRES_HOST` (default `127.0.0.1`)
- `POSTGRES_PORT` (default `5432`)
- `POSTGRES_DB` (default `api_gateway`)
- `POSTGRES_USER` (default `gateway_user`)
- `POSTGRES_PASSWORD` (default `gateway_password`)

Redis:
- `REDIS_HOST` (default `localhost`)
- `REDIS_PORT` (default `6379`)
- `REDIS_PASSWORD` (optional)

Backends:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `MOCK_BACKEND` (default `true`)

Feature flags:
- `ENABLE_CACHING`
- `CACHE_TTL_SECONDS`
- `ENABLE_RATE_LIMITING`
- `ENABLE_BUDGET_ALERTS`
- `ENABLE_COST_TRACKING`

Defaults:
- `DEFAULT_RATE_LIMIT_PER_MINUTE`
- `DEFAULT_DAILY_BUDGET_USD`

Dashboard client (optional, Vite env):
- `VITE_API_BASE_URL` (default `http://localhost:3000`)
- `VITE_SOCKET_URL` (default same as API base)
- `VITE_ADMIN_API_KEY`
- `VITE_DASHBOARD_USER_ID`
- `VITE_DASHBOARD_USERS` (comma-separated)

## API Overview

### Health + Metrics

- `GET /health`
- `GET /health/detailed`
- `GET /health/ready`
- `GET /health/live`
- `GET /metrics` (Prometheus format)

### Admin (requires `X-Admin-Key`)

- `POST /admin/keys` create key
- `GET /admin/keys` list keys
- `GET /admin/keys/:id` get key
- `PATCH /admin/keys/:id` update key
- `DELETE /admin/keys/:id` deactivate key
- `GET /admin/users/:userId/metrics?days=7` user analytics
- `GET /admin/keys/:id/usage?days=7` key usage analytics

### Proxy (requires `X-API-Key`)

- `ALL /api/*` forwards to OpenAI/Anthropic based on endpoint detection

Example:
```bash
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <YOUR_USER_KEY>" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}'
```

Gateway response headers include:
- `X-Cache: HIT|MISS`
- `X-Request-Cost: $...`
- `X-Response-Time: ...ms`
- `X-Tokens-Used: ...` (when available)

## Common Flow

1. Create a user API key with admin credentials.
2. Send requests to `/api/...` with `X-API-Key`.
3. Inspect usage/cost metrics from admin endpoints or dashboard.

Create key example:
```bash
curl -X POST http://localhost:3000/admin/keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: admin_dev_key_12345" \
  -d '{"userId":"test_user","name":"Demo Key","rateLimitPerMinute":100,"dailyBudgetUsd":50}'
```

## Scripts

Backend:
- `npm run dev` - run backend with hot reload
- `npm run build` - compile TypeScript
- `npm start` - run compiled backend
- `npm test` - run Jest tests

Dashboard:
- `cd dashboard && npm run dev` - start Vite dev server
- `cd dashboard && npm run build` - build static dashboard
- `cd dashboard && npm run preview` - preview build

## Testing

Run all tests:

```bash
npm test
```

## Observability

- Prometheus scrape endpoint: `http://localhost:3000/metrics`
- Prometheus UI: `http://localhost:9090`
- Grafana UI: `http://localhost:3005` (admin/admin)

The Docker setup includes provisioning config under `docker/grafana/provisioning`.

## Deployment

An EC2-oriented deploy script exists at `scripts/deploy-ec2.sh`.

What it does at a high level:
- pulls latest code
- starts Docker services
- builds backend + dashboard
- restarts/starts PM2 processes (`api-gateway`, `dashboard`)

## Known Notes

- `MOCK_BACKEND=true` is useful for demos and dashboard traffic generation without real provider keys.
- `package.json` currently declares `create-key`, `migrate`, and `seed` scripts, but the corresponding TypeScript files are not present in `scripts/`.
