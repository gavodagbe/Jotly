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

## Current implementation status (as of 2026-03-08)
Completed:
- JOT-1 to JOT-10 baseline deliverables
- authentication/session flow (`register`, `login`, `me`, `logout`)
- authenticated ownership boundaries on task domain routes
- comments module (API + tests)
- attachments module (API + tests)
- recurrence module (API + tests)
- frontend task details integrations for comments/attachments/recurrence
- AI assistant module (backend route + frontend panel)
- day affirmation module (API + frontend panel)
- yesterday carry-over action for non-completed tasks (API + frontend action)
- day bilan module (API + frontend panel)
- completion percentage now includes day affirmation completion
- user profile/preferences module (display name + preferred locale + preferred timezone)
- assistant request locale now defaults from user profile preference
- frontend internationalization for core UX (`en`/`fr`) using profile locale with browser fallback
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
- authenticated scope: all current user tasks/comments across all dates
- provider modes: `heuristic` (default) or `openai`
- automatic fallback to heuristic when OpenAI is unavailable

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
