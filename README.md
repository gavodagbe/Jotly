# Jotly

Jotly is a date-driven daily task dashboard built as a monorepo.

This repository currently contains the MVP foundation:
- `frontend/` Next.js app shell
- `backend/` Fastify API foundation
- Docker Compose local stack with PostgreSQL
- Authenticated task board with comments, attachments, recurrence, AI assistant, day affirmations, carry-over, and day bilan

## Daily Workflow APIs

Authenticated endpoints for the daily workflow layer:
- `GET /api/day-affirmation?date=YYYY-MM-DD`
- `PUT /api/day-affirmation`
- `POST /api/tasks/carry-over-yesterday`
- `GET /api/day-bilan?date=YYYY-MM-DD`
- `PUT /api/day-bilan`
- `GET /api/profile`
- `PATCH /api/profile`

Request body examples:
- `PUT /api/day-affirmation`
  - `{ "date": "2026-03-08", "text": "I choose focus and execution.", "isCompleted": true }`
- `POST /api/tasks/carry-over-yesterday`
  - `{ "targetDate": "2026-03-08" }`
  - response includes `{ copiedCount, skippedCount, tasks }`
- `PUT /api/day-bilan`
  - `{ "date": "2026-03-08", "mood": 4, "wins": "...", "blockers": "...", "lessonsLearned": "...", "tomorrowTop3": "..." }`
- `PATCH /api/profile`
  - `{ "displayName": "Godwin", "preferredLocale": "fr", "preferredTimeZone": "Europe/Paris" }`

Profile preferences:
- `preferredLocale` currently supports: `en`, `fr`
- `preferredTimeZone` expects a valid IANA timezone (for example `Europe/Paris`, `America/New_York`)
- assistant requests can include `locale`; backend defaults to authenticated user profile locale
- frontend UI language follows `preferredLocale` after login (with browser-language fallback before login)

## Repository Layout
- `frontend/` - frontend application workspace
- `backend/` - backend API workspace
- `planning/` - delivery plan and architecture guidance
- `.codex/` - Codex project configuration and prompt helpers

## Local Docker Stack

1. (Optional) Copy env defaults:

```bash
cp .env.example .env
```

2. Start all services:

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432` (data persisted in named volume `postgres_data`)

Note: inside Docker Compose, backend connects to PostgreSQL via service hostname `postgres` using `DATABASE_URL_DOCKER`.

## AI Assistant Configuration

Backend assistant route:
- `POST /api/assistant/reply`
- request body: `{ "question": "..." }`
- authenticated scope: all tasks/comments owned by the current user across all dates

Modes:
- `AI_ASSISTANT_PROVIDER=heuristic` (default, no external dependency)
- `AI_ASSISTANT_PROVIDER=openai` (requires `OPENAI_API_KEY`)

Relevant backend env vars:
- `AI_ASSISTANT_PROVIDER`
- `OPENAI_API_KEY` (required only for OpenAI provider)
- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `OPENAI_API_BASE_URL` (default: `https://api.openai.com/v1`)
- `AI_ASSISTANT_TIMEOUT_MS` (default: `10000`)

## Gaming Track (Phase 1-4 implemented)

Gaming Track now includes a first production slice focused on periodized progress scoring.

Delivered:
- backend endpoint: `GET /api/gaming-track/summary?date=YYYY-MM-DD&period=day|week|month|year`
- authenticated aggregation across user-owned:
  - tasks (completion, actionable, cancelled, carry-over count)
  - day affirmation completion
  - day bilan completion
- computed scores:
  - execution
  - reflection
  - consistency
  - momentum
  - overall
- trend deltas versus previous same-length window
- frontend dashboard card with `D/W/M/Y` switcher and localized labels (`en`/`fr`)
- weekly missions (task, affirmation, bilan, and execution streak targets)
- personal bests (best daily throughput and best streaks)
- progression level system (XP, level rank, next-level progress)
- milestone badges (unlock/progress states)
- streak protection signals (earned charges + at-risk detection)
- historical trend views (daily, weekly, monthly points)
- dynamic weekly challenge (reward XP + expiry)
- personal weekly leaderboard (rank vs recent weekly baselines)
- weekly recap block (highlights + focus actions)
- engagement nudges (streak risk, carry-over pressure, momentum signals)

Still planned for next phases:
- deeper analytics screens and social collaborative loops

## Production Deployment (Hostinger VM + Nginx)

This repo now includes production-specific assets:
- `docker-compose.prod.yml`
- `backend/Dockerfile.prod`
- `frontend/Dockerfile.prod`
- `scripts/deploy.sh`
- `scripts/start-prod.sh`
- `scripts/stop-prod.sh`
- `scripts/install-nginx-site.sh`
- `deploy/nginx/jotly.godwinavodagbe.com.conf`
- `.env.prod.example`

### 1. Prepare VM env file

```bash
cp .env.prod.example .env.prod
```

Update `.env.prod`:
- set a strong `POSTGRES_PASSWORD`
- keep `FRONTEND_HOST_PORT=3100` (or choose another free port)
- keep `FRONTEND_BACKEND_API_BASE_URL=http://backend:3001`
- set `NEXT_PUBLIC_API_BASE_URL=https://jotly.godwinavodagbe.com/backend-api`

### 2. Deploy from GitHub

```bash
./scripts/deploy.sh main
```

This script:
- fetches/pulls latest code from branch
- builds production images
- starts containers with compose project `jotly_prod` (default)
- verifies health endpoint on `http://127.0.0.1:3100/backend-api/health`

### 3. Configure Nginx on VM

Install HTTP site first (based on `.env.prod` values):

```bash
sudo ./scripts/install-nginx-site.sh http
```

This writes and enables:
- `/etc/nginx/sites-available/<APP_DOMAIN>.conf`
- `/etc/nginx/sites-enabled/<APP_DOMAIN>.conf`

Default upstream:
- `http://127.0.0.1:3100` (from `FRONTEND_HOST_PORT`)

### 4. HTTPS certificate

Issue/attach TLS cert with Certbot:

```bash
sudo certbot --nginx -d jotly.godwinavodagbe.com
```

Then switch to explicit HTTPS config and reload:

```bash
sudo ./scripts/install-nginx-site.sh https
```

Reference static HTTPS config for this domain:
- `deploy/nginx/jotly.godwinavodagbe.com.conf`

### 5. Runtime commands

```bash
./scripts/start-prod.sh
./scripts/stop-prod.sh
```

### 6. Task ownership backfill verification (staging/prod)

After applying the migration that adds `Task.userId`, run:

```bash
cd backend
npm run prisma:verify-task-ownership
```

This reports task ownership counts by user and fails if any orphaned tasks are detected.
