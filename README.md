# Jotly

Jotly is a date-driven daily task dashboard built as a monorepo.

This repository currently contains the MVP foundation:
- `frontend/` Next.js app shell
- `backend/` Fastify API foundation
- Docker Compose local stack with PostgreSQL

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
