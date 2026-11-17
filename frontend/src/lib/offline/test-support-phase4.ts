/**
 * Test-only: fake journal, routine and comment routes for FakeTaskServer
 * (kept apart so test-support.ts stays small). Not imported by the app.
 */
import type { TaskComment } from "../api/comment-types";
import type { RoutineCompletion, RoutineTemplate } from "../api/routine-types";

type Json = (status: number, payload: unknown) => Response;
type Body = Record<string, unknown> | undefined;

export class FakePhase4Routes {
  journal = new Map<string, Record<string, unknown> & { id: string; updatedAt: string }>();
  routines = new Map<string, RoutineTemplate>();
  completions = new Map<string, RoutineCompletion>();
  comments = new Map<string, TaskComment>();

  constructor(private readonly tick: () => string) {}

  seedRoutine(routine: Partial<RoutineTemplate> & { id: string; title: string }): RoutineTemplate {
    const stamp = this.tick();
    const stored: RoutineTemplate = {
      challenge: "normal",
      startTime: null,
      endTime: null,
      sortOrder: (this.routines.size + 1) * 10,
      isActive: true,
      ...routine,
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.routines.set(stored.id, stored);
    return stored;
  }

  private journalKey(path: string, source: Record<string, unknown>): string | null {
    if (path === "/day-affirmation") return `affirmation:${source.date}`;
    if (path === "/day-bilan") return `bilan:${source.date}`;
    if (path === "/weekly-entry") return `weekly:${source.year}-${String(source.week).padStart(2, "0")}`;
    if (path === "/monthly-entry") return `monthly:${source.year}-${String(source.month).padStart(2, "0")}`;
    return null;
  }

  handle(method: string, path: string, url: URL, body: Body, json: Json): Response | null {
    const query = Object.fromEntries(url.searchParams.entries());
    const key = this.journalKey(path, method === "GET" ? query : body ?? {});
    if (key && method === "GET") return json(200, { data: this.journal.get(key) ?? null });
    if (key && method === "PUT") {
      const { baseUpdatedAt, ...fields } = body ?? {};
      const existing = this.journal.get(key);
      if (existing && baseUpdatedAt && Date.parse(existing.updatedAt) > Date.parse(String(baseUpdatedAt))) {
        return json(409, { error: { code: "CONFLICT", message: "Entry was modified" }, data: existing });
      }
      const stamp = this.tick();
      const saved = { ...(existing ?? {}), ...fields, id: existing?.id ?? `srv-${key}`, createdAt: stamp, updatedAt: stamp };
      this.journal.set(key, saved);
      return json(200, { data: saved });
    }

    if (method === "GET" && path === "/routine-completions") {
      const month = query.month;
      const routines = [...this.routines.values()].filter((routine) => routine.isActive);
      const completions = [...this.completions.values()].filter((completion) => completion.targetDate.startsWith(month));
      const days = Array.from({ length: 30 }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
      return json(200, { data: { month, days, routines, completions, dailyPercentages: [], monthPercentage: 0 } });
    }
    if (method === "PUT" && path === "/routine-completions") {
      const routine = this.routines.get(String(body?.routineId));
      if (!routine || !routine.isActive) return json(404, { error: { code: "NOT_FOUND", message: "Routine not found" } });
      const stamp = this.tick();
      const completion: RoutineCompletion = {
        id: `srv-c-${body?.routineId}-${body?.targetDate}`,
        routineId: String(body?.routineId),
        targetDate: String(body?.targetDate),
        isCompleted: Boolean(body?.isCompleted),
        completedAt: body?.isCompleted ? stamp : null,
        createdAt: stamp,
        updatedAt: stamp,
      };
      this.completions.set(`${completion.routineId}:${completion.targetDate}`, completion);
      return json(200, { data: completion });
    }
    if (method === "POST" && path === "/routines") {
      const existing = body?.id ? this.routines.get(String(body.id)) : undefined;
      if (existing) return json(200, { data: existing });
      const created = this.seedRoutine({ ...(body as object), id: String(body?.id ?? `srv-routine-${this.routines.size + 1}`) } as RoutineTemplate);
      return json(201, { data: created });
    }
    const routineMatch = path.match(/^\/routines\/([^/]+)$/);
    if (routineMatch) {
      const routine = this.routines.get(decodeURIComponent(routineMatch[1]));
      if (!routine) return json(404, { error: { code: "NOT_FOUND", message: "Routine not found" } });
      if (method === "DELETE") {
        const deactivated = { ...routine, isActive: false, updatedAt: this.tick() };
        this.routines.set(routine.id, deactivated);
        return json(200, { data: deactivated });
      }
      if (method === "PATCH") {
        const { baseUpdatedAt, ...fields } = body ?? {};
        if (baseUpdatedAt && Date.parse(routine.updatedAt) > Date.parse(String(baseUpdatedAt))) {
          return json(409, { error: { code: "CONFLICT", message: "Routine was modified" }, data: routine });
        }
        const updated = { ...routine, ...fields, updatedAt: this.tick() } as RoutineTemplate;
        this.routines.set(routine.id, updated);
        return json(200, { data: updated });
      }
    }

    const commentsMatch = path.match(/^\/tasks\/([^/]+)\/comments(?:\/([^/]+))?$/);
    if (commentsMatch) {
      const taskId = decodeURIComponent(commentsMatch[1]);
      if (method === "GET") return json(200, { data: [...this.comments.values()].filter((c) => c.taskId === taskId) });
      if (method === "POST") {
        const existing = body?.id ? this.comments.get(String(body.id)) : undefined;
        if (existing) return json(200, { data: existing });
        const stamp = this.tick();
        const comment: TaskComment = { id: String(body?.id ?? `srv-comment-${this.comments.size + 1}`), taskId, body: String(body?.body), createdAt: stamp, updatedAt: stamp };
        this.comments.set(comment.id, comment);
        return json(201, { data: comment });
      }
      if (method === "DELETE" && commentsMatch[2]) {
        const comment = this.comments.get(decodeURIComponent(commentsMatch[2]));
        if (!comment) return json(404, { error: { code: "NOT_FOUND", message: "Comment not found" } });
        this.comments.delete(comment.id);
        return json(200, { data: comment });
      }
    }
    return null;
  }
}
