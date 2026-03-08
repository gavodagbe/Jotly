# Jotly - Architecture Decisions and Risks

## Current implementation reality check (as of 2026-03-08)
Implemented in the current codebase:
- backend task CRUD API with date filtering (`backend/src/routes/tasks.ts`)
- backend auth/session API (`backend/src/routes/auth.ts`)
- authenticated ownership boundaries on task-linked routes (tasks/comments/attachments/recurrence)
- backend AI assistant reply API (`backend/src/routes/assistant.ts`)
- backend comments API (`backend/src/routes/comments.ts`)
- backend attachments API (`backend/src/routes/attachments.ts`)
- backend recurrence API (`backend/src/routes/recurrence.ts`)
- backend day affirmation API (`backend/src/routes/day-affirmation.ts`)
- backend day bilan API (`backend/src/routes/day-bilan.ts`)
- backend carry-over endpoint for yesterday non-completed tasks (`backend/src/routes/tasks.ts`)
- Fastify request body limit configured to 8 MB (`backend/src/app.ts`)
- attachment validation limit of 5 MB per attachment plus URL payload size guard (`backend/src/routes/attachments.ts`)
- Prisma task model with status, priority, lifecycle timestamps, and carry-over linkage (`backend/prisma/schema.prisma`)
- Prisma `DayAffirmation` and `DayBilan` models (`backend/prisma/schema.prisma`)
- frontend date-driven Kanban board with create/edit/delete dialogs and drag-and-drop status updates (`frontend/src/components/layout/app-shell.tsx`)
- frontend task details support for comments, recurrence, and file-based attachments converted to `data:` URLs before upload (`frontend/src/components/layout/app-shell.tsx`)
- frontend day affirmation panel and day bilan panel (`frontend/src/components/layout/app-shell.tsx`)
- frontend carry-over CTA in date controls (`frontend/src/components/layout/app-shell.tsx`)
- daily completion percentage includes day affirmation completion (`frontend/src/components/layout/app-shell.tsx`)
- frontend AI assistant chatbot (FAB) with global user task context (`frontend/src/components/layout/app-shell.tsx`)
- Docker Compose local runtime (frontend, backend, postgres)
- route tests for auth/tasks/comments/attachments/recurrence/assistant/day-affirmation/day-bilan

Not implemented yet:
- reporting
- notifications
- mobile client
- real-time sync
- offline-first behavior

## Key decisions

### 1. Separate frontend and backend
Jotly uses a monorepo with:
- `frontend/`
- `backend/`

Reason:
- cleaner separation of concerns
- easier long-term maintenance
- better fit for ticket-by-ticket implementation

### 2. PostgreSQL over MongoDB
Jotly uses PostgreSQL as the primary database.

Reason:
- stronger foundation for date filtering
- better fit for reporting and analytics
- relational consistency for task-linked entities
- cleaner long-term evolution

### 3. Prisma as ORM
Prisma is used for schema management and data access.

Reason:
- explicit schema
- good TypeScript integration
- clean migrations
- pragmatic developer experience

### 4. Fastify for backend
Fastify is used for the API service.

Reason:
- lightweight
- explicit
- well-suited for a focused REST backend

### 5. Next.js for frontend
Next.js is used for the web UI.

Reason:
- modern frontend base
- strong TypeScript support
- good fit for a polished dashboard UI

### 6. Docker Compose for local environment
Local development runs through:
- frontend
- backend
- postgres

Reason:
- reproducible setup
- easier service wiring
- clean path to later VM deployment

### 7. Jira + Confluence MCP only for planning context
Use Atlassian MCP for ticket and documentation context.
Do not depend on GitHub MCP for planning workflow.

Reason:
- Jira and Confluence provide enough planning context
- local Git is enough for implementation
- simpler and more controlled workflow

### 8. Manual commits and PRs
Agent may create a local branch, but must not commit or open PRs.

Reason:
- better human control
- cleaner Git history
- safer delivery workflow

## Module boundary map
The boundaries below reflect current ownership and future evolution points.

### Comments
- Relation to tasks: comments are children of tasks.
- Current API surface:
  - `GET /api/tasks/:id/comments`
  - `POST /api/tasks/:id/comments`
  - `PATCH /api/tasks/:id/comments/:commentId`
  - `DELETE /api/tasks/:id/comments/:commentId`
- Current posture: implemented with ownership enforcement.

### Attachments
- Relation to tasks: attachments are task-linked assets.
- Current API surface:
  - `GET /api/tasks/:id/attachments`
  - `POST /api/tasks/:id/attachments`
  - `DELETE /api/tasks/:id/attachments/:attachmentId`
