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

## Current implementation snapshot
This section reflects the current repository implementation.

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- dnd-kit for Kanban drag and drop
- Feature surface currently centered in `frontend/src/components/layout/app-shell.tsx`
- Profile settings include Google Calendar connect/disconnect/sync/color/calendar-selection controls
- Daily dashboard can display synced Google Calendar events for the selected date
- Dashboard includes a unified alerts panel, reminders, notes, gaming track, and global search

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
- Profile endpoints in `backend/src/routes/profile.ts`
- AI assistant endpoint in `backend/src/routes/assistant.ts`
- Notes endpoints in `backend/src/routes/notes.ts`
- Reminder endpoints in `backend/src/routes/reminders.ts`
- Gaming Track endpoints in `backend/src/routes/gaming-track.ts`
- Google Calendar OAuth routes in `backend/src/routes/google-calendar-oauth.ts`
- Google Calendar sync/read routes in `backend/src/routes/google-calendar-events.ts`
- Search endpoint in `backend/src/routes/search.ts`
- Google OAuth client factory in `backend/src/google-auth/`
- Google Calendar services and stores in `backend/src/google-calendar/`

### Database
- PostgreSQL
- Prisma `Task` model with status, priority, `dueDate`, lifecycle timestamps, carry-over linkage, recurrence-instance linkage, and optional calendar-event linkage
- Prisma `DayAffirmation` and `DayBilan` models (one row per user per date)
- Prisma gaming-track action models for challenge claims, streak protection usage, and nudge dismissals
- Prisma `GoogleCalendarConnection` for encrypted OAuth token storage and per-account sync metadata
- Prisma `CalendarEvent` for synced Google events
- Prisma `CalendarEventNote` and `CalendarEventNoteAttachment` for internal event-note workflows
- Prisma `Reminder` and `ReminderAttachment` models for timed reminders, persistent reminder status lifecycle, compatibility fire/dismiss flags, and reminder files
- Prisma `Note` and `NoteAttachment` models for standalone notes
- Prisma `PasswordResetToken` model for password reset flow
- Prisma `AssistantSearchDocument` model — unified full-text search table (`tsvector` via PostgreSQL full-text); the store also supports an optional future `embedding` column for Phase 2 semantic search

### Testing
- Node test runner tests for auth/tasks/comments/attachments/recurrence/assistant/day-affirmation/day-bilan routes
- Node test runner tests include profile route coverage
- Node test runner tests include Google Calendar OAuth and Google Calendar event route coverage
- Node test runner tests include gaming-track route coverage
- Node test runner tests include reminders route coverage
- Node test runner tests include search route coverage

### Infrastructure
- Docker
- Docker Compose
- operational entrypoints in `scripts/start.sh`, `scripts/stop.sh`, and `scripts/deploy.sh`

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
- `dueDate` (optional)
- `priority`
- `project` (optional)
- `plannedTime` (optional)
- `recurrenceSourceTaskId` (optional)
- `recurrenceOccurrenceDate` (optional)
- `calendarEventId` (optional, for calendar-linked tasks)
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
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/tasks?date=YYYY-MM-DD`
- `GET /api/tasks/alerts?date=YYYY-MM-DD`
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
- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/notes?date=YYYY-MM-DD`
- `GET /api/notes/:id`
- `POST /api/notes`
- `PATCH /api/notes/:id`
- `DELETE /api/notes/:id`
- `GET /api/notes/:id/attachments`
- `POST /api/notes/:id/attachments`
- `DELETE /api/notes/:id/attachments/:attachmentId`
- `POST /api/assistant/reply`
- `GET /api/google-calendar/auth-url`
- `GET /api/google-calendar/callback?code=...&state=...`
- `GET /api/google-calendar/status`
- `DELETE /api/google-calendar/connection/:connectionId`
- `PATCH /api/google-calendar/connection/:connectionId/color`
- `GET /api/google-calendar/connection/:connectionId/calendars`
- `PATCH /api/google-calendar/connection/:connectionId/calendar`
- `POST /api/google-calendar/sync`
- `GET /api/google-calendar/events?date=YYYY-MM-DD`
- `GET /api/google-calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/google-calendar/events/:id`
- `PUT /api/google-calendar/events/:id/note`
- `DELETE /api/google-calendar/events/:id/note`
- `GET /api/google-calendar/events/:id/note/attachments`
- `POST /api/google-calendar/events/:id/note/attachments`
- `DELETE /api/google-calendar/events/:id/note/attachments/:attachmentId`
- `GET /api/reminders`
- `GET /api/reminders/pending`
- `GET /api/reminders/:id`
- `POST /api/reminders`
- `PUT /api/reminders/:id`
- `DELETE /api/reminders/:id`
- `POST /api/reminders/:id/complete`
- `POST /api/reminders/:id/cancel`
- `POST /api/reminders/:id/dismiss`
- `GET /api/reminders/:id/attachments`
- `POST /api/reminders/:id/attachments`
- `DELETE /api/reminders/:id/attachments/:attachmentId`
- `GET /api/gaming-track/summary?date=YYYY-MM-DD&period=day|week|month|year`
- `POST /api/gaming-track/challenge/claim`
- `POST /api/gaming-track/streak-protection/use`
- `POST /api/gaming-track/nudges/dismiss`
- `GET /api/search?q=...`

