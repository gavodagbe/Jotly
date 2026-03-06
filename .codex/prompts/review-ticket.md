Review the implementation of the current Jira ticket in the local Jotly repository.

Rules:
- Read `AGENTS.md` first if present.
- Read `planning/AGENT.md`, `planning/PLAN.md`, and `planning/REVIEW.md` if present.
- Use the Atlassian MCP server to read the current Jira ticket, including description and acceptance criteria.
- Review only the scope of the current ticket.
- Do not create a branch.
- Do not commit.
- Do not push.
- Do not open a pull request.
- Do not refactor unrelated code.
- Do not expand the scope.

Your objective is to determine whether the current implementation is aligned with the ticket and ready for manual commit.

Check:
- functional completeness against acceptance criteria
- respect of out-of-scope boundaries
- code clarity and simplicity
- alignment with project architecture
- validation, typing, and error handling where relevant
- tests added or updated where relevant
- accidental regressions or unnecessary changes

If the implementation is not fully ready, identify the smallest possible fixes required.

Return the review in this format:

## Ticket summary
- Key:
- Title:
- Branch:
- Main files changed:

## Acceptance criteria review
- Criterion 1:
- Criterion 2:
- Criterion 3:
- Overall status:

## Findings
### Correct
- ...

### Needs attention
- ...

### Out-of-scope or questionable additions
- ...

## Test review
- Tests present:
- Tests missing:
- Manual checks recommended:

## Final verdict
- Ready for manual commit
or
- Ready after small fixes
or
- Not ready

## Suggested next step
- ...