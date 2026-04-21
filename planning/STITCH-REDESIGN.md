# Jotly - Stitch Redesign Context

## Purpose
This document is the source of truth for Stitch-driven redesign work in this repository.

Use it to avoid restarting discovery from zero on the next iteration, and update it whenever the active Stitch project, redesign scope, or screen coverage changes.

## Active Stitch context
- Stitch project: `projects/7204916176936281922`
- Project title: `Jotly Productivity Interface System`
- Design system asset: `assets/7b1753dc1a0341f9ad7a326799cd4191`
- Design system name: `Jotly Gamified Pro`
- Mode: `LIGHT`
- Active redesign branch: `chore/NOJIRA-stitch-redesign-context`
- Last confirmed: `2026-04-18`

If the user selects another Stitch project or design system, update this section first.

## Branch policy for this redesign track
- The current Stitch redesign track lives on `chore/NOJIRA-stitch-redesign-context`.
- Use this branch for all redesign documentation, Stitch prompt preparation, and future redesign implementation work tied to this active visual direction.
- Do not continue this redesign track on `main`.
- If a new agent/session resumes this work from another branch, switch to `chore/NOJIRA-stitch-redesign-context` before making changes.

## Collaboration contract with Stitch
When working with Stitch, describe the product problem and functional requirements only.

Do:
- specify the surface or flow to design
- specify the user goal
- specify the data that must be visible
- specify the actions the user must be able to perform
- specify the critical states to cover: loading, empty, error, success, disabled, mobile, desktop
- specify important domain constraints from the codebase

Do not:
- prescribe layout, composition, visual hierarchy, typography, color, spacing, iconography, or motion
- ask for a particular visual style beyond the active Stitch project and design system
- force a component solution when the problem can be described functionally

Working rule:
- if the screen already exists in Stitch, prefer editing or generating variants from that screen
- if the screen does not exist in Stitch, generate it from a functional brief
- work by coherent flow batches, not by random isolated screens

## Reusable prompt frame for Stitch
Use a brief in this shape:

```md
Surface: <screen or overlay name>
Platform: <mobile / desktop / both>
User goal: <what the user needs to achieve>
Must display:
- ...

Must allow:
- ...

Important states:
- loading
- empty
- error
- success
- disabled

Product constraints:
- ...

Leave the visual direction to Stitch and use the active project/design system context.
```

## Current redesign inventory
This inventory reflects the current codebase and the current Stitch project coverage.

### Already present in Stitch
- `Login - Mobile`
- `Daily Dashboard - Mobile`
- `Daily Dashboard - Desktop`
- `Task Central (Kanban) - Mobile`
- `Task Kanban - Desktop`
- `Task Details - Mobile`
- `Notes - Mobile`
- `Gaming & Stats - Mobile`
- `Global Search - Mobile`
- `AI Assistant - Mobile`

### Product surfaces implemented in code
Reference file: `frontend/src/components/layout/app-shell.tsx`

