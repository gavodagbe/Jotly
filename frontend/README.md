# Jotly Frontend

Frontend foundation for Jotly, built with Next.js App Router, TypeScript, and Tailwind CSS.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Available Scripts

```bash
npm run dev    # Start local development server
npm run lint   # Run ESLint
npm run build  # Build production bundle
npm run start  # Start production server
```

## Structure

```text
src/
  app/         # App Router entry points, global styles, pages
  components/  # Reusable UI/layout pieces
  features/    # Future feature modules
  lib/         # Shared frontend constants/utilities
```

## Scope

Current frontend includes:
- authenticated dashboard flow
- profile/settings dialog (display name, preferred language, preferred timezone)
- interface internationalization (`en`/`fr`) driven by user profile locale with browser fallback
- date-driven Kanban board
- day affirmation panel (counts in daily completion)
- carry-over action for non-completed tasks from yesterday
- day bilan panel (wins/blockers/lessons/top 3)
- create/edit/delete task dialog
- drag-and-drop status updates
- task comments, attachments, and recurrence controls
- AI assistant chatbot (FAB) with global user context across all task dates and profile locale hint
- gaming track dashboard (period stats, missions, bests, levels/badges, trends, challenge, leaderboard, recap, and nudges)
- gaming track engagement actions (claim weekly challenge reward, consume streak protection, dismiss nudge)
