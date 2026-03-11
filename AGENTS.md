# Jotly — Agent Rules

Read sources in this order:
1. current Jira ticket
2. planning/AGENT.md
3. planning/PLAN.md
4. planning/REVIEW.md

Use Atlassian MCP for Jira and Confluence context when needed.

## Git rules
- Create one local branch per Jira ticket before making changes.
- Branch name should include the Jira key, for example:
  - `feat/JOT-6-task-crud-api`
  - `fix/JOT-8-status-dnd`
  - `chore/JOT-10-doc-alignment`
- Do not commit.
- Do not push.
- Do not open a pull request.
- Do not rewrite Git history.

## Execution rules
- Work ticket by ticket.
- Implement only the current ticket scope.
- Respect out-of-scope boundaries.
- Keep changes minimal, clean, and testable.
- Do not refactor unrelated code.
- Update documentation only if the ticket changes architecture, scope, or technical conventions.

## End-of-task output
Always end with:
- branch name
- main files changed
- what was implemented
- tests added or updated
- anything to verify before manual commit