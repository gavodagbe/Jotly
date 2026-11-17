/**
 * Test-only helpers: an in-memory fake of the task API installed as global fetch,
 * with a switch to simulate losing the network. Not imported by the app.
 */
import type { Note } from "../api/note-types";
import type { Reminder } from "../api/reminder-types";
import type { Task } from "../api/task-types";

type StoredTask = Task & { updatedAt: string; createdAt: string };

export class FakeTaskServer {
  tasks = new Map<string, StoredTask>();
  timeEntries = new Map<string, number>();
  reminders = new Map<string, Reminder>();
  notes = new Map<string, Note>();
  requests: Array<{ method: string; path: string; body: unknown }> = [];
  online = true;
  private clock = Date.parse("2026-11-17T08:00:00.000Z");

  tick(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  seed(task: Partial<Task> & { id: string; title: string; targetDate: string }): StoredTask {
    const stamp = this.tick();
    const stored: StoredTask = {
      description: null,
      status: "todo",
      dueDate: task.targetDate,
      priority: "medium",
      project: null,
      assignees: null,
      plannedTime: null,
      rolledFromTaskId: null,
      recurrenceSourceTaskId: null,
      recurrenceOccurrenceDate: null,
      calendarEventId: null,
      ...task,
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.tasks.set(stored.id, stored);
    return stored;
  }

  seedReminder(reminder: Partial<Reminder> & { id: string; title: string; remindAt: string }): Reminder {
    const stamp = this.tick();
    const stored: Reminder = {
      description: null,
      project: null,
      assignees: null,
      status: "pending",
      isFired: false,
      firedAt: null,
      isDismissed: false,
      dismissedAt: null,
      completedAt: null,
      cancelledAt: null,
      ...reminder,
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.reminders.set(stored.id, stored);
    return stored;
  }

  seedNote(note: Partial<Note> & { id: string; body: string }): Note {
    const stamp = this.tick();
    const stored: Note = {
      title: null,
      color: null,
      targetDate: null,
      calendarEventId: null,
      linkedCalendarEvent: null,
      ...note,
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.notes.set(stored.id, stored);
    return stored;
  }

  install(): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => this.handle(String(input), init)) as typeof fetch;
    return () => {
      globalThis.fetch = original;
    };
  }

  private handleRemindersAndNotes(method: string, path: string, url: URL, body: Record<string, unknown> | undefined) {
    if (method === "GET" && path === "/reminders") {
      return this.json(200, { data: [...this.reminders.values()] });
    }
    if (method === "GET" && path === "/reminders/pending") {
      const due = [...this.reminders.values()].filter((r) => r.status === "pending" && Date.parse(r.remindAt) <= Date.now());
      const fired = due.map((r) => ({ ...r, status: "fired" as const, isFired: true, firedAt: this.tick() }));
      fired.forEach((r) => this.reminders.set(r.id, r));
      return this.json(200, { data: fired });
    }
    if (method === "POST" && path === "/reminders") {
      const existing = body?.id ? this.reminders.get(String(body.id)) : undefined;
      if (existing) return this.json(200, { data: existing });
      const created = this.seedReminder({ ...(body as object), id: String(body?.id ?? `srv-r-${this.reminders.size + 1}`) } as Reminder);
      return this.json(201, { data: created });
    }
    const reminderMatch = path.match(/^\/reminders\/([^/]+)(?:\/(complete|cancel))?$/);
    if (reminderMatch) {
      const reminder = this.reminders.get(decodeURIComponent(reminderMatch[1]));
      if (!reminder) return this.json(404, { error: { code: "NOT_FOUND", message: "Reminder not found" } });
      if (method === "POST" && reminderMatch[2]) {
        const status = reminderMatch[2] === "complete" ? "completed" : "cancelled";
        const updated = { ...reminder, status, isDismissed: true, updatedAt: this.tick() } as Reminder;
        this.reminders.set(reminder.id, updated);
        return this.json(200, { data: updated });
      }
      if (method === "PUT") {
        const { baseUpdatedAt, ...fields } = body ?? {};
        if (baseUpdatedAt && Date.parse(reminder.updatedAt) > Date.parse(String(baseUpdatedAt))) {
          return this.json(409, { error: { code: "CONFLICT", message: "Reminder was modified" }, data: reminder });
        }
        const updated = { ...reminder, ...fields, updatedAt: this.tick() } as Reminder;
        this.reminders.set(reminder.id, updated);
        return this.json(200, { data: updated });
      }
    }
    if (method === "GET" && path === "/notes") {
      const date = url.searchParams.get("date");
      return this.json(200, { data: [...this.notes.values()].filter((n) => !date || n.targetDate === date) });
    }
    if (method === "POST" && path === "/notes") {
      const existing = body?.id ? this.notes.get(String(body.id)) : undefined;
      if (existing) return this.json(200, { data: existing });
      const created = this.seedNote({ ...(body as object), id: String(body?.id ?? `srv-n-${this.notes.size + 1}`) } as Note);
      return this.json(201, { data: created });
    }
    const noteMatch = path.match(/^\/notes\/([^/]+)$/);
    if (noteMatch) {
      const note = this.notes.get(decodeURIComponent(noteMatch[1]));
      if (!note) return this.json(404, { error: { code: "NOT_FOUND", message: "Note not found" } });
      if (method === "DELETE") {
        this.notes.delete(note.id);
        return this.json(200, { data: note });
      }
      if (method === "PATCH") {
        const { baseUpdatedAt, ...fields } = body ?? {};
        if (baseUpdatedAt && Date.parse(note.updatedAt) > Date.parse(String(baseUpdatedAt))) {
          return this.json(409, { error: { code: "CONFLICT", message: "Note was modified" }, data: note });
        }
        const updated = { ...note, ...fields, updatedAt: this.tick() } as Note;
        this.notes.set(note.id, updated);
        return this.json(200, { data: updated });
      }
    }
    return null;
  }

  private json(status: number, payload: unknown): Response {
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  }

  private async handle(rawUrl: string, init: RequestInit = {}): Promise<Response> {
    if (!this.online) {
      throw new TypeError("Failed to fetch");
    }
    const url = new URL(rawUrl, "https://jotly.test");
    const method = (init.method ?? "GET").toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const path = url.pathname.replace(/^\/backend-api/, "");
    this.requests.push({ method, path: `${path}${url.search}`, body });

    const handled = this.handleRemindersAndNotes(method, path, url, body);
    if (handled) return handled;

    if (method === "GET" && path === "/tasks") {
      const date = url.searchParams.get("date");
      return this.json(200, { data: [...this.tasks.values()].filter((task) => task.targetDate === date) });
    }
    if (method === "GET" && path === "/tasks/all") {
      const from = url.searchParams.get("dateFrom") ?? "0000-00-00";
      const to = url.searchParams.get("dateTo") ?? "9999-99-99";
      return this.json(200, {
        data: [...this.tasks.values()].filter((task) => task.targetDate >= from && task.targetDate <= to),
      });
    }
    if (method === "POST" && path === "/tasks") {
      const existing = body.id ? this.tasks.get(body.id) : undefined;
      if (existing) return this.json(200, { data: existing });
      if (!body.title) return this.json(400, { error: { code: "VALIDATION_ERROR", message: "Title is required" } });
      const created = this.seed({ ...body, id: body.id ?? `srv-${this.tasks.size + 1}` });
      return this.json(201, { data: created });
    }
    const timeEntryMatch = path.match(/^\/tasks\/([^/]+)\/time-entry$/);
    if (method === "PUT" && timeEntryMatch) {
      this.timeEntries.set(`${body.date}|${timeEntryMatch[1]}`, body.fraction);
      return this.json(200, { data: { taskId: timeEntryMatch[1], date: body.date, fraction: body.fraction, dayTotal: body.fraction } });
    }
    const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const task = this.tasks.get(decodeURIComponent(taskMatch[1]));
      if (!task) return this.json(404, { error: { code: "NOT_FOUND", message: "Task not found" } });
      if (method === "DELETE") {
        this.tasks.delete(task.id);
        return this.json(200, { data: task });
      }
      if (method === "PATCH") {
        const { baseUpdatedAt, ...fields } = body;
        if (baseUpdatedAt && Date.parse(task.updatedAt) > Date.parse(baseUpdatedAt)) {
          return this.json(409, { error: { code: "CONFLICT", message: "Task was modified" }, data: task });
        }
        const updated = { ...task, ...fields, updatedAt: this.tick() };
        this.tasks.set(task.id, updated);
        return this.json(200, { data: updated });
      }
    }
    return this.json(404, { error: { code: "NOT_FOUND", message: `No fake route for ${method} ${path}` } });
  }
}

export const TEST_TOKEN = "test-token";

export function taskInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Offline task",
    description: null,
    status: "todo" as const,
    targetDate: "2026-11-17",
    dueDate: "2026-11-17",
    priority: "medium" as const,
    project: null,
    assignees: null,
    plannedTime: null,
    autoCancelIfUntouched: false,
    ...overrides,
  };
}
