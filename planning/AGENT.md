# Jotly — Technical Contract

## Purpose
Jotly is a date-driven daily task dashboard.

The MVP must allow a user to:
- select a date
- view tasks for that date
- manage tasks in 4 Kanban statuses:
  - `todo`
  - `in_progress`
  - `done`
  - `cancelled`
- create, edit, delete, and move tasks
- persist task data in PostgreSQL

## Repository architecture
Monorepo structure:

- `frontend/` → Next.js web app
- `backend/` → Fastify API and business logic
- `planning/` → technical guidance and review docs

## Stack
### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- dnd-kit
- date-fns

### Backend
- Fastify
- TypeScript
- Zod
- Prisma

### Database
- PostgreSQL

### Testing
- Vitest
- Playwright

### Infrastructure
- Docker
- Docker Compose

## Core product rules
- A task belongs to one `targetDate`.
- Changing status does not change the date.
- Rescheduling must be explicit.
- Backend is the source of truth for business rules.
- Frontend must use backend APIs, not fake business state.

## Task model
Minimum expected task fields:
- `id`
- `title`
- `description`
- `status`
- `targetDate`
- `priority`
- `project` (optional)
- `plannedTime` (optional)
- `createdAt`
- `updatedAt`
- `completedAt` (optional)
- `cancelledAt` (optional)

Allowed statuses:
- `todo`
- `in_progress`
- `done`
- `cancelled`

## API baseline
Required initial endpoints:
- `GET /api/health`
- `GET /api/tasks?date=YYYY-MM-DD`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

Rules:
- JSON-only API
- validate writes with Zod
- return structured errors
- keep route handlers explicit and simple

Example error shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required"
  }
}

Frontend baseline

Main UI must include:
	•	date selector
	•	previous / today / next navigation
	•	4-column Kanban board
	•	create/edit task dialog or sheet
	•	clean empty states

UI principles:
	•	elegant
	•	minimal
	•	desktop-first
	•	responsive enough
	•	predictable interactions

Sprint 1 scope

Included:
	•	repo setup
	•	frontend setup
	•	backend setup
	•	PostgreSQL + Docker Compose
	•	Prisma task schema
	•	task CRUD API
	•	Kanban board by date
	•	drag and drop status changes
	•	create/edit/delete task flows

Not fully implemented in Sprint 1:
	•	comments
	•	attachments
	•	recurrence
	•	AI assistant
	•	reporting
	•	auth
	•	multi-user
	•	notifications
	•	mobile app
	•	real-time sync
	•	offline-first

These may be documented, but not built unless a ticket explicitly requires it.

Engineering guardrails
	•	Prefer clarity over cleverness.
	•	Prefer simple solutions over premature abstractions.
	•	Keep frontend and backend responsibilities separate.
	•	Do not introduce unnecessary libraries.
	•	Do not add unrelated features.
	•	Do not implement multiple tickets at once unless explicitly requested.


