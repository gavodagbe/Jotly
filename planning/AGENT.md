# Jotly - Technical Contract

## Purpose
Jotly is a date-driven daily task dashboard.

The MVP allows a user to:
- select a date
- view tasks for that date
- manage tasks in 4 Kanban statuses (`todo`, `in_progress`, `done`, `cancelled`)
- create, edit, delete, and move tasks
- persist task data in PostgreSQL

## Repository architecture
Monorepo structure:
- `frontend/` -> Next.js web app
- `backend/` -> Fastify API and business logic
- `planning/` -> technical guidance and review docs

## Current Sprint 1 implementation snapshot
This section reflects the current repository implementation.

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- dnd-kit for Kanban drag and drop
- Feature surface currently centered in `frontend/src/components/layout/app-shell.tsx`

### Backend
- Fastify
- TypeScript
- Zod request validation
- Prisma ORM
- Task CRUD and date filtering in `backend/src/routes/tasks.ts`
- Auth/session endpoints in `backend/src/routes/auth.ts`
- Comments endpoints in `backend/src/routes/comments.ts`
- Attachments endpoints in `backend/src/routes/attachments.ts`
- Recurrence endpoints in `backend/src/routes/recurrence.ts`
- Day affirmation endpoints in `backend/src/routes/day-affirmation.ts`
- Day bilan endpoints in `backend/src/routes/day-bilan.ts`
- AI assistant endpoint in `backend/src/routes/assistant.ts`

### Database
- PostgreSQL
- Prisma `Task` model with status, priority, date, lifecycle timestamps, and carry-over linkage
- Prisma `DayAffirmation` and `DayBilan` models (one row per user per date)

### Testing
- Node test runner tests for auth/tasks/comments/attachments/recurrence/assistant/day-affirmation/day-bilan routes

### Infrastructure
- Docker
- Docker Compose

## Core product rules
- A task belongs to one `targetDate`.
- Changing status does not change the date.
- Rescheduling must be explicit.
- Backend is the source of truth for business rules.
- Frontend must use backend APIs, not fake business state.

## Current task model
Current task fields:
- `id`
- `rolledFromTaskId` (optional)
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

