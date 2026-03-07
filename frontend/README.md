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
- date-driven Kanban board
- create/edit/delete task dialog
- drag-and-drop status updates
- task comments, attachments, and recurrence controls
- AI assistant chatbot (FAB) with global user context across all task dates
