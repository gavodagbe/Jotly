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

### Database
- PostgreSQL
- Prisma `Task` model with status, priority, date, and lifecycle timestamps

### Testing
- Node test runner tests for task routes in `backend/src/routes/tasks.test.ts`

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
```

## Frontend baseline (implemented)
Main UI currently includes:
- date selector
- previous / today / next navigation
- 4-column Kanban board
- create/edit task dialog
- delete confirmation dialog
- empty states and API error states

UI principles:
- elegant
- minimal
- desktop-first
- responsive enough
- predictable interactions

## Sprint 1 postponed modules
The following modules are explicitly postponed after Sprint 1 implementation:
- comments
- attachments
- recurrence
- AI assistant
- reporting
- auth
- multi-user
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
- Sprint 1 status: postponed.

### Attachments
- Relation to tasks: one task can have many attachments.
- Metadata vs file storage: metadata in PostgreSQL, binary object storage handled by a dedicated storage integration later.
- Likely backend ownership: `backend/src/attachments/`.
- Likely frontend entry points: task dialog attachment section in `frontend/src/features/attachments/`.
- Likely API surface: `GET/POST /api/tasks/:id/attachments`, `DELETE /api/tasks/:id/attachments/:attachmentId`.
- Sprint 1 status: postponed.

### Recurrence
- Relation to tasks: recurrence defines future task instances; each generated task still owns an explicit `targetDate`.
- Likely model shape: recurrence rule + task template reference, generated instances remain regular tasks.
- Likely backend ownership: `backend/src/recurrence/`.
- Likely frontend entry points: recurrence controls in task create/edit flow under `frontend/src/features/recurrence/`.
- Sprint 1 status: postponed.

### AI assistant
- Relation to task history: read-oriented assistant over tasks, status transitions, and dates.
- Likely backend ownership: `backend/src/assistant/`.
- Data/query dependencies: task list/history plus future comment and attachment metadata.
- Likely frontend entry points: assistant panel under `frontend/src/features/assistant/`.
- Sprint 1 status: postponed.

### Reporting
- Likely reporting dimensions: completion by date, status distribution, throughput trends, cancellation rate.
- Likely backend ownership: `backend/src/reporting/`.
- Data dependencies: task lifecycle fields (`status`, `targetDate`, `completedAt`, `cancelledAt`) plus future recurrence/comment/attachment signals.
- Likely frontend entry points: analytics dashboards under `frontend/src/features/reporting/`.
- Sprint 1 status: postponed.

## Known future entities and extension points (not implemented)
Potential future entities:
- `TaskComment`
- `TaskAttachment`
- `TaskRecurrenceRule`
- `TaskActivityEvent` (optional, if reporting granularity requires event-level history)

Current extension points to preserve:
- task route module boundaries in `backend/src/routes/`
- store/service boundaries in `backend/src/tasks/`
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
