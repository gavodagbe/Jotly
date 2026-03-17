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
- Profile settings include Google Calendar connect/disconnect/sync controls
- Daily dashboard can display synced Google Calendar events for the selected date

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
- Google Calendar OAuth routes in `backend/src/routes/google-calendar-oauth.ts`
- Google Calendar sync/read routes in `backend/src/routes/google-calendar-events.ts`
- Google OAuth client factory in `backend/src/google-auth/`
- Google Calendar services and stores in `backend/src/google-calendar/`

### Database
- PostgreSQL
- Prisma `Task` model with status, priority, date, lifecycle timestamps, carry-over linkage, and optional calendar-event linkage
- Prisma `DayAffirmation` and `DayBilan` models (one row per user per date)
- Prisma `GoogleCalendarConnection` for encrypted OAuth token storage and per-account sync metadata
- Prisma `CalendarEvent` for synced Google events
- Prisma `CalendarEventNote` reserved for future event-note workflows
- Prisma `Reminder` model (title, description, project, assignees, remindAt, isFired, isDismissed lifecycle flags)
- Prisma `PasswordResetToken` model for password reset flow
- Prisma `AssistantSearchDocument` model — unified full-text search table (`tsvector` via PostgreSQL full-text; `vector(1536)` column reserved for Phase 2 pgvector semantic search)

### Testing
- Node test runner tests for auth/tasks/comments/attachments/recurrence/assistant/day-affirmation/day-bilan routes
- Node test runner tests include profile route coverage
- Node test runner tests include Google Calendar OAuth route coverage
- Node test runner tests include reminders route coverage
- Node test runner tests include search route coverage

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
- `calendarEventId` (optional, reserved for future calendar-linked tasks)
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
- `POST /api/assistant/reply`
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
- `GET /api/reminders`
- `GET /api/reminders/pending`
- `GET /api/reminders/:id`
- `POST /api/reminders`
- `PUT /api/reminders/:id`
- `DELETE /api/reminders/:id`
- `POST /api/reminders/:id/dismiss`
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
- day affirmation panel
- carry-over action for yesterday non-completed tasks
- day bilan panel
- AI assistant chatbot (FAB) with workspace-first pipeline (evolving from global context dump to structured retrieval + RAG)
- profile settings dialog with persisted language/timezone preferences
- profile settings dialog with Google Calendar account connection controls
- selected-date Google Calendar event preview on the main dashboard
- reminders panel with create/edit/dismiss flows and rich text description
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
- Relation to date workflow: user-defined timed reminders with fire and dismiss lifecycle.
- Current backend ownership: `backend/src/routes/reminders.ts`.
- Current API surface:
  - `GET /api/reminders` (optional `?date=YYYY-MM-DD`)
  - `GET /api/reminders/pending`
  - `GET /api/reminders/:id`
  - `POST /api/reminders`
  - `PUT /api/reminders/:id`
  - `DELETE /api/reminders/:id`
  - `POST /api/reminders/:id/dismiss`
- Current fields: `title`, `description`, `project`, `assignees`, `remindAt`, `isFired`, `firedAt`, `isDismissed`, `dismissedAt`.
- Current behavior:
  - `/pending` auto-marks all returned reminders as fired on read
  - date filter on list endpoint matches a 24-hour UTC window
  - all reminders scoped to authenticated user
- Current status: implemented.

### Global Search
- Relation to workspace history: single search entry point across all user content domains.
- Current backend ownership: `backend/src/routes/search.ts`.
- Current API surface:
  - `GET /api/search?q=...`
