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

## Current implementation status (as of 2026-03-20)
Completed:
- JOT-1 to JOT-10 baseline deliverables
- authentication/session flow (`register`, `login`, `me`, `logout`)
- password reset flow (`forgot-password`, `reset-password`)
- authenticated ownership boundaries on task domain routes
- comments module (API + tests)
- attachments module (API + tests)
- recurrence module (API + tests)
- frontend task details integrations for comments/attachments/recurrence
- AI assistant module (backend route + frontend panel — structured retrieval with optional workspace text search augmentation)
- day affirmation module (API + frontend panel)
- yesterday carry-over action for non-completed tasks (API + frontend action)
- day bilan module (API + frontend panel)
- completion percentage now includes day affirmation completion
- user profile/preferences module (display name + preferred locale + preferred timezone)
- assistant request locale now defaults from user profile preference
- frontend internationalization for core UX (`en`/`fr`) using profile locale with browser fallback
- Google Calendar OAuth connection flow (connect, callback, status, disconnect)
- Google Calendar connection color and selected-calendar management
- Google Calendar multi-account support per Jotly user
- Google Calendar event sync and persisted read model in PostgreSQL
- selected-date Google Calendar event preview in the dashboard
- calendar event notes and calendar event note attachments
- profile modal controls for Google Calendar connection and manual sync
- task due dates and unified alerts for unresolved reminders plus due-date tasks
- gaming track phase 1 (backend summary API + frontend score card with `D/W/M/Y` period selector)
- gaming track phase 2 (weekly missions + personal bests in summary API and dashboard)
- gaming track phase 3 (levels/badges, streak protection, and historical trend views)
- gaming track phase 4 (weekly challenge, personal leaderboard, recap, and nudges)
- gaming track phase 5 (persistent engagement actions: challenge claim, streak protection usage, and nudge dismiss)
- reminders module (API + frontend modal — create, update, delete, complete/cancel, legacy dismiss compatibility, pending poll, attachments)
- standalone notes module (API + frontend dashboard block — create, update, delete, attachments)
- global search (backend `GET /api/search` with full-text via `AssistantSearchDocument` + frontend Cmd/Ctrl+K modal)
- `AssistantSearchDocument` unified search table with PostgreSQL full-text (`tsvector`) indexing across all text-bearing domains
- global search phase 2: pgvector `embedding vector(1536)` column added to `AssistantSearchDocument`; hybrid full-text + vector `searchDirect`; `note` and `noteAttachment` wired into assistant retriever overview domain

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

Latest alerts conventions:
- `GET /api/tasks/alerts?date=YYYY-MM-DD` returns actionable due-date tasks that are overdue, due today, or due tomorrow
- dashboard `Alerts` panel combines `/api/tasks/alerts` results with active reminders loaded through `GET /api/reminders?date=YYYY-MM-DD`
- unresolved items stay visible until the task becomes `done`/`cancelled` or the reminder becomes `completed`/`cancelled`
- alert summary and ordering prioritize `overdue`, then `today`, then `tomorrow`
- reminder entries in the alert panel expose direct `complete` / `cancel` actions

Latest reminders conventions:
- endpoints:
  - `GET /api/reminders` — list all; with `?date=YYYY-MM-DD`, list active reminders (`pending`, `fired`) scheduled before the end of the selected day
  - `GET /api/reminders/pending` — due reminders still in `pending` status (auto-marks as `fired`)
  - `GET /api/reminders/:id`
  - `POST /api/reminders` — create
  - `PUT /api/reminders/:id` — update (partial)
  - `DELETE /api/reminders/:id`
  - `POST /api/reminders/:id/complete`
  - `POST /api/reminders/:id/cancel`
  - `POST /api/reminders/:id/dismiss` — legacy alias for `complete`
  - `GET /api/reminders/:id/attachments`
  - `POST /api/reminders/:id/attachments`
  - `DELETE /api/reminders/:id/attachments/:attachmentId`
- fields: `title`, `description`, `project`, `assignees`, `remindAt` (ISO-8601)
- status lifecycle: `pending`, `fired`, `completed`, `cancelled`
- compatibility flags/timestamps: `isFired`, `firedAt`, `isDismissed`, `dismissedAt`, `completedAt`, `cancelledAt`
- moving a `fired` reminder to a future `remindAt` resets it to `pending`
- reminder attachments follow the current `data:` URL + metadata storage posture with a 5 MB per-file limit
- all reminders scoped to authenticated user