| Product surface | Current shape in code | Code anchor | Stitch coverage | Next action |
| --- | --- | --- | --- | --- |
| Auth | full screen | `AuthPanel` | partial | keep `login`, add `register`, `forgot password`, `reset password`, plus desktop alignment |
| Daily dashboard | page section | `id="overview"` | partial | iterate existing dashboard screens with real Jotly blocks |
| Daily controls + calendar events | page section | `id="dailyControls"` | missing as explicit surface | fold into dashboard redesign or request dedicated section treatment |
| Kanban board | page section | `id="board"` | covered | iterate existing mobile/desktop screens |
| Day affirmation | page section | `id="affirmation"` | missing as explicit surface | integrate into dashboard redesign |
| Reminders | page section | `id="reminders"` | missing | generate dedicated reminder surface or dashboard block treatment |
| Day bilan | page section | `id="bilan"` | missing as explicit surface | integrate into dashboard redesign |
| Weekly objective | page section | `id="weeklyObjective"` | missing | generate new screen or structured section |
| Weekly review | page section | `id="weeklyReview"` | missing | generate new screen or structured section |
| Monthly objective | page section | `id="monthlyObjective"` | missing | generate new screen or structured section |
| Monthly review | page section | `id="monthlyReview"` | missing | generate new screen or structured section |
| Notes | page section + dialog | `id="notes"` | partial | iterate existing mobile notes screen and add desktop/detail/edit coverage |
| Gaming track | page section | `id="gaming"` | partial | iterate existing gaming screen and add desktop coverage if needed |
| Global search | modal | `GlobalSearchModal` | partial | keep mobile, add desktop modal variant |
| Project planning | full-screen workspace | `ProjectPlanningView` | missing | generate new table/gantt planning surface |
| Task details / task form | modal | `taskDialogMode` / `Task Details` | partial | keep mobile, add desktop overlay variant |
| Reminder form | modal | `reminderDialogMode` | missing | generate new overlay/screen |
| Note form | modal | `isNoteDialogOpen` | missing as explicit screen | generate new overlay/screen |
| Profile settings | modal | `isProfileDialogOpen` | missing | generate new settings surface |
| Alerts panel | floating panel | `isTaskAlertsPanelOpen` | missing | generate new alert center/panel |
| AI assistant | floating panel | `isAssistantPanelOpen` | partial | keep mobile, add desktop panel variant |

## Recommended execution order
Work in these lots:

1. Core flow
- Auth
- Daily dashboard
- Kanban
- Task details

2. Daily productivity extensions
- Reminders
- Notes
- Global search
- AI assistant

3. Workspace support surfaces
- Profile settings
- Alerts
- Project planning

4. Periodic reflection surfaces
- Weekly objective
- Weekly review
- Monthly objective
- Monthly review

## Iteration workflow
For each lot:

1. confirm the target surfaces in this document
2. prepare a functional brief for each surface
3. ask Stitch to propose or update the relevant screens without visual steering
4. review coverage against the actual code surface and states
5. update this document with:
- screens created or updated in Stitch
- remaining gaps
- decisions about whether a surface is a full screen, section, or overlay

## Open gaps as of 2026-04-18
- no Stitch coverage yet for reminders
- no Stitch coverage yet for profile settings
- no Stitch coverage yet for alerts
- no Stitch coverage yet for project planning table/gantt
- no Stitch coverage yet for weekly/monthly objective and review surfaces
- desktop variants are still missing for several overlays and utility surfaces

## Verification snapshot as of 2026-04-20
Current Stitch verification against the implemented product surfaces:

Confirmed present in Stitch:
- auth coverage exists on mobile and desktop
- daily dashboard coverage exists on mobile and desktop
- kanban coverage exists on mobile and desktop
- task details exists on mobile
- notes exists on mobile
- gaming track exists on mobile
- global search exists on mobile
- AI assistant exists on mobile

Confirmed still missing as dedicated screens or overlays:
- reminders surface
- weekly objective
- weekly review
- monthly objective
- monthly review
- project planning workspace
- reminder form
- note form
- profile settings
- alerts panel

Still partial:
- task details or task form: no desktop overlay variant confirmed
- notes: no desktop/detail-edit coverage confirmed
- gaming track: no desktop coverage confirmed
- global search: no desktop modal variant confirmed
- AI assistant: no desktop panel variant confirmed

Verification notes:
- multiple duplicate or near-duplicate auth and dashboard variants now exist in Stitch
- dashboard-related blocks such as calendar events, affirmation, reminders, and bilan may already be represented inside operational dashboard proposals, but they are not tracked here as standalone screens unless explicitly separated
- attempted duplicate-cleanup prompt reported success on `2026-04-20`, but a direct `list_screens` verification still showed the targeted duplicate screens present
- practical implication: treat duplicate cleanup as a manual Stitch action until deletion is confirmed by a fresh screen inventory

## Verification snapshot after full-system generation on 2026-04-20
Confirmed present in Stitch after the broader generation pass:
- auth coverage on mobile and desktop
- daily dashboard coverage on mobile and desktop
- kanban coverage on mobile and desktop
- task details on mobile and desktop
- notes on mobile and desktop
- gaming track on mobile and desktop
- global search on mobile and desktop
- reminders on mobile
- reminder form on mobile
- project planning on desktop
- profile settings on desktop
- alerts panel on desktop
- review coverage via `Weekly/Monthly Review - Mobile`

