# Jotly - Sprint Plan and Status

## Objective
Deliver a stable MVP foundation for a date-driven task dashboard:
- runnable local stack
- PostgreSQL-backed persistence
- Kanban workflow by selected date
- secure task operations per authenticated user

## Sprint 1 baseline plan (historical)
### Phase 1 - Foundation
- JOT-1 - Initialize monorepo structure
- JOT-2 - Setup frontend Next.js app
- JOT-3 - Setup backend Fastify app
- JOT-4 - Setup PostgreSQL + Docker Compose

### Phase 2 - Data and API
- JOT-5 - Create database schema for tasks
- JOT-6 - Implement task CRUD API

### Phase 3 - Product UI
- JOT-7 - Build Kanban board UI for selected date
- JOT-8 - Implement drag and drop task status changes
- JOT-9 - Implement create/edit/delete task dialogs

### Phase 4 - Architecture consolidation
- JOT-10 - Align architecture and planning documentation

Historical JOT-10 out-of-scope (ticket-level):
- implementing comments/attachments/recurrence/AI/reporting
- adding full schema for future modules
- broad refactors unrelated to documentation clarity

## Current implementation status (as of 2026-03-17)
Completed:
- JOT-1 to JOT-10 baseline deliverables
- authentication/session flow (`register`, `login`, `me`, `logout`)
- password reset flow (`forgot-password`, `reset-password`)
- authenticated ownership boundaries on task domain routes
- comments module (API + tests)
- attachments module (API + tests)
- recurrence module (API + tests)
- frontend task details integrations for comments/attachments/recurrence
- AI assistant module (backend route + frontend panel — full DB context, evolving to structured retrieval + RAG)
- day affirmation module (API + frontend panel)
- yesterday carry-over action for non-completed tasks (API + frontend action)
- day bilan module (API + frontend panel)
- completion percentage now includes day affirmation completion
- user profile/preferences module (display name + preferred locale + preferred timezone)
- assistant request locale now defaults from user profile preference
- frontend internationalization for core UX (`en`/`fr`) using profile locale with browser fallback
- Google Calendar OAuth connection flow (connect, callback, status, disconnect)
- Google Calendar multi-account support per Jotly user
- Google Calendar event sync and persisted read model in PostgreSQL
- selected-date Google Calendar event preview in the dashboard
- profile modal controls for Google Calendar connection and manual sync
- gaming track phase 1 (backend summary API + frontend score card with `D/W/M/Y` period selector)
- gaming track phase 2 (weekly missions + personal bests in summary API and dashboard)
- gaming track phase 3 (levels/badges, streak protection, and historical trend views)
- gaming track phase 4 (weekly challenge, personal leaderboard, recap, and nudges)
- gaming track phase 5 (persistent engagement actions: challenge claim, streak protection usage, and nudge dismiss)
- reminders module (API + frontend modal — create, update, delete, dismiss, pending poll)
- global search (backend `GET /api/search` with full-text via `AssistantSearchDocument` + frontend Cmd/Ctrl+K modal)
- `AssistantSearchDocument` unified search table with PostgreSQL full-text (`tsvector`) indexing across all text-bearing domains

Latest attachment handling conventions:
- frontend uploads local files from the task details modal
- payload sent as `data:` URL + `contentType` + `sizeBytes`
- backend enforces max attachment size of 5 MB per item
- backend app body limit set to 8 MB for upload payloads

Latest daily workflow conventions:
- day affirmation endpoints:
  - `GET /api/day-affirmation?date=YYYY-MM-DD`
  - `PUT /api/day-affirmation`
- carry-over endpoint:
  - `POST /api/tasks/carry-over-yesterday`
  - copies only yesterday `todo` and `in_progress` tasks
  - skips recurrence instances and duplicate carry-over rows
- day bilan endpoints:
  - `GET /api/day-bilan?date=YYYY-MM-DD`
  - `PUT /api/day-bilan`

Latest reminders conventions:
- endpoints:
  - `GET /api/reminders` — list all (optional `?date=YYYY-MM-DD` filter, 24h window)
  - `GET /api/reminders/pending` — unfired reminders (auto-marks as fired)
  - `GET /api/reminders/:id`
  - `POST /api/reminders` — create
  - `PUT /api/reminders/:id` — update (partial)
  - `DELETE /api/reminders/:id`
  - `POST /api/reminders/:id/dismiss`
- fields: `title`, `description`, `project`, `assignees`, `remindAt` (ISO-8601)
- lifecycle flags: `isFired` (auto), `isDismissed` (manual)
- all reminders scoped to authenticated user

