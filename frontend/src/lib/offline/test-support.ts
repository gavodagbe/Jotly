/**
 * Test-only helpers: an in-memory fake of the task API installed as global fetch,
 * with a switch to simulate losing the network. Not imported by the app.
 */
import type { Task } from "../api/task-types";

type StoredTask = Task & { updatedAt: string; createdAt: string };

export class FakeTaskServer {
  tasks = new Map<string, StoredTask>();
  timeEntries = new Map<string, number>();
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

  install(): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => this.handle(String(input), init)) as typeof fetch;
    return () => {
      globalThis.fetch = original;
    };
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