Still missing or still partial after that pass:
- AI assistant desktop variant not confirmed
- reminder form desktop variant not confirmed
- reminders desktop variant not confirmed
- note form not confirmed
- profile settings mobile variant not confirmed
- alerts panel mobile variant not confirmed
- weekly objective dedicated screen not confirmed
- monthly objective dedicated screen not confirmed
- separate weekly review and monthly review coverage not confirmed

Current assessment:
- the generation materially improved screen coverage and is close to implementation-ready
- the remaining gaps are now concentrated in overlays, desktop/mobile companion variants, and periodic reflection surfaces

## Current iteration
### Lot 1 status
- current lot: `Lot 1 - Core flow`
- current surface: `Daily dashboard`
- iteration started: `2026-04-18`
- current execution state: `auth mobile and desktop generated in Stitch; daily dashboard mobile generated; desktop dashboard prompt attempted on 2026-04-20; switch to manual-prompt-only mode requested by user on 2026-04-20`

### Auth surface scope
Code reference: `AuthPanel` in `frontend/src/components/layout/app-shell.tsx`

Implemented auth modes in code:
- `login`
- `register`
- `forgot_password`
- `reset_password`

Current code constraints:
- login and register share one auth entry surface
- forgot password is a distinct mode that asks for email only
- reset password is a distinct mode that asks for reset token and new password
- register includes optional display name
- auth surface supports English and French copy
- desktop uses a split experience with a branding side and a form side
- mobile uses the compact form-first variant without the desktop branding split
- must support loading, inline error, and inline info/success messaging

### Auth brief for Stitch
```md
Surface: Authentication flow
Platform: both
User goal: let a user access Jotly, create an account, request a password reset token, and set a new password.
Must display:
- application identity and product context
- current auth mode title and supporting copy
- email field for login, register, and forgot password
- password field for login, register, and reset password
- reset token field for reset password
- optional display name field for register
- inline info/success message area
- inline error message area
- primary submit action
- mode switch actions between sign in, register, forgot password, and reset password paths

Must allow:
- switch between sign in and register
- open forgot password from sign in
- go back from forgot password or reset password to sign in
- submit each auth mode independently
- handle disabled/loading states during submission

Important states:
- sign in idle
- register idle
- forgot password idle
- reset password idle
- submitting/loading
- inline error
- inline success/info after reset-token generation
- mobile
- desktop

Product constraints:
- do not redesign this as a marketing landing page; it is the product entry surface
- keep the four auth modes explicit and operationally distinct
- the desktop experience can use a supporting brand/context area, but the primary task remains authentication
- the mobile experience should stay compact and task-focused

Leave the visual direction to Stitch and use the active project/design system context.
```

### Auth execution log
Attempted on `2026-04-18`:
- `generate_variants` from existing `Login - Mobile` to cover `register`, `forgot password`, and `reset password`
  - result: rejected by Stitch with `Request contains an invalid argument`
- `generate_screen_from_text` for desktop auth flow
  - result: transport error while sending request to Stitch MCP
- `edit_screens` on existing `Login - Mobile` to expand the operational auth flow
  - result: transport error while sending request to Stitch MCP

Post-check after those attempts:
- `list_screens` did not show any new auth screen in the project
- no reliable evidence yet that Stitch applied any auth update

Next retry strategy:
- do not reuse the same failed prompts blindly
- when Stitch is stable again, resume with the smallest possible auth request first
- preferred next request: a single mobile auth update or a single desktop auth generation, not a multi-variant batch

### Manual Stitch execution protocol
Working rule for manual generation:
- send one small prompt at a time in the Stitch interface
- do not add visual instructions when pasting the prompt
- after Stitch generates a result, review it quickly and then return here
- report completion with `go`, then continue with the next prompt

Manual-control rule added on `2026-04-20`:
- do not trigger Stitch generation or edit tools from this agent while the user is actively iterating in Stitch
- this agent should prepare prompts only
- the user executes the prompt manually in Stitch
- when the user asks for the next Stitch step, provide a fresh functional brief rather than launching Stitch from here

