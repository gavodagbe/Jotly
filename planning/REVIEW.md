# Jotly - Architecture Decisions and Risks

## Current implementation reality check (as of 2026-03-20)
Implemented in the current codebase:
- backend task CRUD API with date filtering (`backend/src/routes/tasks.ts`)
- backend task due-date alerts API that keeps overdue actionable tasks visible until resolved (`backend/src/routes/tasks.ts`)
- backend auth/session API with password reset flow (`backend/src/routes/auth.ts`)
- authenticated ownership boundaries on task-linked routes (tasks/comments/attachments/recurrence)
- backend AI assistant reply API with structured retrieval + optional workspace text search augmentation (`backend/src/routes/assistant.ts`)
- backend comments API (`backend/src/routes/comments.ts`)
- backend attachments API (`backend/src/routes/attachments.ts`)
- backend recurrence API (`backend/src/routes/recurrence.ts`)
- backend day affirmation API (`backend/src/routes/day-affirmation.ts`)
- backend day bilan API (`backend/src/routes/day-bilan.ts`)
- backend carry-over endpoint for yesterday non-completed tasks (`backend/src/routes/tasks.ts`)
- backend profile/preferences API (`backend/src/routes/profile.ts`)
- backend reminders API — create, update, delete, complete/cancel, legacy dismiss compatibility, pending poll, and reminder attachments (`backend/src/routes/reminders.ts`)
- backend standalone notes API with note attachments (`backend/src/routes/notes.ts`)
- backend global search API with PostgreSQL full-text search (`backend/src/routes/search.ts`)
- backend Google Calendar OAuth routes (`backend/src/routes/google-calendar-oauth.ts`)
- backend Google Calendar sync/read routes, event notes, and event-note attachments (`backend/src/routes/google-calendar-events.ts`)
- backend Google Calendar token encryption + OAuth exchange service (`backend/src/google-calendar/google-calendar-oauth-service.ts`)
- backend Google Calendar sync service with incremental sync-token support (`backend/src/google-calendar/google-calendar-sync-service.ts`)
- Fastify request body limit configured to 8 MB (`backend/src/app.ts`)
- attachment validation limit of 5 MB per attachment plus URL payload size guard (`backend/src/routes/attachments.ts`)
- Prisma task model with status, priority, due date, lifecycle timestamps, carry-over linkage, recurrence-instance linkage, and calendar-event linkage (`backend/prisma/schema.prisma`)
- Prisma `DayAffirmation` and `DayBilan` models (`backend/prisma/schema.prisma`)
- Prisma `Reminder` and `ReminderAttachment` models with persistent status lifecycle, compatibility fire/dismiss flags, and reminder files (`backend/prisma/schema.prisma`)
- Prisma `Note` and `NoteAttachment` models for standalone notes (`backend/prisma/schema.prisma`)
- Prisma `PasswordResetToken` model (`backend/prisma/schema.prisma`)
- Prisma `GoogleCalendarConnection`, `CalendarEvent`, `CalendarEventNote`, and `CalendarEventNoteAttachment` models plus `Task.calendarEventId` linkage (`backend/prisma/schema.prisma`)
- Prisma `AssistantSearchDocument` model — unified full-text search table (`tsvector`); store-level semantic-search support remains optional for a later `embedding` column (`backend/prisma/schema.prisma`)
- `AssistantSearchDocumentStore` with `searchDirect` (full-text via `websearch_to_tsquery` + `ts_headline` snippets), `fullTextSearch`, and `vectorSearch` methods (`backend/src/assistant/assistant-search-document-store.ts`)
- frontend date-driven Kanban board with create/edit/delete dialogs and drag-and-drop status updates (`frontend/src/components/layout/app-shell.tsx`)
- frontend unified alerts panel for overdue/today/tomorrow unresolved reminders and due-date tasks (`frontend/src/components/layout/app-shell.tsx`)
- frontend task details support for comments, recurrence, and file-based attachments converted to `data:` URLs before upload (`frontend/src/components/layout/app-shell.tsx`)
- frontend day affirmation panel and day bilan panel (`frontend/src/components/layout/app-shell.tsx`)
- frontend carry-over CTA in date controls (`frontend/src/components/layout/app-shell.tsx`)
- daily completion percentage includes day affirmation completion (`frontend/src/components/layout/app-shell.tsx`)
- frontend AI assistant chatbot (FAB) with structured retrieval + optional workspace text search augmentation (`frontend/src/components/layout/app-shell.tsx`)
- frontend reminders panel with create/edit/complete/cancel actions, rich text description, and attachments (`frontend/src/components/layout/app-shell.tsx`)
- frontend standalone notes panel with note attachments (`frontend/src/components/layout/app-shell.tsx`)
- frontend global search modal (Cmd/Ctrl+K) with type filtering, date range, debounced input, pagination, and result navigation (`frontend/src/components/layout/app-shell.tsx`)
- frontend profile/settings modal with language/timezone preferences (`frontend/src/components/layout/app-shell.tsx`)
- frontend Google Calendar connect/disconnect/sync/color/calendar-selection controls in the profile dialog (`frontend/src/components/layout/app-shell.tsx`)
- frontend selected-date Google Calendar event preview in the dashboard (`frontend/src/components/layout/app-shell.tsx`)
- gaming track phase 1 summary card (`frontend/src/components/layout/app-shell.tsx`) backed by `/api/gaming-track/summary`
- gaming track phase 2 updates: weekly missions + personal bests (`frontend/src/components/layout/app-shell.tsx`)
- gaming track phase 3 updates: levels/badges, streak protection, and historical trends (`frontend/src/components/layout/app-shell.tsx`)
- gaming track phase 4 updates: weekly challenge, personal leaderboard, recap, and nudges (`frontend/src/components/layout/app-shell.tsx`)
- gaming track phase 5 updates: persistent engagement actions (challenge claim, streak protection consumption, and nudge dismissal) with summary-state integration
- Docker Compose local runtime (frontend, backend, postgres) driven through `scripts/start.sh` / `scripts/stop.sh`, plus `scripts/deploy.sh` for production rollout
- route tests for auth/tasks/comments/attachments/recurrence/assistant/day-affirmation/day-bilan/profile/gaming-track/reminders/search plus Google Calendar OAuth/events