Latest global search conventions:
- endpoint: `GET /api/search?q=...`
- minimum query length: 2 characters
- filterable by: `types` (comma-separated), `from`/`to` date range, `page`, `limit` (max 50)
- source types indexed: `task`, `comment`, `affirmation`, `bilan`, `reminder`, `calendarEvent`, `calendarNote`, `attachment`
- backend uses `AssistantSearchDocument` table with PostgreSQL `websearch_to_tsquery` full-text search
- response includes: `snippet` (ts_headline excerpt), `score`, `matchedBy` (`fulltext` or `vector`), `totalCount`, `hasMore`
- frontend: Cmd/Ctrl+K shortcut opens global search modal; results navigate to source content

Latest AI assistant conventions:
- endpoint: `POST /api/assistant/reply`
- workspace-first assistant: answers only questions about the authenticated user's Jotly workspace, not external knowledge
- covered domains: tasks, comments, affirmations, bilans, reminders, calendar events, calendar notes, profile/preferences, gaming track
- locale defaults to the user's profile locale when omitted from the request
- provider modes: `heuristic` (default) or `openai`
- automatic fallback to heuristic when OpenAI is unavailable
- current implementation: full DB context (all user data loaded per request — pre-pipeline)
- evolution plan (2 phases):
  - Phase 1: refactor into pipeline (analyzeQuery -> retrieveByDomain -> buildContext with ~4000 char budget -> generateAnswer). No new table, no LLM classifier. Domain-targeted SQL replaces full context dump.
  - Phase 2: extend search retriever to use `AssistantSearchDocument` vector column with `pgvector` (`text-embedding-3-small`) for semantic queries. Document extraction pipeline: PDF parsing (`pdf-parse`) + image OCR (`Tesseract.js`), both local backend.
- see `planning/AGENT.md` AI assistant section for full implementation details

Latest Google Calendar conventions:
- routes are enabled only when all Google OAuth env vars are present:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
  - `GOOGLE_CALENDAR_ENCRYPTION_KEY`
- callback redirects use `FRONTEND_ORIGIN` instead of assuming `http://localhost:3000`
- profile settings can connect, disconnect, and sync multiple Google accounts
- tokens are encrypted at rest before being stored in `GoogleCalendarConnection`
- OAuth `state` is a short-lived signed payload bound to the issuing authenticated session
- sync endpoint aggregates all connected accounts for the authenticated user
- first sync imports a rolling window of the previous 30 days and next 90 days
- later syncs use Google sync tokens and fall back to a full sync when needed
- dashboard reads synced events by selected date from local PostgreSQL data
- dashboard supports internal event notes and linked-task previews
- task forms can link/unlink a task to a synced calendar event
- current Google-side slice is still read-only:
  - no calendar write-back
  - no webhook/background sync yet

Gaming Track status:
- Phase 1-5 implemented:
  - `GET /api/gaming-track/summary?date=YYYY-MM-DD&period=day|week|month|year`
  - `POST /api/gaming-track/challenge/claim`
  - `POST /api/gaming-track/streak-protection/use`
  - `POST /api/gaming-track/nudges/dismiss`
  - tasks + affirmation + bilan completion analytics
  - streak and scoring outputs (execution, reflection, consistency, momentum, overall)
  - top-of-dashboard score card with period switch
  - weekly missions
  - personal bests
  - level progression (XP, rank, next-level progress)
  - badges progression and unlock states
  - streak protection signals
  - historical trend points (daily, weekly, monthly)
  - dynamic weekly challenge
  - personal weekly leaderboard
  - weekly recap and engagement nudges
  - persisted claim/usage/dismiss states reflected in summary
- Next phases:
  - deeper social loops and collaborative mechanics

Still not implemented:
- assistant pipeline Phase 1 (structured retrieval + context budget — full DB context still in use)
- assistant pipeline Phase 2 (vector search via pgvector + document extraction from PDFs/images)
- reporting
- gaming track phase 6+ collaborative/social engagement layer
- calendar write-back to Google
- background/webhook calendar sync
- notifications
- mobile client
- real-time sync
- offline-first behavior

## Working rules per ticket
1. Move Jira ticket to In Progress.
2. Let the agent read the ticket context.
3. Create a local branch.
4. Implement only ticket scope.
5. Review and test.
6. Commit manually.

## MVP exit criteria status
Sprint 1 exit criteria are met:
- local stack runs reliably
- task persistence works
- board is usable by selected date
- create/edit/delete/move flows work
- repository is ready for Sprint 2 scope