### Ready-to-paste prompt: Auth step 1
Target:
- existing Stitch surface: `Login - Mobile`
- goal of this step: expand mobile auth coverage before touching desktop

Prompt to paste into Stitch:

```md
Update the existing mobile authentication surface so it covers the full Jotly auth flow, not only sign in.

Surface: Authentication flow
Platform: mobile
User goal: let a user access Jotly, create an account, request a password reset token, and set a new password.

Must display:
- the Jotly product identity
- the current auth mode title and supporting copy
- email field for sign in, register, and forgot password
- password field for sign in, register, and reset password
- reset token field for reset password
- optional display name field for register
- inline info or success message area
- inline error message area
- primary submit action
- clear mode switch actions between sign in, register, forgot password, and reset password

Must allow:
- switch between sign in and register
- open forgot password from sign in
- go back from forgot password or reset password to sign in
- submit each auth mode independently
- handle disabled and loading states during submission

Important states:
- sign in idle
- register idle
- forgot password idle
- reset password idle
- submitting/loading
- inline error
- inline success/info after reset-token generation

Product constraints:
- this is the product entry surface, not a marketing landing page
- keep the four auth modes explicit and operationally distinct
- keep the mobile experience compact and task-focused
- leave the visual direction to Stitch and stay within the active Jotly project/design system context
```

Expected output of step 1:
- an updated or newly proposed mobile auth flow that covers sign in, register, forgot password, and reset password
- no desktop request in this step

### Auth step 1 result
Result confirmed by user on `2026-04-18`:
- Stitch created auth screens matching the mobile functional prompt
- mobile auth coverage is considered available for the redesign flow
- exact Stitch screen titles and ids still need to be captured later if needed for implementation mapping

Next action:
- continue with desktop auth coverage using a separate prompt

### Ready-to-paste prompt: Auth step 2
Target:
- new or updated Stitch desktop auth surface
- goal of this step: cover the desktop auth experience without changing the mobile scope

Prompt to paste into Stitch:

```md
Create or update the desktop authentication surface for Jotly so it covers the full auth flow.

Surface: Authentication flow
Platform: desktop
User goal: let a user access Jotly, create an account, request a password reset token, and set a new password.

Must display:
- the Jotly product identity
- current auth mode title and supporting copy
- email field for sign in, register, and forgot password
- password field for sign in, register, and reset password
- reset token field for reset password
- optional display name field for register
- inline info or success message area
- inline error message area
- primary submit action
- mode switch actions between sign in, register, forgot password, and reset password
- a desktop experience that can include a supporting brand or product context area alongside the form

Must allow:
- switch between sign in and register
- open forgot password from sign in
- go back from forgot password or reset password to sign in
- submit each auth mode independently
- handle disabled and loading states during submission

Important states:
- sign in idle
- register idle
- forgot password idle
- reset password idle
- submitting/loading
- inline error
- inline success/info after reset-token generation

Product constraints:
- this is the product entry surface, not a marketing landing page
- keep the four auth modes explicit and operationally distinct
- the primary task remains authentication even if desktop includes supporting brand context
- stay within the active Jotly project/design system context
- leave the visual direction to Stitch
```

Expected output of step 2:
- a desktop auth surface covering sign in, register, forgot password, and reset password
- desktop-specific coverage only

### Auth step 2 result
Result confirmed by user on `2026-04-18`:
- Stitch created desktop auth screens matching the functional prompt
- auth coverage is now considered available on both mobile and desktop for the redesign flow

Auth status after step 2:
- `login`: covered
- `register`: covered
- `forgot password`: covered
- `reset password`: covered
- `mobile`: covered
- `desktop`: covered

Next action:
- move to the `Daily dashboard` surface in `Lot 1`

### Daily dashboard scope
Code references:
- `id="overview"`
- `id="dailyControls"`
- `id="affirmation"`
- `id="reminders"`
- `id="bilan"`
in `frontend/src/components/layout/app-shell.tsx`