Not implemented yet:
- assistant pipeline Phase 2 (semantic vector search via pgvector on top of the existing search index)
- reporting
- gaming track phase 6+ (deeper collaborative loops)
- calendar write-back to Google
- background/webhook calendar sync
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

### 10. Assistant pipeline: structured retrieval first, then unified search with full-text + vector
The assistant already uses structured retrieval plus a unified PostgreSQL full-text search table. The remaining Phase 2 work is pgvector-powered semantic retrieval on top of the existing search index and local attachment text extraction.

Reason:
- most Jotly questions are domain-specific and answerable via targeted SQL
- users upload PDFs and images with text — local extraction (`pdf-parse` + `Tesseract.js`) already feeds attachment-backed search entries, while semantic indexing remains the missing step for conceptual retrieval
- full-text handles keyword queries, vector handles conceptual/semantic queries — both are needed
- the current unified table keeps the path open for `tsvector` + optional future `embedding` support without splitting search state across systems
- keeping the heuristic fallback working without OpenAI remains a product requirement

### 10b. Document extraction stays local (no external service)
PDF parsing and image OCR run in the backend Node.js process, not via external APIs.

Reason:
- `pdf-parse` and `Tesseract.js` cover typed/printed text without external dependencies
- avoids per-document API costs and additional vendor coupling
- extraction happens asynchronously after upload — does not block the upload response
- limitation accepted: handwriting recognition is out of scope (Tesseract.js handles printed text only)

### 11. No LLM-based intent classification
The query analyzer uses regex/heuristic patterns, not a separate LLM call.