## API baseline (implemented)
Implemented endpoints:
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/tasks?date=YYYY-MM-DD`
- `POST /api/tasks`
- `POST /api/tasks/carry-over-yesterday`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/tasks/:id/comments`
- `POST /api/tasks/:id/comments`
- `PATCH /api/tasks/:id/comments/:commentId`
- `DELETE /api/tasks/:id/comments/:commentId`
- `GET /api/tasks/:id/attachments`
- `POST /api/tasks/:id/attachments`
- `DELETE /api/tasks/:id/attachments/:attachmentId`
- `GET /api/tasks/:id/recurrence`
- `PUT /api/tasks/:id/recurrence`
- `DELETE /api/tasks/:id/recurrence`
- `GET /api/day-affirmation?date=YYYY-MM-DD`
- `PUT /api/day-affirmation`
- `GET /api/day-bilan?date=YYYY-MM-DD`
- `PUT /api/day-bilan`
- `POST /api/assistant/reply`

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
```

## Frontend baseline (implemented)
Main UI currently includes:
- date selector
- previous / today / next navigation
- 4-column Kanban board
- day affirmation panel
- carry-over action for yesterday non-completed tasks
- day bilan panel
- AI assistant chatbot (FAB) using global user task context
- create/edit task dialog
- delete confirmation dialog
- empty states and API error states
- completion percentage includes day affirmation completion

UI principles:
- elegant
- minimal
- desktop-first
- responsive enough
- predictable interactions

## Sprint 1 postponed modules
The following modules are explicitly postponed after Sprint 1 implementation:
- reporting
- notifications
- mobile app
- real-time sync
- offline-first

These can be documented, but must not be implemented unless a ticket explicitly requires it.

## Future module boundaries (documentation only)
The modules below define intended boundaries without pre-building abstractions.

### Comments
- Relation to tasks: one task can have many comments.
- Likely backend ownership: `backend/src/comments/`.
- Likely frontend entry points: task detail dialog and task card "activity/comment" affordance in `frontend/src/features/comments/`.
- Likely API surface: `GET/POST /api/tasks/:id/comments`, `PATCH/DELETE /api/tasks/:id/comments/:commentId`.
- Current status: implemented.

### Attachments
- Relation to tasks: one task can have many attachments.
- Metadata vs file storage: metadata in PostgreSQL, binary object storage handled by a dedicated storage integration later.
- Likely backend ownership: `backend/src/attachments/`.
- Likely frontend entry points: task dialog attachment section in `frontend/src/features/attachments/`.
- Likely API surface: `GET/POST /api/tasks/:id/attachments`, `DELETE /api/tasks/:id/attachments/:attachmentId`.
- Current status: implemented.

### Recurrence
- Relation to tasks: recurrence defines future task instances; each generated task still owns an explicit `targetDate`.
- Likely model shape: recurrence rule + task template reference, generated instances remain regular tasks.
- Likely backend ownership: `backend/src/recurrence/`.
- Likely frontend entry points: recurrence controls in task create/edit flow under `frontend/src/features/recurrence/`.
- Current status: implemented.

### Day affirmation
- Relation to date workflow: one affirmation per user per selected date.
- Current backend ownership: `backend/src/day-affirmation/`.
- Current API surface:
  - `GET /api/day-affirmation?date=YYYY-MM-DD`
  - `PUT /api/day-affirmation`
- Current behavior:
  - affirmation completion is included in daily completion percentage
- Current status: implemented.

### Carry-over
- Relation to tasks: duplicates actionable tasks from yesterday to selected date.
- Current backend ownership: `backend/src/routes/tasks.ts`.
- Current API surface:
  - `POST /api/tasks/carry-over-yesterday`
- Current behavior:
  - copies only `todo` and `in_progress` from yesterday
  - skips recurrence instances
  - idempotent for the same source task and target date via unique carry-over key
- Current status: implemented.

### Day bilan
- Relation to date workflow: one day-end reflection record per user per selected date.
- Current backend ownership: `backend/src/day-bilan/`.
- Current API surface:
  - `GET /api/day-bilan?date=YYYY-MM-DD`
  - `PUT /api/day-bilan`
- Current fields: `mood`, `wins`, `blockers`, `lessonsLearned`, `tomorrowTop3`.
- Current status: implemented.

### AI assistant
- Relation to task history: read-oriented assistant over tasks, status transitions, and dates.
- Current backend ownership: `backend/src/assistant/`.
- Current API surface: `POST /api/assistant/reply`.
- Current behavior:
  - uses user question + owned tasks/comments across all dates as context
  - supports `heuristic` (default) and `openai` provider modes
  - falls back to heuristic when OpenAI is unavailable
- Current status: implemented.

### Reporting
- Likely reporting dimensions: completion by date, status distribution, throughput trends, cancellation rate.
- Likely backend ownership: `backend/src/reporting/`.
- Data dependencies: task lifecycle fields (`status`, `targetDate`, `completedAt`, `cancelledAt`) plus future recurrence/comment/attachment signals.
- Likely frontend entry points: analytics dashboards under `frontend/src/features/reporting/`.
- Sprint 1 status: postponed.

## Known entities and extension points
Existing entities:
- `Task`
- `TaskComment`
- `TaskAttachment`
- `TaskRecurrenceRule`
- `DayAffirmation`
- `DayBilan`

Potential future entities:
- `TaskActivityEvent` (optional, if reporting granularity requires event-level history)

Current extension points to preserve:
- task route module boundaries in `backend/src/routes/`
- store/service boundaries in `backend/src/tasks/`, `backend/src/day-affirmation/`, and `backend/src/day-bilan/`
- feature-first frontend folders under `frontend/src/features/`
- explicit task API contract as the integration backbone

## Stability rules for current implementation
To avoid architectural drift before future modules:
- keep task CRUD contract stable
- keep `targetDate` as an explicit field on concrete task instances
- keep backend validations authoritative
- avoid silent status/date coupling
- avoid adding empty framework-like abstractions without direct ticket need

## Engineering guardrails
- Prefer clarity over cleverness.
- Prefer simple solutions over premature abstractions.
- Keep frontend and backend responsibilities separate.
- Do not introduce unnecessary libraries.
- Do not add unrelated features.
- Do not implement multiple tickets at once unless explicitly requested.