Latest runtime conventions:
- local development should be started with `./scripts/start.sh` and stopped with `./scripts/stop.sh`
- `scripts/start.sh` waits for backend/frontend readiness and prints recent compose logs on startup failure
- production deployment should be driven with `./scripts/deploy.sh <branch>`
- `scripts/deploy.sh` waits for the production health endpoint and prints recent compose logs on failure
- backend containers run `npx prisma migrate deploy` on startup in dev and prod, so no manual migration step is required

Latest notes conventions:
- endpoints:
  - `GET /api/notes` — list all (optional `?date=YYYY-MM-DD` filter)
  - `GET /api/notes/:id`
  - `POST /api/notes`
  - `PATCH /api/notes/:id`
  - `DELETE /api/notes/:id`
  - `GET /api/notes/:id/attachments`
  - `POST /api/notes/:id/attachments`
  - `DELETE /api/notes/:id/attachments/:attachmentId`
  - `PUT /api/google-calendar/events/:id/note`
  - `DELETE /api/google-calendar/events/:id/note`
  - `GET /api/google-calendar/events/:id/note/attachments`
  - `POST /api/google-calendar/events/:id/note/attachments`
  - `DELETE /api/google-calendar/events/:id/note/attachments/:attachmentId`
- standalone note fields: `title` (optional), `body` (required), `color` (optional), `targetDate` (optional)
- standalone note and calendar-event-note attachments follow the current `data:` URL + metadata storage posture with a 5 MB per-file limit
- standalone note mutations trigger fire-and-forget search index refresh

Latest global search conventions:
- endpoint: `GET /api/search?q=...`
- minimum query length: 2 characters
- filterable by: `types` (comma-separated among `task`, `comment`, `affirmation`, `bilan`, `reminder`, `calendarEvent`, `calendarNote`, `attachment`), `from`/`to` date range, `page`, `limit` (max 50)
- source types indexed in `AssistantSearchDocument`: `task`, `comment`, `affirmation`, `bilan`, `reminder`, `calendarEvent`, `calendarNote`, `attachment`, `note`, `noteAttachment`
- current route behavior: queries the existing search index directly; it does not force an index refresh before each request
- consequence: `note` and `noteAttachment` can exist in unfiltered results, but they are not currently accepted values in the public `types` whitelist
- backend uses `AssistantSearchDocument` table with PostgreSQL `websearch_to_tsquery` full-text search
- response includes: `snippet` (ts_headline excerpt), `score`, `matchedBy` (`fulltext`), `totalCount`, `hasMore`
- frontend: Cmd/Ctrl+K shortcut opens global search modal; results navigate to source content

Latest AI assistant conventions:
- endpoint: `POST /api/assistant/reply`
- workspace-first assistant: answers only questions about the authenticated user's Jotly workspace, not external knowledge
- covered structured domains: tasks, comments, affirmations, bilans, reminders, calendar events, calendar notes, profile/preferences
- broad workspace/document questions can be augmented with search-backed text matches from `AssistantSearchDocument` for the currently wired source types: task/comment/attachment, reminder, affirmation/bilan, and calendar event/note
- locale defaults to the user's profile locale when omitted from the request
- provider modes: `heuristic` (default) or `openai`
- automatic fallback to heuristic when OpenAI is unavailable
- current implementation: structured domain retrieval (`analyzeQuery` -> `retrieveByDomain` -> `buildContext`) with a ~4000-char context budget, plus optional workspace text search matches when relevant
- standalone notes and note attachments are indexed for global search, but they are not yet included in the assistant search retriever source-type mapping
- no dedicated gaming-track assistant domain is wired yet
- evolution plan:
  - Phase 2: extend search retriever to use an optional `AssistantSearchDocument.embedding` column with pgvector (`text-embedding-3-small`) for semantic queries on top of the existing local attachment extraction/indexing pipeline.
- see `planning/AGENT.md` AI assistant section for full implementation details

Latest Google Calendar conventions:
- routes are enabled only when all Google OAuth env vars are present:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
  - `GOOGLE_CALENDAR_ENCRYPTION_KEY`
- callback redirects use `FRONTEND_ORIGIN` instead of assuming `http://localhost:3000`
- profile settings can connect, disconnect, and sync multiple Google accounts
- per-connection display color can be updated
- available calendars can be listed per connection and one calendar can be selected
- switching calendars is blocked when linked tasks still depend on the current connection
- tokens are encrypted at rest before being stored in `GoogleCalendarConnection`
- OAuth `state` is a short-lived signed payload bound to the issuing authenticated session
- sync endpoint aggregates all connected accounts for the authenticated user
- first sync imports a rolling window of the previous 30 days and next 90 days
- later syncs use Google sync tokens and fall back to a full sync when needed
- dashboard reads synced events by selected date from local PostgreSQL data
- dashboard supports internal event notes, event note attachments, and linked-task previews
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