Rules:
- JSON-only API
- validate writes with Zod
- return structured errors
- keep route handlers explicit and simple
- Google Calendar routes are registered only when Google OAuth env vars are configured
- Google Calendar callback redirects should use `FRONTEND_ORIGIN`, not a hard-coded frontend URL
- task payloads may optionally carry `calendarEventId` when linking a Jotly task to a synced event
- search endpoint requires minimum 2-character query; results scoped to authenticated user
- `GET /api/tasks/alerts?date=YYYY-MM-DD` returns actionable due-date tasks that are overdue, due today, or due tomorrow
- `GET /api/reminders?date=YYYY-MM-DD` returns active reminders (`pending` or `fired`) scheduled before the end of the selected day
- `GET /api/reminders/pending` auto-marks returned reminders as fired; do not call repeatedly in tight loops

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
- alerts panel that combines unresolved reminders and due-date tasks across overdue / today / tomorrow
- day affirmation panel
- carry-over action for yesterday non-completed tasks
- day bilan panel
- AI assistant chatbot (FAB) with structured retrieval and optional workspace text search augmentation
- profile settings dialog with persisted language/timezone preferences
- profile settings dialog with Google Calendar account connection, color, and calendar-selection controls
- selected-date Google Calendar event preview on the main dashboard
- reminders panel with create/edit/complete/cancel flows, rich text description, and attachments
- notes panel with standalone note editing and note attachments
- gaming track summary block with engagement actions
- global search modal (Cmd/Ctrl+K) with type filtering, date range, pagination, and result navigation
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
- gaming track phase 6+
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

### Reminders
- Relation to date workflow: user-defined timed reminders with persistent status lifecycle.
- Current backend ownership: `backend/src/routes/reminders.ts`.
- Current API surface:
  - `GET /api/reminders` (optional `?date=YYYY-MM-DD`)
  - `GET /api/reminders/pending`
  - `GET /api/reminders/:id`
  - `POST /api/reminders`
  - `PUT /api/reminders/:id`
  - `DELETE /api/reminders/:id`
  - `POST /api/reminders/:id/complete`
  - `POST /api/reminders/:id/cancel`
  - `POST /api/reminders/:id/dismiss`
  - `GET /api/reminders/:id/attachments`
  - `POST /api/reminders/:id/attachments`
  - `DELETE /api/reminders/:id/attachments/:attachmentId`
- Current fields: `title`, `description`, `project`, `assignees`, `remindAt`, `status`, `isFired`, `firedAt`, `isDismissed`, `dismissedAt`, `completedAt`, `cancelledAt`.
- Current behavior:
  - `GET /api/reminders?date=YYYY-MM-DD` returns only active reminders (`pending`, `fired`) with `remindAt` before the end of the selected day
  - `/pending` auto-marks all returned reminders as fired on read
  - `complete` and `cancel` keep reminders in storage history while removing them from active reminder and alert views
  - moving a `fired` reminder into the future resets it to `pending`
  - reminder attachments use the current `data:` URL + metadata storage posture with a 5 MB per-file limit
  - all reminders scoped to authenticated user
- Current status: implemented.

### Notes
- Relation to workspace history: standalone user-authored notes, separate from task comments and calendar event notes.
- Current backend ownership:
  - `backend/src/routes/notes.ts`
  - `backend/src/notes/`
- Current API surface:
  - `GET /api/notes` (optional `?date=YYYY-MM-DD`)
  - `GET /api/notes/:id`
  - `POST /api/notes`
  - `PATCH /api/notes/:id`
  - `DELETE /api/notes/:id`
  - `GET /api/notes/:id/attachments`
  - `POST /api/notes/:id/attachments`
  - `DELETE /api/notes/:id/attachments/:attachmentId`
- Current behavior:
  - note body is required; `title`, `color`, and `targetDate` are optional
  - note attachments use the current `data:` URL + metadata storage posture with a 5 MB per-file limit
  - note mutations trigger fire-and-forget search index refresh
  - all notes are scoped to the authenticated user
- Current status: implemented.

### Global Search
- Relation to workspace history: single search entry point across all user content domains.
- Current backend ownership: `backend/src/routes/search.ts`.
- Current API surface:
  - `GET /api/search?q=...`