- Current MVP storage posture:
  - frontend sends file content as `data:` URL
  - metadata (`name`, `contentType`, `sizeBytes`) stored with attachment record
  - backend enforces max size 5 MB per attachment
  - app-level body limit set to 8 MB
- Future direction: migrate binary content to dedicated object storage and keep PostgreSQL for metadata only.

### Recurrence
- Relation to tasks: recurrence rules generate date-specific task instances.
- Current API surface:
  - `GET /api/tasks/:id/recurrence`
  - `PUT /api/tasks/:id/recurrence`
  - `DELETE /api/tasks/:id/recurrence`
- Current posture: implemented.
- Evolution rule: keep concrete daily tasks explicit and persist recurrence metadata separately.

### Day affirmation
- Relation to date workflow: one affirmation row per user per selected date.
- Current API surface:
  - `GET /api/day-affirmation?date=YYYY-MM-DD`
  - `PUT /api/day-affirmation`
- Current posture: implemented.
- Completion semantics:
  - daily completion includes affirmation completion as an additional completion item.

### Carry-over
- Relation to tasks: copies actionable tasks from yesterday into selected date.
- Current API surface:
  - `POST /api/tasks/carry-over-yesterday`
- Current posture: implemented.
- Idempotency posture:
  - enforced by `(rolledFromTaskId, targetDate)` unique key.
- Copy rules:
  - copy only `todo` and `in_progress`
  - skip recurrence-generated tasks

### Day bilan
- Relation to date workflow: one end-of-day review row per user per selected date.
- Current API surface:
  - `GET /api/day-bilan?date=YYYY-MM-DD`
  - `PUT /api/day-bilan`
- Current fields:
  - `mood`, `wins`, `blockers`, `lessonsLearned`, `tomorrowTop3`
- Current posture: implemented.

### AI assistant
- Relation to task history: read-oriented assistant over tasks and related entities.
- Current backend module: `backend/src/assistant/`.
- Current API surface:
  - `POST /api/assistant/reply`
- Current behavior:
  - uses user question + owned tasks/comments across all dates as context
  - supports `heuristic` (default) and `openai` provider modes
  - falls back to heuristic when OpenAI is unavailable
- Current posture: implemented.

### Reporting
- Relation to task history: aggregated analytics over task lifecycle and date dimensions.
- Likely backend module: `backend/src/reporting/`.
- Likely frontend feature area: `frontend/src/features/reporting/`.
- Sprint posture: postponed.

## Entities and extension points
Existing entities:
- `Task`
- `TaskComment`
- `TaskAttachment`
- `TaskRecurrenceRule`
- `DayAffirmation`
- `DayBilan`

Likely future entities:
- `TaskActivityEvent` (if event-level analytics becomes required)

Current extension points to preserve:
- backend route split by domain in `backend/src/routes/`
- backend domain modules in `backend/src/tasks/`, `backend/src/auth/`, `backend/src/recurrence/`, `backend/src/day-affirmation/`, `backend/src/day-bilan/`, and `backend/src/assistant/`
- frontend feature folders in `frontend/src/features/`
- stable task API contract for frontend/backend integration

## Main risks

### Risk 1 - Scope creep
Additional feature requests can blur ticket boundaries.

Mitigation:
- keep delivery ticket-scoped
- defer cross-domain expansion unless explicitly ticketed

### Risk 2 - Attachment storage scalability
`data:` URL payloads can stress request/body size and database growth.

Mitigation:
- enforce 5 MB per attachment
- enforce 8 MB request body limit
- move binary content to object storage in a dedicated follow-up ticket

### Risk 3 - Frontend/backend contract drift
Contracts may diverge as features evolve.

Mitigation:
- keep APIs explicit and stable
- update tests on both sides with each contract change

### Risk 4 - Docs drift
Planning files can lag behind implementation.

Mitigation:
- refresh planning docs whenever architecture or conventions change

### Risk 5 - Reporting blind spots
Analytics work can be blocked if lifecycle semantics drift.

Mitigation:
- preserve current status and timestamp semantics unless changed via dedicated migration + API ticket

### Risk 6 - Assistant provider availability
External AI provider calls can fail or time out.

Mitigation:
- keep heuristic provider as default-safe mode
- keep OpenAI integration optional and environment-controlled

### Risk 7 - Carry-over duplication and workflow noise
Repeated carry-over actions can create duplicated task rows without a clear dedupe strategy.

Mitigation:
- enforce uniqueness by source-task/date pair
- keep carry-over response explicit (`copiedCount`, `skippedCount`)
- keep copy rules narrow to actionable statuses only