Reason:
- doubling API calls (one for classification, one for answer) adds latency and cost
- the current regex classifier already works for domain-specific questions
- if heuristic classification fails, the fallback is a global overview, which is acceptable

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
- Current search impact:
  - task attachment uploads trigger a fire-and-forget workspace search sync
  - attachment-backed search entries run local text extraction during sync (plain text/HTML/JSON directly, PDFs via `pdf-parse`, images via `Tesseract.js`)

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

### Reminders
- Relation to date workflow: user-defined timed reminders with persistent status lifecycle, scoped per user.
- Current backend module: `backend/src/routes/reminders.ts`.
- Current API surface:
  - `GET /api/reminders` (optional `?date=YYYY-MM-DD`)
  - `GET /api/reminders/pending` (auto-marks returned reminders as fired)
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
- Current behavior:
  - date-filtered list endpoint returns only active reminders (`pending`, `fired`) with `remindAt` before the end of the selected day
  - `/pending` marks all returned reminders as fired in the same request
  - `complete` and `cancel` preserve history while removing reminders from active reminder/alert views
  - rescheduling a `fired` reminder into the future resets it to `pending`
  - reminder attachments follow the current `data:` URL + metadata storage posture with a 5 MB per-file limit
  - all reminders are scoped to the authenticated user
- Current posture: implemented.

### Notes
- Relation to workspace history: standalone user-authored notes with optional target date, separate from task comments and calendar event notes.
- Current backend module:
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
  - standalone note body is required; `title`, `color`, and `targetDate` are optional
  - note attachments follow the current `data:` URL + metadata storage posture with a 5 MB per-file limit
  - note mutations trigger fire-and-forget search index refresh
  - all notes are scoped to the authenticated user
- Current posture: implemented.

### Global Search
- Relation to workspace history: single search entry point across all user content domains.
- Current backend module: `backend/src/routes/search.ts` backed by `backend/src/assistant/assistant-search-document-store.ts`.
- Current API surface:
  - `GET /api/search?q=...` (min 2 chars; optional `types`, `from`, `to`, `page`, `limit`)
- Current behavior:
  - queries `AssistantSearchDocument` table using PostgreSQL `websearch_to_tsquery`
  - returns ranked results with `ts_headline` snippets, `score`, `matchedBy`
  - `AssistantSearchDocument` can store `task`, `comment`, `affirmation`, `bilan`, `reminder`, `calendarEvent`, `calendarNote`, `attachment`, `note`, and `noteAttachment`
  - the public `types` whitelist currently accepts `task`, `comment`, `affirmation`, `bilan`, `reminder`, `calendarEvent`, `calendarNote`, and `attachment`
  - route reads the existing index directly; it does not trigger a workspace sync before each request
  - filterable by source type and date range; paginated with `hasMore`
  - results are always scoped by userId — no cross-user data exposure
- Current posture: implemented (full-text only; vector search reserved for Phase 2).

### AI assistant
- Relation to workspace history: workspace-first assistant over owned Jotly workspace data, not external knowledge.
- Current backend module: `backend/src/assistant/`.
- Current API surface:
  - `POST /api/assistant/reply`
- Covered structured domains: tasks, comments, affirmations, bilans, reminders, calendar events, calendar notes, profile/preferences.
- Current behavior:
  - supports `heuristic` (default) and `openai` provider modes
  - falls back to heuristic when OpenAI is unavailable
  - request locale defaults from user's profile locale
  - uses targeted domain retrieval and a bounded context build instead of one monolithic full-workspace prompt
  - can augment replies with workspace text matches from `AssistantSearchDocument` when the question calls for broad workspace/document retrieval across the source types currently wired in `assistant-search-retriever.ts`
- Current limits:
  - standalone notes and note attachments are indexed for global search, but are not yet queried by the assistant search retriever
  - no dedicated gaming-track assistant domain or retriever is wired yet
  - semantic vector retrieval is not active yet
- Planned evolution (remaining phase — see `planning/AGENT.md` for full spec):
  - Phase 2: extend search retriever to use `AssistantSearchDocument` vector column via pgvector (`vector(1536)` + `text-embedding-3-small`) on top of the existing local attachment extraction/indexing flow