Daily dashboard boundaries for this redesign step:
- include the selected-date overview and key daily metrics
- include day navigation and day-level actions
- include Google Calendar event visibility for the selected date
- include day affirmation
- include reminders
- include day bilan
- exclude Kanban board, Notes, Gaming Track, Global Search, Alerts, and AI Assistant from this prompt

User continuity preference confirmed on `2026-04-18`:
- keep `Daily Dashboard - Mobile` as the main mobile dashboard base
- keep `Task Central (Kanban) - Mobile` as the main mobile task-management base
- prefer evolving those existing screens over introducing a parallel mobile concept line such as a separate `Operational` branch
- preserve continuity between dashboard and Kanban so the mobile experience can evolve coherently over time

### Ready-to-paste prompt: Daily dashboard step 1
Target:
- existing Stitch surface: `Daily Dashboard - Mobile`
- supporting reference surface: `Task Central (Kanban) - Mobile`
- goal of this step: evolve the existing mobile dashboard instead of creating a separate operational concept, while aligning it to the actual Jotly dashboard blocks already implemented in code

Prompt to paste into Stitch:

```md
Update the existing `Daily Dashboard - Mobile` surface so it reflects the real Jotly day-management experience.
Use the existing `Task Central (Kanban) - Mobile` screen as a continuity reference for the broader mobile product experience.
Do not create a disconnected new mobile concept line; evolve the existing dashboard experience instead.

Surface: Daily dashboard
Platform: mobile
User goal: help a signed-in user understand, steer, and complete their selected day inside Jotly.

Must display:
- the selected date as the main context
- a short daily overview with key metrics for the selected day:
  - total tasks
  - actionable tasks
  - planned time
- day navigation controls:
  - previous day
  - today
  - next day
  - direct date selection
- day-level actions:
  - carry over yesterday’s unfinished tasks
  - create a new task
- a progress indicator for completion on the selected day
- a calendar events section for the selected date when Google Calendar is connected
- event rows that can show:
  - time
  - title
  - connection/account color
  - whether the event has an internal note
  - whether the event has linked tasks
- expanded event details that can expose:
  - title
  - external calendar link if available
  - location if available
  - description if available
  - linked tasks
  - internal note preview or empty note state
- actions from a calendar event:
  - create a new Jotly task from the event
  - open an existing internal note
  - create a note for the event when none exists
- a day affirmation section with:
  - editable content
  - save action
  - last updated information
- a reminders section with:
  - active reminders up to the selected day
  - title
  - optional project
  - optional assignees
  - reminder time
  - reminder status
  - add, edit, complete, and cancel actions
- a day bilan section with:
  - summary metrics for the selected day
  - mood
  - wins
  - blockers
  - lessons learned
  - top 3 for tomorrow
  - save action
  - last updated information

Must allow:
- understand the selected day at a glance
- move between days quickly
- jump back to today
- create a task from the dashboard
- carry over unfinished work from yesterday
- inspect calendar events and expand one for more detail
- create a task from a calendar event
- create or open a note linked to a calendar event
- write and save a day affirmation
- manage reminders directly from the dashboard
- write and save the day bilan

Important states:
- loading selected-day data
- empty day with no tasks yet
- empty calendar section with no events
- no active reminders
- inline success or info after carry-over
- inline error when data loading or saving fails
- saving state for affirmation and bilan
- mobile-first authenticated workspace context

Product constraints:
- this is an authenticated productivity surface, not a marketing page
- keep the dashboard centered on the selected date
- keep the major blocks operationally distinct: overview, day controls, calendar events, affirmation, reminders, bilan
- preserve experiential continuity with the existing `Daily Dashboard - Mobile` and `Task Central (Kanban) - Mobile` screens
- prefer adapting the existing dashboard screen over creating a new separate mobile dashboard direction
- do not merge this prompt with Kanban, Notes, Gaming Track, Global Search, Alerts, or AI Assistant
- leave the visual direction to Stitch and stay within the active Jotly project/design system context
```

