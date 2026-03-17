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

## Current implementation status (as of 2026-03-11)
Completed:
- JOT-1 to JOT-10 baseline deliverables
- authentication/session flow (`register`, `login`, `me`, `logout`)
- authenticated ownership boundaries on task domain routes
- comments module (API + tests)
- attachments module (API + tests)
- recurrence module (API + tests)
- frontend task details integrations for comments/attachments/recurrence
- AI assistant module (backend route + frontend panel — pre-pipeline, evolving to structured retrieval + RAG)
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

Latest AI assistant conventions:
- endpoint: `POST /api/assistant/reply`
- workspace-first assistant: answers only questions about the authenticated user's Jotly workspace, not external knowledge
- covered domains: tasks, comments, affirmations, bilans, reminders, calendar events, calendar notes, profile/preferences, gaming track
- locale defaults to the user's profile locale when omitted from the request
- provider modes: `heuristic` (default) or `openai`
- automatic fallback to heuristic when OpenAI is unavailable
- evolution plan (2 phases):
  - Phase 1: refactor into pipeline (analyzeQuery -> retrieveByDomain -> buildContext with ~4000 char budget -> generateAnswer). No new table, no LLM classifier. Domain-targeted SQL replaces full context dump.
  - Phase 2: unified `AssistantSearchDocument` table with PostgreSQL full-text (`tsvector`) + vector search (`pgvector` with `text-embedding-3-small`). Includes document extraction pipeline: PDF parsing (`pdf-parse`) + image OCR (`Tesseract.js`), both local backend. Covers attachments, comments, bilans, affirmations, notes, and all text-bearing domains.
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
- assistant pipeline Phase 1 (structured retrieval + context budget)
- assistant pipeline Phase 2 (unified search table + full-text + vector + document extraction)
- reporting
- gaming track phase 6+ collaborative/social engagement layer
- calendar event note workflows
- calendar write-back to Google
- notifications
- mobile client
- real-time sync
- offline-first behavior

## Mobile program and post-mobile delivery rule

Mobile delivery is now an active program under the Jira umbrella ticket `JOT-13`.

Planned mobile rollout sequence:
- backend mobile readiness
- shared domain + API client extraction
- Expo mobile workspace foundation
- auth/session flows
- day view + task flows
- daily workflow modules
- reminders
- profile/preferences
- QA/release foundations
- post-V1 extensions: comments, recurrence, gaming track, calendar read model, assistant

Global product rule after the mobile client is shipped:
- any new end-user feature introduced on the web app must also define and deliver its mobile implementation
- the default expectation is cross-platform parity within the same initiative, not a later catch-up ticket
- a feature may remain web-only only if the ticket explicitly scopes it as web-only or desktop-only and explains why
- backend and shared-contract changes for new product features must be validated against both clients before closure

Implication for future tickets:
- new feature tickets should include both web and mobile scope, or be paired with a linked mobile ticket before implementation starts
- exceptions must be explicit, not implicit
- parity applies to user-facing product functionality, not necessarily to internal tooling or platform-specific release operations

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
