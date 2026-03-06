import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";

const foundationChecklist = [
  "Next.js App Router scaffolded in frontend/",
  "TypeScript configuration is enabled",
  "Tailwind CSS pipeline is active",
  "Minimal branded shell is in place",
];

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10 sm:px-10">
      <header className="mb-10 flex flex-col gap-3 rounded-3xl border border-line bg-surface/85 px-6 py-8 shadow-sm backdrop-blur sm:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Sprint 1 Foundation</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        <p className="max-w-2xl text-base text-muted sm:text-lg">{APP_TAGLINE}</p>
      </header>

      <main className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Current Scope</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            This page is a frontend shell only. Kanban workflows, API integration, and task operations will
            be implemented in upcoming tickets.
          </p>
        </section>

        <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Foundation Checklist</h2>
          <ul className="mt-3 space-y-3 text-sm text-muted">
            {foundationChecklist.map((item) => (
              <li key={item} className="rounded-xl border border-line bg-accent-soft/50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