- Current posture: implemented with structured retrieval + search-backed text augmentation. Phase 2 remains planned.

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
- Current storage posture:
  - encrypted access/refresh tokens per connected Google account
  - per-account sync metadata (`lastSyncToken`, `lastSyncedAt`)
  - normalized local `CalendarEvent` read model for date queries
- Current behavior:
  - multiple Google accounts per user
  - disconnect is scoped to the authenticated owner's connections
  - per-connection display color and selected calendar can be managed from the product
  - switching calendars is blocked when linked tasks still depend on the current connection
  - OAuth callback state is a short-lived signed payload bound to the issuing session
  - full sync window of `-30` days / `+90` days on first sync
  - incremental sync afterward, with full-sync fallback when Google invalidates the sync token
  - callback success/error redirects target `FRONTEND_ORIGIN`
  - dashboard event preview for the selected date
  - users can attach internal Jotly notes to synced events
  - users can attach files to calendar event notes
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
- `Reminder`
- `ReminderAttachment`
- `PasswordResetToken`
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

Planned extensions (Phase 2 — assistant pipeline):
- Enable pgvector extension and populate `AssistantSearchDocument.embedding` for semantic search

Likely future entities:
- `TaskActivityEvent` (if event-level analytics becomes required)

Current extension points to preserve:
- backend route split by domain in `backend/src/routes/`
- optional `Task.calendarEventId` for task/event linking
- `CalendarEventNote` and `CalendarEventNoteAttachment` for internal event annotations without overloading task comments
- `AssistantSearchDocument` as the canonical search index — all new text-bearing domains must write to it on create/update/delete
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

### Risk 7 - Assistant retrieval sprawl
If assistant retrieval keeps broadening without discipline, response quality, latency, and token usage can still degrade as user accounts grow.

Mitigation:
- current structured retrieval enforces a strict context budget (~4000 chars max) before any LLM call
- domain-targeted retrieval replaces full data loading
- heuristic fallback remains functional without OpenAI
- context size is logged for observability

### Risk 7b - Search index and embedding sync drift (Phase 2)
If `AssistantSearchDocument` rows or embeddings become stale or orphaned when source records are updated or deleted, search results will be incorrect.

Mitigation:
- sync hooks on create/update/delete of all indexed source types (including attachments)
- backfill script for initial migration
- periodic reconciliation check (compare source record counts vs search document counts)
- search documents always scoped by userId — orphaned rows cannot leak across accounts
- embedding regeneration triggered on source text change

### Risk 7c - Prompt injection via user content
User-authored comments, notes, affirmations, bilans, and extracted document text are included in LLM prompts. Malicious or accidental prompt injection could alter assistant behavior.

Mitigation:
- sanitize user content before inclusion in prompts (strip control characters, limit length)
- system prompt instructs the model to treat context as data, not as instructions
- context budget limits the surface area of injected content
- extracted document text is treated with the same sanitization as user-authored text

### Risk 7d - Document extraction quality and performance (Phase 2)
OCR via Tesseract.js may produce low-quality text from poor images. PDF parsing may fail on scanned-only PDFs. Extraction can be CPU-intensive.

Mitigation:
- extraction runs asynchronously after upload — does not block the upload response
- extraction failures are logged but do not break the upload flow (document is stored, just not searchable)
- handwriting and scanned-only PDFs are documented as out of scope for Tesseract.js
- extracted text is stored in `bodyText` — can be re-extracted if extraction logic improves later

### Risk 8 - Carry-over duplication and workflow noise
Repeated carry-over actions can create duplicated task rows without a clear dedupe strategy.

Mitigation:
- enforce uniqueness by source-task/date pair
- keep carry-over response explicit (`copiedCount`, `skippedCount`)
- keep copy rules narrow to actionable statuses only

### Risk 9 - Incentive distortion from gamification
If gaming-track scores optimize for quantity over quality, users may game metrics and reduce meaningful progress.

Mitigation:
- weight scores by priority and completion quality, not raw volume only
- include reflection consistency (affirmation + bilan) in composite scoring
- monitor anomalies and recalibrate scoring rules via explicit product iterations
