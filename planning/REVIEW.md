# Jotly - Architecture Decisions and Risks

## Current implementation reality check (as of 2026-03-11)
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
- backend profile/preferences API (`backend/src/routes/profile.ts`)
- backend Google Calendar OAuth routes (`backend/src/routes/google-calendar-oauth.ts`)
- backend Google Calendar sync/read routes (`backend/src/routes/google-calendar-events.ts`)
- backend Google Calendar token encryption + OAuth exchange service (`backend/src/google-calendar/google-calendar-oauth-service.ts`)
- backend Google Calendar sync service with incremental sync-token support (`backend/src/google-calendar/google-calendar-sync-service.ts`)
- Fastify request body limit configured to 8 MB (`backend/src/app.ts`)
- attachment validation limit of 5 MB per attachment plus URL payload size guard (`backend/src/routes/attachments.ts`)
- Prisma task model with status, priority, lifecycle timestamps, and carry-over linkage (`backend/prisma/schema.prisma`)
- Prisma `DayAffirmation` and `DayBilan` models (`backend/prisma/schema.prisma`)
- Prisma `GoogleCalendarConnection`, `CalendarEvent`, and `CalendarEventNote` models plus optional `Task.calendarEventId` linkage (`backend/prisma/schema.prisma`)
- frontend date-driven Kanban board with create/edit/delete dialogs and drag-and-drop status updates (`frontend/src/components/layout/app-shell.tsx`)
- frontend task details support for comments, recurrence, and file-based attachments converted to `data:` URLs before upload (`frontend/src/components/layout/app-shell.tsx`)
- frontend day affirmation panel and day bilan panel (`frontend/src/components/layout/app-shell.tsx`)
- frontend carry-over CTA in date controls (`frontend/src/components/layout/app-shell.tsx`)
- daily completion percentage includes day affirmation completion (`frontend/src/components/layout/app-shell.tsx`)
- frontend AI assistant chatbot (FAB) with global user task context (`frontend/src/components/layout/app-shell.tsx`)
- frontend profile/settings modal with language/timezone preferences (`frontend/src/components/layout/app-shell.tsx`)
- frontend Google Calendar connect/disconnect/sync controls in the profile dialog (`frontend/src/components/layout/app-shell.tsx`)
- frontend selected-date Google Calendar event preview in the dashboard (`frontend/src/components/layout/app-shell.tsx`)
- gaming track phase 1 summary card (`frontend/src/components/layout/app-shell.tsx`) backed by `/api/gaming-track/summary`
- gaming track phase 2 updates: weekly missions + personal bests (`frontend/src/components/layout/app-shell.tsx`)
- gaming track phase 3 updates: levels/badges, streak protection, and historical trends (`frontend/src/components/layout/app-shell.tsx`)
- gaming track phase 4 updates: weekly challenge, personal leaderboard, recap, and nudges (`frontend/src/components/layout/app-shell.tsx`)
- gaming track phase 5 updates: persistent engagement actions (challenge claim, streak protection consumption, and nudge dismissal) with summary-state integration
- Docker Compose local runtime (frontend, backend, postgres)
- route tests for auth/tasks/comments/attachments/recurrence/assistant/day-affirmation/day-bilan/profile/gaming-track

Not implemented yet:
- reporting
- gaming track phase 6+ (deeper collaborative loops)
- calendar write-back to Google
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

### 9. Google Calendar stays read-only in the first slice
Google Calendar is currently treated as an imported context layer, not as a source of task mutations.

Reason:
- keeps task business rules owned by the backend task domain
- reduces cross-system coupling while OAuth/sync behavior stabilizes
- allows future task-linking to build on persisted `CalendarEvent` data instead of live Google calls

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

### Profile and preferences
- Relation to task history: global personalization layer for all day views and assistant responses.
- Current backend module: `backend/src/profile/`.
- API surface:
  - `GET /api/profile`
  - `PATCH /api/profile`
- Current storage:
  - `User.preferredLocale`
  - `User.preferredTimeZone`
- UI impact:
  - profile modal from navbar
  - localized date/time rendering using preferred locale/timezone
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