- Query parameters: `q` (required, min 2 chars), `types`, `from`, `to`, `page`, `limit` (max 50).
- Public `types` filter currently accepts: `task`, `comment`, `affirmation`, `bilan`, `reminder`, `calendarEvent`, `calendarNote`, `attachment`.
- Search index documents can also use `note` and `noteAttachment`, but the current public `types` whitelist does not expose those values.
- Backend: queries `AssistantSearchDocument` using PostgreSQL `websearch_to_tsquery` with `ts_headline` snippets; the route does not force a workspace re-sync before each search request.
- Response includes: `results[]` with `sourceType`, `sourceId`, `title`, `snippet`, `score`, `matchedBy`, `metadataJson`, plus `totalCount`, `page`, `limit`, `hasMore`.
- Frontend: Cmd/Ctrl+K opens global search modal; results navigate to source content in the dashboard.
- Current status: implemented (full-text only; vector search planned for assistant Phase 2).

### Google Calendar
- Relation to daily workflow: read-only imported events enrich the selected-day view and future task-linking flows.
- Current backend ownership:
  - `backend/src/google-auth/` for OAuth client creation
  - `backend/src/google-calendar/` for token storage, sync, and event persistence
- Current API surface:
  - `GET /api/google-calendar/auth-url`
  - `GET /api/google-calendar/callback?code=...&state=...`
  - `GET /api/google-calendar/status`
  - `DELETE /api/google-calendar/connection/:connectionId`
  - `PATCH /api/google-calendar/connection/:connectionId/color`
  - `GET /api/google-calendar/connection/:connectionId/calendars`
  - `PATCH /api/google-calendar/connection/:connectionId/calendar`
  - `POST /api/google-calendar/sync`
  - `GET /api/google-calendar/events?date=YYYY-MM-DD`
  - `GET /api/google-calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - `GET /api/google-calendar/events/:id`
  - `PUT /api/google-calendar/events/:id/note`
  - `DELETE /api/google-calendar/events/:id/note`
  - `GET /api/google-calendar/events/:id/note/attachments`
  - `POST /api/google-calendar/events/:id/note/attachments`
  - `DELETE /api/google-calendar/events/:id/note/attachments/:attachmentId`
- Current behavior:
  - supports multiple Google accounts per Jotly user
  - encrypts access and refresh tokens at rest
  - supports per-connection display color and selected calendar management
  - blocks calendar switching when linked tasks still depend on the current connection
  - stores synced events in PostgreSQL for date-based querying
  - surfaces selected-date events in the main dashboard
  - users can attach internal Jotly-only notes to synced events
  - users can attach files to calendar event notes
  - tasks can be created from and linked to synced events via `Task.calendarEventId`
- Current limits:
  - no calendar write-back
  - no background/webhook sync yet
- Current status: implemented as a read-only integration foundation.

### AI assistant
- Relation to workspace history: workspace-first assistant over the authenticated user's owned Jotly data. Not a generic chatbot — answers only questions about the user's workspace.
- Current backend ownership: `backend/src/assistant/`.
- Current API surface: `POST /api/assistant/reply`.
- Scope boundary: "all context" means the current authenticated user's Jotly workspace only, not external web knowledge.
- Locale behavior: request payload can include `locale`; backend defaults to user profile locale.
- Covered structured domains: tasks, comments, affirmations, bilans, reminders, calendar events, calendar notes, profile/preferences.

#### Current implementation
- `analyzeQuery` classifies the question into `tasks`, `reminders`, `calendar`, `reflections`, `profile`, or `overview`
- `retrieveByDomain` performs targeted retrieval per domain instead of loading all workspace rows blindly
- `buildContext` enforces a strict context budget (target: ~4000 chars) before model generation
- `assistantSearchRetriever` can augment replies with workspace text matches from `AssistantSearchDocument` when the question calls for broad workspace or document-style retrieval
- response includes `usedDomains`, `retrievalMode`, and `matchedRecordsCount`
- heuristic fallback remains available when OpenAI or workspace text search is unavailable
- search-backed matches currently cover the source types wired in `assistant-search-retriever.ts`: task/comment/attachment, reminder, affirmation/bilan, and calendar event/note records
- standalone `note` and `noteAttachment` documents are indexed for global search, but the assistant search retriever does not query those source types yet
- no dedicated gaming-track assistant domain or retriever is wired yet

#### Remaining evolution
- Phase 2: add optional pgvector-powered semantic retrieval when an `embedding` column is present on `AssistantSearchDocument`
- Phase 2: build semantic retrieval on top of the existing local attachment extraction/indexing pipeline
- preserve userId isolation, context-budget enforcement, and heuristic fallback across those additions

#### Explicitly out of scope
- External extraction services (all extraction is local backend)
- External web knowledge or internet search
- LLM-based intent classification (double API call cost not justified)
- Gaming-track search/index integration until a dedicated assistant retrieval strategy is designed
- Handwriting recognition (Tesseract.js covers printed/typed text only)

### Profile and preferences
- Relation to task history: cross-cutting user preferences for locale/timezone and display identity.
- Current backend ownership: `backend/src/profile/`.
- Current API surface:
  - `GET /api/profile`
  - `PATCH /api/profile`
- Storage fields (on `User`):
  - `preferredLocale` (currently `en` or `fr`)
  - `preferredTimeZone` (IANA timezone)
- Current behavior:
  - stores and serves profile-level identity/localization preferences
  - powers frontend localization and timezone rendering
- Current status: implemented.

### Reporting
- Likely reporting dimensions: completion by date, status distribution, throughput trends, cancellation rate.
- Likely backend ownership: `backend/src/reporting/`.
- Data dependencies: task lifecycle fields (`status`, `targetDate`, `completedAt`, `cancelledAt`) plus future recurrence/comment/attachment signals.
- Likely frontend entry points: analytics dashboards under `frontend/src/features/reporting/`.
- Sprint 1 status: postponed.

### Gaming Track
- Relation to retention: converts user activity into progress loops and consistency feedback.
- Core period views: day / week / month / year.
- Implemented in Phase 1-5:
  - backend summary endpoint: `GET /api/gaming-track/summary?date=YYYY-MM-DD&period=day|week|month|year`
  - action endpoints:
    - `POST /api/gaming-track/challenge/claim`
    - `POST /api/gaming-track/streak-protection/use`
    - `POST /api/gaming-track/nudges/dismiss`
  - top-of-dashboard score card with period switch
  - task/affirmation/bilan completion metrics + streaks + trend deltas
  - weekly missions
  - personal bests
  - level progression (`xp`, `level`, `rank`, progress to next level)
  - badge progression (`badges`)
  - streak protection signals (`streakProtection`)
  - historical trend views (`historicalTrends.daily|weekly|monthly`)
  - dynamic weekly challenge (`engagement.challenge`)
  - personal weekly leaderboard (`engagement.leaderboard`)
  - weekly recap and nudges (`engagement.recap`, `engagement.nudges`)
  - persisted engagement actions:
    - challenge reward claiming state (`engagement.challenge.claimed`, `claimedAt`)
    - streak protection usage consumption (`streakProtection.usedCharges`)
    - per-day nudge dismissals (filtered from `engagement.nudges`)
- Next dimensions:
  - task achievement (completion rate, throughput, carry-over trend)
  - day affirmation completion rate
  - day bilan completion rate
  - deeper streak and consistency indicators
  - social and collaborative engagement loops
- Current scoring model:
  - execution score (tasks)
  - reflection score (affirmation + bilan)
  - consistency score (habit continuity)
  - momentum score (aggregate trend)
- Likely backend ownership: `backend/src/gaming-track/` with aggregation queries over tasks, affirmations, and bilans.
- Likely frontend entry points:
  - top-of-dashboard score card and trend chips
  - dedicated stats screen under `frontend/src/features/gaming-track/`
- Status: Phase 1-5 implemented; phase 6+ deeper engagement layer remains planned.

## Known entities and extension points
Existing entities:
- `Task`
- `TaskComment`
- `TaskAttachment`
- `TaskRecurrenceRule`
- `DayAffirmation`
- `DayBilan`
- `Reminder`
- `ReminderAttachment`
- `Note`
- `NoteAttachment`
- `GoogleCalendarConnection`
- `CalendarEvent`
- `CalendarEventNote`
- `CalendarEventNoteAttachment`
- `GamingTrackChallengeClaim`
- `GamingTrackStreakProtectionUsage`
- `GamingTrackNudgeDismissal`
- `AssistantSearchDocument` (unified full-text search table with `tsvector`; optional future semantic-search support can use an `embedding` column when added)
- `PasswordResetToken`

Planned extensions (Phase 2 — assistant pipeline):
- Enable pgvector extension and populate `AssistantSearchDocument.embedding` column for semantic search

Potential future entities:
- `TaskActivityEvent` (optional, if reporting granularity requires event-level history)
- `UserDailyMetricSnapshot` (optional, if pre-aggregated gaming-track read models are required)

Current extension points to preserve:
- task route module boundaries in `backend/src/routes/`
- store/service boundaries in `backend/src/tasks/`, `backend/src/day-affirmation/`, `backend/src/day-bilan/`, `backend/src/assistant/`, and `backend/src/gaming-track/`
- optional `Task.calendarEventId` for task/event linking
- `CalendarEventNote` and `CalendarEventNoteAttachment` for internal event annotations without overloading task comments
- `AssistantSearchDocument` as the canonical search index — all new text-bearing domains must write to it on create/update/delete
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
