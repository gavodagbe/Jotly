# Jotly — Agent Rules

Read sources in this order:
1. current Jira ticket
2. planning/AGENT.md
3. planning/STITCH-REDESIGN.md
4. planning/PLAN.md
5. planning/REVIEW.md

Use Atlassian MCP for Jira and Confluence context when needed.

## Git rules
- Create one local branch per Jira ticket before making changes.
- Branch name should include the Jira key, for example:
  - `feat/JOT-6-task-crud-api`
  - `fix/JOT-8-status-dnd`
  - `chore/JOT-10-doc-alignment`
- Do not rewrite Git history.

### Active redesign branch
- All Stitch-driven redesign work for the current mobile/desktop UX overhaul must happen on `chore/NOJIRA-stitch-redesign-context`.
- Do not use `main` for redesign documentation, Stitch handoff prompts, or redesign implementation tied to this active design track.
- If an agent starts on another branch while continuing this redesign track, switch to `chore/NOJIRA-stitch-redesign-context` before making changes.
- Treat `main` as the stable baseline until the user explicitly decides to merge or publish redesign work.

### Tickets sensibles (par défaut)
- Do not commit.
- Do not push.
- Do not open a pull request.

### Tickets non-sensibles (explicitement demandé par l'utilisateur)
- Commit autorisé une fois que l'utilisateur valide les changements.
- Push autorisé une fois que l'utilisateur demande explicitement le push.
- Création de PR autorisée une fois que l'utilisateur demande explicitement la PR.
- Le mécanisme d'automatisation éventuel doit rester agnostique au LLM : hook repo-local, script versionné, ou workflow CI utilisable depuis Claude, Gemini, Codex, ou en manuel.

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