### Google Calendar
- Relation to daily workflow: imported calendar events provide read-only context for the selected day and future task-linking.
- Current backend modules:
  - `backend/src/google-auth/`
  - `backend/src/google-calendar/`
- Current API surface:
  - `GET /api/google-calendar/auth-url`
  - `GET /api/google-calendar/callback?code=...&state=...`
  - `GET /api/google-calendar/status`
  - `DELETE /api/google-calendar/connection/:connectionId`
  - `POST /api/google-calendar/sync`
  - `GET /api/google-calendar/events?date=YYYY-MM-DD`
  - `GET /api/google-calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - `GET /api/google-calendar/events/:id`
  - `PUT /api/google-calendar/events/:id/note`
  - `DELETE /api/google-calendar/events/:id/note`
- Current storage posture:
  - encrypted access/refresh tokens per connected Google account
  - per-account sync metadata (`lastSyncToken`, `lastSyncedAt`)
  - normalized local `CalendarEvent` read model for date queries
- Current behavior:
  - multiple Google accounts per user
  - disconnect is scoped to the authenticated owner's connections
  - OAuth callback state is a short-lived signed payload bound to the issuing session
  - full sync window of `-30` days / `+90` days on first sync
  - incremental sync afterward, with full-sync fallback when Google invalidates the sync token
  - callback success/error redirects target `FRONTEND_ORIGIN`
  - dashboard event preview for the selected date
  - users can attach internal Jotly notes to synced events
  - tasks can be created from and linked to synced events through `Task.calendarEventId`
- Evolution rule:
  - keep Google-side mutations out of scope until explicit write-back rules are designed

### Gaming Track
- Relation to user engagement: transforms daily execution and reflection activity into retention loops.
- Implemented Phase 1-5:
  - metric windows: day, week, month, year (period-to-date)
  - summary endpoint + dashboard card
  - action endpoints:
    - `POST /api/gaming-track/challenge/claim`
    - `POST /api/gaming-track/streak-protection/use`
    - `POST /api/gaming-track/nudges/dismiss`
  - tasks/affirmation/bilan completion metrics
  - streak metrics and trend deltas
  - weekly missions
  - personal bests
  - level progression (XP, rank, progress to next level)
  - badge progression and unlock states
  - streak protection signals
  - historical trends (daily/weekly/monthly points)
  - weekly challenge loop
  - personal leaderboard loop
  - weekly recap and nudge loop
  - persisted engagement actions:
    - challenge reward claim state persisted per week
    - streak protection usages persisted per day
    - dismissed nudges persisted per day
- Metric families (next depth):
  - task achievement metrics (completion rate, throughput, carry-over trend)
  - day affirmation completion metrics
  - day bilan completion metrics
  - advanced streak and consistency metrics
  - social loops and collaborative challenges
- Scoring outputs in Phase 1:
  - execution score
  - reflection score
  - consistency score
  - momentum score
- Likely backend module: `backend/src/gaming-track/`.
- Likely frontend feature area: `frontend/src/features/gaming-track/`.
- Sprint posture: Phase 1-5 implemented; phase 6+ deeper engagement layer remains planned.

## Entities and extension points
Existing entities:
- `Task`
- `TaskComment`
- `TaskAttachment`
- `TaskRecurrenceRule`
- `DayAffirmation`
- `DayBilan`
- `GoogleCalendarConnection`
- `CalendarEvent`
- `CalendarEventNote`

Likely future entities:
- `TaskActivityEvent` (if event-level analytics becomes required)

Current extension points to preserve:
- backend route split by domain in `backend/src/routes/`
- optional `Task.calendarEventId` for future task/event linking
- `CalendarEventNote` for future event annotations without overloading task comments
- backend domain modules in `backend/src/tasks/`, `backend/src/auth/`, `backend/src/recurrence/`, `backend/src/day-affirmation/`, `backend/src/day-bilan/`, `backend/src/assistant/`, and `backend/src/gaming-track/`
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

### Risk 8 - Incentive distortion from gamification
If gaming-track scores optimize for quantity over quality, users may game metrics and reduce meaningful progress.

Mitigation:
- weight scores by priority and completion quality, not raw volume only
- include reflection consistency (affirmation + bilan) in composite scoring
- monitor anomalies and recalibrate scoring rules via explicit product iterations
