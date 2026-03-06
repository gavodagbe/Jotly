# Jotly — Architecture Decisions and Risks

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
- relational consistency for future modules
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

### 7. Jira + Confluence MCP only
Use Atlassian MCP for ticket and context access.
Do not use GitHub MCP.

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

## Sprint 1 postponed areas
These are intentionally not fully implemented in Sprint 1:
- comments
- attachments
- recurrence
- AI assistant
- reporting
- auth
- multi-user
- notifications
- mobile
- real-time sync
- offline-first

## Main risks

### Risk 1 — Scope creep
Sprint 1 could become too broad.

Mitigation:
- respect Jira ticket boundaries strictly

### Risk 2 — Over-engineering
Future modules could create premature abstractions.

Mitigation:
- document boundaries without overbuilding

### Risk 3 — Frontend/backend drift
Contracts may diverge as features evolve.

Mitigation:
- keep API explicit and stable
- update both sides carefully

### Risk 4 — Docs drift
Planning files may stop matching the repo.

Mitigation:
- update docs only when architecture, scope, or technical conventions truly change

## Future module notes
Future modules to prepare but not build yet:
- comments
- attachments
- recurrence
- AI assistant over task history
- reporting

When these modules start, update this file if a meaningful architectural decision changes.