- Query parameters: `q` (required, min 2 chars), `types`, `from`, `to`, `page`, `limit` (max 50).
- Source types: `task`, `comment`, `affirmation`, `bilan`, `reminder`, `calendarEvent`, `calendarNote`, `attachment`.
- Backend: queries `AssistantSearchDocument` using PostgreSQL `websearch_to_tsquery` with `ts_headline` snippets.
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
  - `POST /api/google-calendar/sync`
  - `GET /api/google-calendar/events?date=YYYY-MM-DD`
  - `GET /api/google-calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - `GET /api/google-calendar/events/:id`
  - `PUT /api/google-calendar/events/:id/note`
  - `DELETE /api/google-calendar/events/:id/note`
- Current behavior:
  - supports multiple Google accounts per Jotly user
  - encrypts access and refresh tokens at rest
  - stores synced events in PostgreSQL for date-based querying
  - surfaces selected-date events in the main dashboard
  - users can attach internal Jotly-only notes to synced events
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
- Covered domains: tasks, comments, affirmations, bilans, reminders, calendar events, calendar notes, profile/preferences, gaming track.

#### Current implementation (pre-pipeline)
- `assistant-context-store.ts`: loads all user data in one shot (profile, affirmations, bilans, reminders, events, notes)
- `assistant.ts` (route): loads all tasks + all comments, passes everything to `generateReply`
- `assistant-service.ts`: builds a monolithic prompt with all context concatenated, or falls back to heuristic mode via regex-based intent classification
- No context budget — prompt size grows linearly with account size
- Heuristic fallback covers: small talk, tasks, reminders, calendar, reflections, profile, workspace overview

#### Assistant pipeline evolution — 2 phases

**Phase 1 — Structured pipeline + context budget**

Goal: replace the "dump everything" approach with targeted retrieval per domain and a strict context budget.

Pipeline:
```
question -> analyzeQuery -> retrieveByDomain -> buildContext(budget) -> generateAnswer
```

Components:
- `analyzeQuery`: heuristic intent classifier (extend existing regex patterns, no LLM call). Determines which domains to query: tasks, reminders, calendar, reflections, profile, gaming-track, or global overview.
- `retrieveByDomain`: targeted SQL queries per identified domain instead of loading all data. Examples:
  - tasks question -> load only actionable tasks sorted by priority/date, with comments for top N
  - reminder question -> load only active reminders within relevant time window
  - calendar question -> load only upcoming events within relevant window
  - reflection question -> load only recent affirmations and bilans
  - profile question -> load profile only
  - global overview -> load summary counts + top items per domain
- `buildContext(budget)`: assemble retrieved data into a prompt string with a strict character/token budget (target: ~4000 chars max for context block). Prioritize most relevant records, truncate or drop lower-priority items when budget is exceeded.
- `generateAnswer`: call OpenAI with the bounded context, or fall back to heuristic mode.

Response contract evolution:
```json
{
  "data": {
    "answer": "string",
    "source": "openai | heuristic",
    "warning": "string | null",
    "generatedAt": "ISO timestamp",
    "usedDomains": ["tasks", "reminders"],
    "retrievalMode": "structured",
    "matchedRecordsCount": 12
  }
}
```

Key constraints:
- No new database table in Phase 1
- No LLM call for intent classification
- Context budget enforced before any LLM call
- Isolation by userId maintained in all retrievers
- Heuristic fallback preserved without OpenAI

Files to modify:
- `backend/src/assistant/assistant-service.ts` — refactor into pipeline functions
- `backend/src/assistant/assistant-context-store.ts` — replace single `getByUserId` with domain-specific retrieval methods
- `backend/src/routes/assistant.ts` — adapt route to use pipeline and return enriched response

**Phase 2 — Unified search table with full-text + vector + document extraction**

Goal: support free-text questions spanning multiple domains, including content extracted from uploaded documents (PDFs, images with text).

Prerequisite: Phase 1 pipeline is in place and working.

Document extraction pipeline (backend-only, no external service):
```
Document uploaded (PDF/image)
    -> text extraction (pdf-parse for PDFs, Tesseract.js for image OCR)
    -> store extracted text in AssistantSearchDocument
    -> generate embedding via OpenAI text-embedding-3-small
    -> index in AssistantSearchDocument
