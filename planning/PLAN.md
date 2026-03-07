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

## Current implementation status (as of 2026-03-07)
Completed:
- JOT-1 to JOT-10 baseline deliverables
- authentication/session flow (`register`, `login`, `me`, `logout`)
- authenticated ownership boundaries on task domain routes
- comments module (API + tests)
- attachments module (API + tests)
- recurrence module (API + tests)
- frontend task details integrations for comments/attachments/recurrence
- AI assistant module (backend route + frontend panel)

Latest attachment handling conventions:
- frontend uploads local files from the task details modal
- payload sent as `data:` URL + `contentType` + `sizeBytes`
- backend enforces max attachment size of 5 MB per item
- backend app body limit set to 8 MB for upload payloads

Latest AI assistant conventions:
- endpoint: `POST /api/assistant/reply`
- authenticated scope: all current user tasks/comments across all dates
- provider modes: `heuristic` (default) or `openai`
- automatic fallback to heuristic when OpenAI is unavailable

Still not implemented:
- reporting
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
