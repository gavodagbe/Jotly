# Jotly — Offline mobile mode

Status: **delivered** — phases 1–4 merged on 2026-11-17 (#91, #92, #93, #94); docs aligned in phase 5.
No Jira tickets (NOJIRA branches).
Production: https://jotly.godwinavodagbe.com (HTTPS via nginx + Let's Encrypt — required for service workers).

This document supersedes "V1 mobile reste online-first" in `mobile.md`, which only exists on the
unmerged branch `feat/JOT-13-mobile-app` (kept as is): phone use is covered by the installable PWA,
a native client is no longer required for offline use.

## Goal

Use Jotly from a phone with no network (no Wi-Fi, no 4G/5G). Everything done offline
is pushed to the server automatically when the connection comes back.

## Architecture

1. **PWA on the existing Next.js app** (not a native Expo app).
   - `manifest.webmanifest` → installable on the home screen.
   - Hand-written service worker (`frontend/public/sw.js`) → app shell opens offline.
2. **Local database**: IndexedDB through Dexie. Screens read local data first.
   Keeps a window of data (≈ 30 days around today) plus everything pending.
3. **Outbox**: every mutation (create / update / status / delete) is applied
   optimistically to the local DB and appended to an ordered outbox queue.
   New entities get a client-generated id (cuid), so offline-created records can be
   edited/commented before reaching the server.
4. **Sync engine** triggered on `online` event, app open, tab focus/visibility, and a
   periodic timer. iOS has no Background Sync → on iPhone, sync happens on next open.
   - Push: replay outbox in order, each entry with an idempotency key (safe retries).
   - Pull: fetch "changes since <cursor>" and merge into the local DB.
5. **Conflicts**: last-write-wins. Each mutation carries the `updatedAt` it was based
   on; the server answers 409 if the record changed meanwhile; the client keeps the
   most recent version and shows "synced with conflicts".
6. **Online-only** (disabled offline): AI assistant, search, Google Calendar,
   AI reformat / text extraction, attachment upload.

### Backend changes (phase 2+)
- Accept a client-provided `id` on create.
- Accept an `Idempotency-Key` header; replays return the original result.
- Accept a base version (`baseUpdatedAt`) on update/delete → 409 on mismatch.
- `GET /api/sync/changes?since=<cursor>` returning changed + deleted records.

### Main risk
~80 fetch calls live inline in `frontend/src/components/layout/app-shell.tsx`
(≈12.7k lines). Rerouting them through the offline data layer means touching that
file, which triggers the 500-line rule: extract the data-access code into
`frontend/src/lib/api/*` before plugging the offline layer.

## Phases (one branch each)

| # | Branch | Outcome on the phone |
|---|--------|----------------------|
| 1 | `feat/NOJIRA-offline-pwa-shell` | Install Jotly, open it in airplane mode, see already-visited data (read-only) |
| 2 | `feat/NOJIRA-offline-tasks-sync` | Create / edit / complete tasks + time entries offline, auto-pushed on reconnect |
| 3 | `feat/NOJIRA-offline-reminders-notes` | Same for reminders and notes (text only) |
| 4 | `feat/NOJIRA-offline-journal-sync-ui` | Journal entries + routines offline, sync indicator, conflict notice |
| 5 | `chore/NOJIRA-offline-docs` | PLAN.md / AGENT.md / mobile.md aligned |

## Phase 1 — detailed plan (PWA shell + read cache)

Scope: installable app, opens offline, shows the last server data already seen.
No offline writes (mutations fail with a clear "offline" message). `app-shell.tsx` untouched.

Files:
- `frontend/public/manifest.webmanifest` — name, icons, `display: standalone`, theme colors.
- `frontend/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
- `frontend/public/sw.js` — service worker:
  - precache `/` + offline fallback on install;
  - navigations: network-first, fallback to cached `/`;
  - `/_next/static/*`: cache-first (hashed, immutable);
  - Google Fonts: stale-while-revalidate;
  - `GET /backend-api/*`: network-first with cache fallback, except online-only
    endpoints (assistant, search, google-calendar, attachments, AI);
  - non-GET requests: never cached, pass-through;
  - clears the API cache on `POST /backend-api/auth/logout` and on 401 responses;
  - versioned cache names, old caches deleted on `activate`.
- `frontend/src/lib/offline/sw-routes.mjs` (or shared rules) — pure route classification, unit-tested.
- `frontend/src/lib/offline/register-service-worker.ts` — registers `/sw.js` in production only.
- `frontend/src/components/offline/OfflineStatus.tsx` — registers SW + shows an "Offline — read-only" banner.
- `frontend/src/app/layout.tsx` — manifest link, theme-color, apple-touch-icon, `<OfflineStatus />`.
- `frontend/next.config.ts` — headers for `/sw.js` (`Cache-Control: no-cache`, `Service-Worker-Allowed: /`).

Tests:
- `node --test` on route classification rules.
- Manual: Chrome DevTools offline mode, Lighthouse PWA check, phone install + airplane mode.

Out of scope: IndexedDB, outbox, backend changes, offline writes (phase 2+).

## Phase 1 — status
Done (commit `8d6be53`, branch `feat/NOJIRA-offline-pwa-shell`).

## Phase 2 — status and decisions (branch `feat/NOJIRA-offline-tasks-sync`)

Implemented with a simpler backend than the original design:
- No idempotency-key table: `POST /api/tasks` accepts an optional client `id`
  (8–64 chars, `[A-Za-z0-9_-]`); replaying the same id returns the existing task (200).
  An id owned by another user → 409.
- `PATCH /api/tasks/:id` accepts optional `baseUpdatedAt`; stale → 409 with the server copy in `data`.
- Delete replay → 404 treated as success; time entry PUT is already an upsert.
- No "changes since" endpoint: after pushing, the client re-downloads the window
  (today −7 / +30 days) with `GET /api/tasks/all?dateFrom&dateTo` and replaces its local copy.

Frontend:
- `src/lib/api/task-types.ts`, `src/lib/api/tasks-api.ts`: task types + network calls moved out of `app-shell.tsx`.
- `src/lib/offline/`: `db.ts` (Dexie, one DB per account), `outbox-plan.ts` (pure merge rules),
  `outbox.ts`, `local-store.ts`, `sync-engine.ts`, `task-repository.ts`, `session.ts`,
  `offline-session.ts` (triggers: online, visibility, 60 s retry), `sync-status.ts`.
- Conflict rule: compare the local edit time with the server `updatedAt`; the most recent wins,
  and the conflict is shown in the banner.
- A change rejected by the server (4xx) is set aside and reported; it does not block the queue.
- Logout keeps the local DB so unsent changes are pushed at next sign-in of the same account.

Still online-only after phase 2: comments, attachments, recurrence, carry-over, auto-cancel,
alerts/triage (served from the service-worker cache, possibly stale).

Rule exceptions (approved 2026-11-17): `app-shell.tsx` only had its task data-access code
extracted (12.7k → 12.5k lines); full split is a separate refactoring ticket.
`backend/src/routes/tasks.ts` was split in the same branch: `routes/tasks.ts` (plugin + auth hook),
`routes/task-read-routes.ts`, `task-time-entry-routes.ts`, `task-write-routes.ts`,
`task-maintenance-routes.ts` and `tasks/task-route-helpers.ts`, all under 500 lines.

## Phase 2 — merged (#92).

## Phase 3 — status and decisions (branch `feat/NOJIRA-offline-reminders-notes`)

Backend:
- Shared helpers moved to `routes/offline-sync-helpers.ts` (`clientIdSchema`, `baseUpdatedAtSchema`,
  `hasConcurrentChange`, `conflictPayload`); `tasks/task-offline-sync.ts` removed.
- `POST /api/reminders` and `POST /api/notes` accept a client `id` (replay → 200 with the existing record).
- `PUT /api/reminders/:id` and `PATCH /api/notes/:id` accept `baseUpdatedAt` → 409 with the server copy.
- `routes/reminders.ts` and `routes/notes.ts` split (pure move) into read / write / attachment route
  modules + `reminders/reminder-route-helpers.ts`, `notes/note-route-helpers.ts`.
- Shared in-memory doubles: `reminders/reminder-store.in-memory.ts`, `notes/note-store.in-memory.ts`
  (older test files keep their inline copies).

Frontend:
- `src/lib/api/http.ts` (shared client: `ApiError`, `OfflineError`), `reminders-api.ts`, `notes-api.ts`,
  `reminder-types.ts`, `note-types.ts`.
- Offline layer made generic: Dexie schema v2 (reminders, notes tables), generic outbox merge rules,
  `entity-sync.ts` (per-entity send + pull), `sync-helpers.ts` (conflict resolution), `sync-issues.ts`,
  `repository-helpers.ts`, `reminder-repository.ts`, `note-repository.ts`.
- Pull: tasks in window, all reminders, notes in window (or without date).
- Due reminders while offline: computed from the local copy and marked fired locally so the in-app alert
  still shows once; the server marks them fired after reconnecting. No push notification when closed.
- Still online-only: reminder/note attachments, Google Calendar event notes, task comments.

## Phase 3 — merged (#93).

## Phase 4 — status and decisions (branch `feat/NOJIRA-offline-journal-routines`)

Scope decided with the user: journal entries, routines (ticks **and** create / edit / delete) and
task comments all work offline.

Backend:
- `PUT /api/day-affirmation`, `/api/day-bilan`, `/api/weekly-entry`, `/api/monthly-entry` accept
  `baseUpdatedAt` → 409 with the server copy (they are upserts, so replays are already harmless).
- `POST /api/routines` and `POST /api/tasks/:id/comments` accept a client `id` (replay → 200);
  `PATCH /api/routines/:id` and `PATCH /api/tasks/:id/comments/:commentId` accept `baseUpdatedAt`.
- Routine ticks (`PUT /api/routine-completions`) and routine delete (soft) are naturally replay-safe.
- Shared in-memory doubles added for routines, day affirmation, day bilan, weekly and monthly entries.

Frontend:
- Dexie schema v3: `journal` (keyed `affirmation:<date>`, `bilan:<date>`, `weekly:<year>-<week>`,
  `monthly:<year>-<month>`), `routines`, `routineCompletions`, `comments`.
- Outbox: `journal.put` saves of the same entry are merged; routine ticks use the routine id as
  entity so deleting a routine created offline also drops its ticks.
- `journal-repository.ts`, `routine-repository.ts` (tracker percentages recomputed locally with the
  server formula), `comment-repository.ts`; downloads moved to `pull-window.ts` (adds today's
  affirmation / bilan, current week and month entries, current routine month).
- Fix: a sync requested while a run is in progress now triggers a fresh run afterwards (previously a
  sync right after reconnecting could join a run that started offline and push nothing for ~60 s).

Still online-only: affirmation text extraction from a photo and AI reformatting, attachments,
Google Calendar. Not handled: deleting offline a task created offline does not drop comments queued
for it (the server rejects them and the banner reports it).

## Phase 4 — merged (#94).

## Phase 5 — docs (branch `chore/NOJIRA-offline-docs`)
`PLAN.md`, `REVIEW.md` (decision 12 + review rule for new write endpoints) and `AGENT.md` aligned.

## Final summary

Works offline: tasks (+ time entries), reminders (in-app alert when due), notes (text), journal
(affirmation, bilan, weekly, monthly), routines (templates and ticks, tracker computed locally),
task comments. Changes are pushed in order when the network returns; conflicts are resolved by the
most recent edit and shown in the banner.

Online-only: AI assistant, search, Google Calendar (events and event notes), attachments, affirmation
OCR / AI reformat, recurrence, carry-over, auto-cancel, `/admin`.

Known limits:
- iOS has no background sync: changes are pushed when Jotly is open.
- No push notification when the app is closed.
- Offline data window: tasks today −7 / +30 days, all reminders, notes in the window, today's journal,
  current week / month / routine month, plus anything opened online.
- A comment queued offline on a task created then deleted offline is rejected by the server (reported).
- `app-shell.tsx` is still ~11.9k lines: its full split is a separate refactoring ticket.
