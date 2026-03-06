# Jotly - Architecture Decisions and Risks

## Current implementation reality check
Implemented in the current codebase:
- backend task CRUD API with date filtering (`backend/src/routes/tasks.ts`)
- Prisma task model with status and lifecycle timestamps (`backend/prisma/schema.prisma`)
- frontend date-driven Kanban board with create/edit/delete dialogs and drag-and-drop status updates (`frontend/src/components/layout/app-shell.tsx`)
- Docker Compose local runtime (frontend, backend, postgres)

Not implemented yet:
- comments
- attachments
- recurrence
- AI assistant
- reporting

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
- relational consistency for future modules
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

### 7. Jira + Confluence MCP only
Use Atlassian MCP for ticket and context access.
Do not use GitHub MCP.

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

## Future module boundary map
The boundaries below are for preparation only; no feature implementation is part of Sprint 1.

### Comments
- Relation to tasks: comments are children of tasks.
- Likely backend module: `backend/src/comments/`.
- Likely frontend feature area: `frontend/src/features/comments/`.
- Likely API surface:
  - `GET /api/tasks/:id/comments`
  - `POST /api/tasks/:id/comments`
  - `PATCH /api/tasks/:id/comments/:commentId`
  - `DELETE /api/tasks/:id/comments/:commentId`
- Sprint 1 posture: postponed.

### Attachments
- Relation to tasks: attachments are task-linked assets.
- Ownership split: metadata in PostgreSQL, binary storage via dedicated storage integration later.
- Likely backend module: `backend/src/attachments/`.
- Likely frontend feature area: `frontend/src/features/attachments/`.
- Likely API surface:
  - `GET /api/tasks/:id/attachments`
  - `POST /api/tasks/:id/attachments`
  - `DELETE /api/tasks/:id/attachments/:attachmentId`
- Sprint 1 posture: postponed.

### Recurrence
- Relation to tasks: recurrence rules generate date-specific task instances.
- Likely backend module: `backend/src/recurrence/`.
- Likely frontend feature area: `frontend/src/features/recurrence/`.
- Likely approach: keep concrete tasks explicit and persist recurrence metadata separately.
- Sprint 1 posture: postponed.

### AI assistant
- Relation to task history: read-oriented assistant over task history and future contextual modules.
- Likely backend module: `backend/src/assistant/`.
- Likely frontend feature area: `frontend/src/features/assistant/`.
- Expected dependencies: task records first, then comments/attachments signals when available.
- Sprint 1 posture: postponed.

### Reporting
- Relation to task history: aggregated analytics over task lifecycle and date dimensions.
- Likely backend module: `backend/src/reporting/`.
- Likely frontend feature area: `frontend/src/features/reporting/`.
- Expected dependencies: task status/date/timestamps first, then recurrence/comments/attachments data when added.
- Sprint 1 posture: postponed.

## Future entities and extension points
Likely future entities (documentation only):
- `TaskComment`
- `TaskAttachment`
- `TaskRecurrenceRule`
- `TaskActivityEvent` (only if event-level reporting is needed later)

Current extension points to preserve:
- backend route split by domain in `backend/src/routes/`
- backend task domain module in `backend/src/tasks/`
- frontend feature folders in `frontend/src/features/`
- stable task API contract for frontend/backend integration

## Sprint 1 postponed areas
These are intentionally not fully implemented in Sprint 1:
- comments
- attachments
- recurrence
- AI assistant
- reporting
- auth
- multi-user
- notifications
- mobile
- real-time sync
- offline-first

## Main risks

### Risk 1 - Scope creep
Sprint 1 could become too broad.

Mitigation:
- respect Jira ticket boundaries strictly

### Risk 2 - Over-engineering
Future modules could create premature abstractions.

Mitigation:
- document boundaries without overbuilding

### Risk 3 - Frontend/backend drift
Contracts may diverge as features evolve.

Mitigation:
- keep API explicit and stable
- update both sides carefully

### Risk 4 - Docs drift
Planning files may stop matching the repo.

Mitigation:
- update docs only when architecture, scope, or technical conventions truly change

### Risk 5 - Reporting blind spots
Later analytics work can be blocked if lifecycle timestamps and status semantics change unexpectedly.

Mitigation:
- keep current task lifecycle fields stable unless a dedicated migration ticket updates docs and API together