```

Extraction stack:
- PDF parsing: `pdf-parse` or `pdfjs-dist` (local Node.js)
- Image OCR: `Tesseract.js` (local Node.js, no external API)
- Embeddings: OpenAI `text-embedding-3-small` (already in stack via assistant provider)

New components:
- `AssistantSearchDocument` Prisma model — unified search table:
  - `id`, `userId`, `sourceType` (task, comment, affirmation, bilan, reminder, calendarEvent, calendarNote, attachment), `sourceId`, `title`, `bodyText`, `metadataJson`, `updatedAt`
  - `searchVector` column using PostgreSQL `tsvector` for full-text indexing
  - `embedding` column using `vector(1536)` via pgvector for semantic search
- `AssistantSearchRetriever` — queries using `ts_query` (keyword match) or cosine similarity (semantic match) depending on question type
- `AssistantDocumentExtractor` — extracts text from PDFs (`pdf-parse`) and images (`Tesseract.js`)
- Sync hooks — maintain search document rows when source records are created/updated/deleted
- Backfill script — populate from existing data on first migration

Pipeline after Phase 2:
```
question -> analyzeQuery -> [retrieveByDomain + searchRetriever(fulltext|vector)] -> buildContext(budget) -> generateAnswer
```

Retriever selection logic:
- Question matches a keyword pattern -> full-text search (`ts_query`)
- Question is open-ended or conceptual -> vector search (cosine similarity on embedding)
- Both can be combined: full-text results + vector results merged and deduplicated

Files to add:
- `backend/prisma/migrations/xxx_assistant_search_document.sql`
- `backend/src/assistant/assistant-search-document-store.ts`
- `backend/src/assistant/assistant-search-retriever.ts`
- `backend/src/assistant/assistant-search-sync.ts`
- `backend/src/assistant/assistant-document-extractor.ts`

Files to modify:
- `backend/prisma/schema.prisma` — add `AssistantSearchDocument` model + enable pgvector extension
- `backend/src/assistant/assistant-service.ts` — integrate search retriever into pipeline
- `backend/src/routes/assistant.ts` — `retrievalMode` can be `"structured"`, `"fulltext"`, `"vector"`, or `"structured+fulltext+vector"`
- `backend/src/routes/attachments.ts` — trigger document extraction + indexing on attachment upload

Key constraints:
- pgvector extension must be enabled in PostgreSQL (`CREATE EXTENSION IF NOT EXISTS vector`)
- Extraction happens asynchronously after upload — does not block the upload response
- OCR quality with Tesseract.js is acceptable for typed text, less reliable for handwriting
- Sync hooks must handle create, update, and delete of source records
- Search always scoped by userId
- Budget enforcement from Phase 1 applies to all search results
- Embedding generation requires OpenAI API key (same as assistant provider)

#### Explicitly out of scope
- External extraction services (all extraction is local backend)
- External web knowledge or internet search
- LLM-based intent classification (double API call cost not justified)
- Gaming track data in search index (structured retrieval sufficient for numeric/scoring data)
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
- `GoogleCalendarConnection`
- `CalendarEvent`
- `CalendarEventNote`
- `AssistantSearchDocument` (unified full-text search table with `tsvector`; `vector(1536)` column reserved for Phase 2 pgvector semantic search)
- `PasswordResetToken`

Planned extensions (Phase 2 — assistant pipeline):
- Enable pgvector extension and populate `AssistantSearchDocument.embedding` column for semantic search
- Add document extraction pipeline (PDF via `pdf-parse`, image OCR via `Tesseract.js`) feeding into `AssistantSearchDocument`

Potential future entities:
- `TaskActivityEvent` (optional, if reporting granularity requires event-level history)
- `UserDailyMetricSnapshot` (optional, if pre-aggregated gaming-track read models are required)

Current extension points to preserve:
- task route module boundaries in `backend/src/routes/`
- store/service boundaries in `backend/src/tasks/`, `backend/src/day-affirmation/`, `backend/src/day-bilan/`, `backend/src/assistant/`, and `backend/src/gaming-track/`
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
