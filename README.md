# Jotly

Jotly is a date-driven daily task dashboard built as a monorepo.

This repository currently contains the MVP foundation:
- `frontend/` Next.js app shell
- `backend/` Fastify API foundation
- Docker Compose local stack with PostgreSQL
- Authenticated task board with comments, attachments, recurrence, AI assistant, day affirmations, carry-over, day bilan, Google Calendar event sync, reminders, a unified alerts panel, and global full-text search

## Authentication

Endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Reset password flow:
- `POST /api/auth/forgot-password` — body: `{ "email": "user@example.com" }`, returns `{ success, resetToken, expiresAt }`
- `POST /api/auth/reset-password` — body: `{ "token": "...", "password": "newpassword" }`, returns a new session

## Daily Workflow APIs

Authenticated endpoints for the daily workflow layer:
- `GET /api/day-affirmation?date=YYYY-MM-DD`
- `PUT /api/day-affirmation`
- `POST /api/tasks/carry-over-yesterday`
- `GET /api/day-bilan?date=YYYY-MM-DD`
- `PUT /api/day-bilan`
- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/tasks/alerts?date=YYYY-MM-DD`

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

## Alerts

Authenticated alert APIs and UI conventions:
- `GET /api/tasks/alerts?date=YYYY-MM-DD` — list actionable due-date tasks that are overdue, due today, or due tomorrow
- dashboard `Alerts` panel combines due-date tasks from `/api/tasks/alerts` with active reminders loaded via `GET /api/reminders?date=YYYY-MM-DD`
- task alerts stay visible until the task becomes `done` or `cancelled`
- reminder alerts stay visible until the reminder becomes `completed` or `cancelled`
- alert summary and ordering prioritize `overdue`, then `today`, then `tomorrow`

## Reminders

Authenticated endpoints for reminder management:
- `GET /api/reminders` — list all reminders; with `?date=YYYY-MM-DD`, list active reminders (`pending` or `fired`) scheduled before the end of the selected day
- `GET /api/reminders/pending` — list due reminders still in `pending` status (auto-marks them as `fired`)
- `GET /api/reminders/:id` — get single reminder
- `POST /api/reminders` — create reminder
- `PUT /api/reminders/:id` — update reminder
- `DELETE /api/reminders/:id` — delete reminder
- `POST /api/reminders/:id/complete` — mark reminder as completed
- `POST /api/reminders/:id/cancel` — mark reminder as cancelled
- `POST /api/reminders/:id/dismiss` — legacy alias for `complete`

Request body for create/update:
```json
{
  "title": "Team meeting",
  "description": "Optional rich text description",
  "project": "Optional project name",
  "assignees": "Optional assignee list",
  "remindAt": "2026-03-17T14:00:00.000Z"
}
```

Reminder fields:
- `status` — `pending`, `fired`, `completed`, `cancelled`
- `isFired` — compatibility flag set automatically when reminder appears in `/pending` response
- `isDismissed` — compatibility flag set when reminder is completed or cancelled
- `firedAt`, `dismissedAt`, `completedAt`, `cancelledAt` — lifecycle timestamps
- `date` filter on list endpoint returns only active reminders with `remindAt < end of selected day`

Reminder behavior:
- `/pending` promotes returned reminders from `pending` to `fired`
- updating a `fired` reminder to a future `remindAt` resets it to `pending`
- `completed` and `cancelled` reminders remain in storage history but disappear from active reminder/alert views

## Global Search

Full-text search across all user content:
- `GET /api/search?q=...`

Query parameters:
- `q` (required): search query, minimum 2 characters
- `types` (optional): comma-separated source types — `task,comment,affirmation,bilan,reminder,calendarEvent,calendarNote,attachment`
- `from` (optional): ISO date start filter
- `to` (optional): ISO date end filter
- `page` (optional): default 1
- `limit` (optional): default 20, max 50

Response shape:
```json
{
  "data": {
    "results": [
      {
        "sourceType": "task",
        "sourceId": "...",
        "title": "...",
        "snippet": "...highlighted excerpt...",
        "score": 0.85,
        "matchedBy": "fulltext",
        "metadataJson": {},
        "updatedAt": "..."
      }
    ],
    "totalCount": 42,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

Frontend: Cmd/Ctrl+K opens the global search modal with type filtering, optional date range, debounced input, and result navigation.

Search is powered by `AssistantSearchDocument` — a unified PostgreSQL full-text index (`tsvector`) over all text-bearing domains. Content is indexed automatically when records are created or updated.

## Google Calendar Integration

Google Calendar is currently implemented as a read-only integration layer:
- connect one or more Google accounts from the profile dialog
- sync calendar events into PostgreSQL
- show synced events for the selected day directly in the dashboard

Routes are registered only when all backend Google env vars are configured:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CALENDAR_ENCRYPTION_KEY`

OAuth redirect target:
- `FRONTEND_ORIGIN` controls where callback success/error redirects land

Authenticated endpoints:
- `GET /api/google-calendar/auth-url`
- `GET /api/google-calendar/status`
- `DELETE /api/google-calendar/connection/:connectionId`
- `POST /api/google-calendar/sync`
- `GET /api/google-calendar/events?date=YYYY-MM-DD`
- `GET /api/google-calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/google-calendar/events/:id`
- `PUT /api/google-calendar/events/:id/note`
- `DELETE /api/google-calendar/events/:id/note`

OAuth callback:
- `GET /api/google-calendar/callback?code=...&state=...`

Current integration conventions:
- access and refresh tokens are encrypted at rest with AES-256-GCM using `GOOGLE_CALENDAR_ENCRYPTION_KEY`
- OAuth `state` is now a short-lived signed payload bound to the issuing authenticated session
- one Jotly user can connect multiple Google accounts
- first sync performs a full import window of the last 30 days and next 90 days
- later syncs use Google sync tokens and fall back to a full sync if the token expires
- synced events can carry internal Jotly-only notes
- tasks can be created from synced events and linked back through `Task.calendarEventId`
- Google itself remains read-only in this slice

Current limits:
- no calendar write-back to Google yet
- no background/webhook sync yet

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
./scripts/start.sh
```

3. Stop all services:

```bash
./scripts/stop.sh
```

Supported local runtime conventions:
- `scripts/start.sh` wraps Docker Compose build/start, waits for backend and frontend readiness, and prints recent compose logs automatically on startup failure
- backend startup applies Prisma migrations with `npx prisma migrate deploy`, so no manual migration step is required in dev
- `scripts/stop.sh` is the supported shutdown path for the local stack

Services:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432` (data persisted in named volume `postgres_data`)

Note: inside Docker Compose, backend connects to PostgreSQL via service hostname `postgres` using `DATABASE_URL_DOCKER`.
If you want to use Google Calendar locally, set the four Google env vars in `.env` before starting the stack, and override `FRONTEND_ORIGIN` if your frontend is not served from `http://localhost:3000`.

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

## Gaming Track (Phase 1-5 implemented)

Gaming Track now includes a first production slice focused on periodized progress scoring.

Delivered:
- backend endpoint: `GET /api/gaming-track/summary?date=YYYY-MM-DD&period=day|week|month|year`
- engagement action endpoints:
  - `POST /api/gaming-track/challenge/claim`
  - `POST /api/gaming-track/streak-protection/use`
  - `POST /api/gaming-track/nudges/dismiss`
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
- persistent engagement state:
  - challenge reward claiming state per week
  - streak protection usage consumption per day
  - per-day nudge dismissal filtering

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
- set `FRONTEND_ORIGIN=https://jotly.godwinavodagbe.com`
- set Google OAuth env vars if you want the integration enabled in production

### 2. Deploy from GitHub

```bash
./scripts/deploy.sh main
```

This script:
- fetches/pulls latest code from branch
- builds production images
- starts containers with compose project `jotly_prod` (default)
- relies on backend startup to apply Prisma migrations automatically
- verifies health endpoint on `http://127.0.0.1:3100/backend-api/health`
- prints recent compose logs automatically if the health check never becomes ready

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