Expected output of step 1:
- an updated `Daily Dashboard - Mobile` aligned to the current Jotly product scope
- continuity with the established mobile experience rather than a separate `Operational` branch
- coverage limited to the dashboard blocks listed above

### Daily dashboard step 1 result
Result confirmed by user on `2026-04-18`:
- Stitch updated the daily dashboard direction using the existing mobile dashboard base
- the user accepted the updated mobile dashboard direction
- continuity with the preferred mobile experience is considered preserved

Next action:
- update `Daily Dashboard - Desktop` in the same product direction

### Ready-to-paste prompt: Daily dashboard step 2
Target:
- existing Stitch surface: `Daily Dashboard - Desktop`
- supporting reference surfaces:
  - `Daily Dashboard - Mobile`
  - `Task Kanban - Desktop`
- goal of this step: evolve the existing desktop dashboard in continuity with the accepted mobile dashboard and the established desktop product experience

Prompt to paste into Stitch:

```md
Update the existing `Daily Dashboard - Desktop` surface so it reflects the real Jotly day-management experience.
Use the accepted `Daily Dashboard - Mobile` direction as the primary continuity reference, and use `Task Kanban - Desktop` as a secondary continuity reference for the broader desktop product experience.
Do not create a disconnected new desktop concept line; evolve the existing desktop dashboard experience instead.

Surface: Daily dashboard
Platform: desktop
User goal: help a signed-in user understand, steer, and complete their selected day inside Jotly.

Must display:
- the selected date as the main context
- a short daily overview with key metrics for the selected day:
  - total tasks
  - actionable tasks
  - planned time
- day navigation controls:
  - previous day
  - today
  - next day
  - direct date selection
- day-level actions:
  - carry over yesterday’s unfinished tasks
  - create a new task
- a progress indicator for completion on the selected day
- a calendar events section for the selected date when Google Calendar is connected
- event rows that can show:
  - time
  - title
  - connection/account color
  - whether the event has an internal note
  - whether the event has linked tasks
- expanded event details that can expose:
  - title
  - external calendar link if available
  - location if available
  - description if available
  - linked tasks
  - internal note preview or empty note state
- actions from a calendar event:
  - create a new Jotly task from the event
  - open an existing internal note
  - create a note for the event when none exists
- a day affirmation section with:
  - editable content
  - save action
  - last updated information
- a reminders section with:
  - active reminders up to the selected day
  - title
  - optional project
  - optional assignees
  - reminder time
  - reminder status
  - add, edit, complete, and cancel actions
- a day bilan section with:
  - summary metrics for the selected day
  - mood
  - wins
  - blockers
  - lessons learned
  - top 3 for tomorrow
  - save action
  - last updated information

Must allow:
- understand the selected day at a glance
- move between days quickly
- jump back to today
- create a task from the dashboard
- carry over unfinished work from yesterday
- inspect calendar events and expand one for more detail
- create a task from a calendar event
- create or open a note linked to a calendar event
- write and save a day affirmation
- manage reminders directly from the dashboard
- write and save the day bilan

Important states:
- loading selected-day data
- empty day with no tasks yet
- empty calendar section with no events
- no active reminders
- inline success or info after carry-over
- inline error when data loading or saving fails
- saving state for affirmation and bilan
- desktop authenticated workspace context

Product constraints:
- this is an authenticated productivity surface, not a marketing page
- keep the dashboard centered on the selected date
- keep the major blocks operationally distinct: overview, day controls, calendar events, affirmation, reminders, bilan
- preserve experiential continuity with the accepted `Daily Dashboard - Mobile` and the existing desktop product surfaces
- prefer adapting the existing desktop dashboard screen over creating a new separate desktop dashboard direction
- do not merge this prompt with Kanban, Notes, Gaming Track, Global Search, Alerts, or AI Assistant
- leave the visual direction to Stitch and stay within the active Jotly project/design system context
```

Expected output of step 2:
- an updated `Daily Dashboard - Desktop` aligned to the accepted mobile dashboard direction and the current Jotly product scope
- continuity with the established desktop experience rather than a separate new branch
- coverage limited to the dashboard blocks listed above

