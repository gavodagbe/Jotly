---

# `planning/PLAN.md`

```md
# Jotly — Sprint 1 Plan

## Objective
Deliver the first usable MVP foundation of Jotly:
- runnable local stack
- PostgreSQL-backed task persistence
- date-driven Kanban board
- core task management flows

## Phase 1 — Foundation
- JOT-1 — Initialize monorepo structure
- JOT-2 — Setup frontend Next.js app
- JOT-3 — Setup backend Fastify app
- JOT-4 — Setup PostgreSQL + Docker Compose

Success criteria:
- repo structure is clean
- frontend starts
- backend starts
- Docker Compose works
- PostgreSQL is reachable

## Phase 2 — Data and API
- JOT-5 — Create database schema for tasks
- JOT-6 — Implement task CRUD API

Success criteria:
- Prisma schema exists
- migration works
- seed works
- task CRUD endpoints work
- fetch by date works
- validation and structured errors are in place

## Phase 3 — Product UI
- JOT-7 — Build Kanban board UI for selected date
- JOT-8 — Implement drag and drop task status changes
- JOT-9 — Implement create/edit/delete task dialogs

Success criteria:
- user can select a date
- tasks render in the correct columns
- status changes persist
- create/edit/delete works
- board remains consistent after refresh

## Phase 4 — Architecture consolidation
- JOT-10 — Prepare future modules in architecture and documentation

Success criteria:
- docs match actual implementation
- future boundaries for comments, attachments, recurrence, AI assistant, and reporting are clear
- no unnecessary implementation was added

## Execution flow per ticket
1. Move Jira ticket to In Progress.
2. Let the agent read the ticket.
3. Create local branch.
4. Implement only ticket scope.
5. Review the result.
6. Commit manually.

## Sprint 1 exit criteria
Sprint 1 is complete when:
- the local stack runs reliably
- task persistence works
- the board is usable by selected date
- create/edit/delete/move flows work
- the repo is clean enough for Sprint 2