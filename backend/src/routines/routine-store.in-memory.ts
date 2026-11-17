/** In-memory RoutineStore for route tests (mirrors the Prisma store, incl. client-provided ids). */
import {
  DEFAULT_CEO_ROUTINES,
  RoutineCompletionRecord,
  RoutineCompletionUpsertInput,
  RoutineCreateInput,
  RoutineStore,
  RoutineTemplateRecord,
  RoutineUpdateInput,
} from "./routine-store";
import { formatDateOnly } from "../tasks/task-store";

export class InMemoryRoutineStore implements RoutineStore {
  private readonly routines = new Map<string, RoutineTemplateRecord>();
  private readonly completions = new Map<string, RoutineCompletionRecord>();
  private routineCounter = 1;
  private completionCounter = 1;

  async ensureDefaults(userId: string): Promise<void> {
    if ([...this.routines.values()].some((routine) => routine.userId === userId)) return;
    for (const routine of DEFAULT_CEO_ROUTINES) {
      await this.createTemplate({ ...routine, userId });
    }
  }

  async listTemplates(userId: string, includeInactive = false): Promise<RoutineTemplateRecord[]> {
    return [...this.routines.values()]
      .filter((routine) => routine.userId === userId && (includeInactive || routine.isActive))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async getTemplate(id: string, userId: string): Promise<RoutineTemplateRecord | null> {
    const routine = this.routines.get(id);
    return routine?.userId === userId ? routine : null;
  }

  async createTemplate(input: RoutineCreateInput): Promise<RoutineTemplateRecord> {
    if (input.id && this.routines.has(input.id)) {
      throw { code: "P2002" };
    }
    const now = new Date();
    const routine: RoutineTemplateRecord = {
      id: input.id ?? `routine-${this.routineCounter++}`,
      userId: input.userId,
      challenge: input.challenge,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      title: input.title,
      sortOrder: input.sortOrder ?? this.routineCounter * 10,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.routines.set(routine.id, routine);
    return routine;
  }

  async updateTemplate(id: string, userId: string, input: RoutineUpdateInput): Promise<RoutineTemplateRecord | null> {
    const existing = await this.getTemplate(id, userId);
    if (!existing) return null;
    const updated: RoutineTemplateRecord = { ...existing, ...input, updatedAt: new Date() };
    this.routines.set(id, updated);
    return updated;
  }

  async removeTemplate(id: string, userId: string): Promise<RoutineTemplateRecord | null> {
    return this.updateTemplate(id, userId, { isActive: false });
  }

  async listCompletionsForRange(userId: string, startDate: Date, endExclusive: Date): Promise<RoutineCompletionRecord[]> {
    return [...this.completions.values()].filter(
      (completion) =>
        completion.userId === userId &&
        completion.targetDate.getTime() >= startDate.getTime() &&
        completion.targetDate.getTime() < endExclusive.getTime()
    );
  }

  async upsertCompletion(input: RoutineCompletionUpsertInput): Promise<RoutineCompletionRecord | null> {
    const routine = this.routines.get(input.routineId);
    if (!routine || routine.userId !== input.userId || !routine.isActive) return null;
    const key = `${input.routineId}:${formatDateOnly(input.targetDate)}`;
    const existing = this.completions.get(key);
    const now = new Date();
    const completion: RoutineCompletionRecord = {
      id: existing?.id ?? `completion-${this.completionCounter++}`,
      userId: input.userId,
      routineId: input.routineId,
      targetDate: input.targetDate,
      isCompleted: input.isCompleted,
      completedAt: input.isCompleted ? now : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.completions.set(key, completion);
    return completion;
  }
}