### Daily dashboard step 2 attempt
Attempted on `2026-04-20`:
- `edit_screens` targeting existing `Daily Dashboard - Desktop` with the prepared functional brief
  - result: transport send error while calling Stitch MCP

Post-check after the attempt:
- Stitch project `updateTime` advanced to `2026-04-20T19:54:01.427614Z`
- no confirmed new version of `Daily Dashboard - Desktop` was visible after the transport failure
- unexpected new auth desktop screens appeared in the project instead:
  - `Sign In - Desktop`
  - `Register - Desktop`
  - `Forgot Password - Desktop`
  - `Reset Password - Desktop`

Current conclusion:
- the desktop dashboard step is still pending
- the latest Stitch-side update appears to have produced auth-related artifacts instead of a confirmed dashboard desktop update

Next action:
- do not launch Stitch from this agent
- use a fresh manual prompt that does not ask Stitch to update or continue previous dashboard screens
- ask for a new mobile-first dashboard proposal plus a desktop variation based only on functional requirements

### Ready-to-paste prompt: Daily dashboard fresh generation
Target:
- manual execution in Stitch
- generate a fresh dashboard direction from functionality only
- do not ask Stitch to update, reuse, continue, or reference previous dashboard screens

Prompt to paste into Stitch:

```md
Create a new daily dashboard proposal for Jotly from scratch.
Do not continue, update, remix, or lightly adapt previous Jotly dashboard screens.
Do not use earlier dashboard screens as a reference baseline.

Surface: Daily dashboard
Platform: mobile-first, plus one desktop variation
User goal: help a signed-in user understand, steer, and complete their selected day inside Jotly.

Must display:
- the selected date as the main context
- a short daily overview with key metrics for the selected day:
  - total tasks
  - actionable tasks
  - planned time
- day navigation controls:
  - previous day
  - today
  - next day
  - direct date selection
- day-level actions:
  - carry over yesterday’s unfinished tasks
  - create a new task
- a progress indicator for completion on the selected day
- a calendar events section for the selected date when Google Calendar is connected
- event rows that can show:
  - time
  - title
  - connection or account color
  - whether the event has an internal note
  - whether the event has linked tasks
- expanded event details that can expose:
  - title
  - external calendar link if available
  - location if available
  - description if available
  - linked tasks
  - internal note preview or empty note state
- actions from a calendar event:
  - create a new Jotly task from the event
  - open an existing internal note
  - create a note for the event when none exists
- a day affirmation section with:
  - editable content
  - save action
  - last updated information
- a reminders section with:
  - active reminders up to the selected day
  - title
  - optional project
  - optional assignees
  - reminder time
  - reminder status
  - add, edit, complete, and cancel actions
- a day bilan section with:
  - summary metrics for the selected day
  - mood
  - wins
  - blockers
  - lessons learned
  - top 3 for tomorrow
  - save action
  - last updated information

Must allow:
- understand the selected day at a glance
- move between days quickly
- jump back to today
- create a task from the dashboard
- carry over unfinished work from yesterday
- inspect calendar events and expand one for more detail
- create a task from a calendar event
- create or open a note linked to a calendar event
- write and save a day affirmation
- manage reminders directly from the dashboard
- write and save the day bilan

Important states:
- loading selected-day data
- empty day with no tasks yet
- empty calendar section with no events
- no active reminders
- inline success or info after carry-over
- inline error when data loading or saving fails
- saving state for affirmation and bilan
- authenticated workspace context

Product constraints:
- this is an authenticated productivity surface, not a marketing page
- keep the dashboard centered on the selected date
- keep the major blocks operationally distinct:
  - overview
  - day controls
  - calendar events
  - affirmation
  - reminders
  - bilan
- do not merge this prompt with Kanban, Notes, Gaming Track, Global Search, Alerts, or AI Assistant
- do not try to preserve continuity with earlier dashboard screens
- create a fresh proposal that responds only to the functional requirements above
- leave the visual direction to Stitch and stay within the active Jotly project and design system context
```

Expected output:
- one fresh mobile-first daily dashboard proposal
- one desktop variation of the same functional surface
- no dependency on earlier dashboard screens
