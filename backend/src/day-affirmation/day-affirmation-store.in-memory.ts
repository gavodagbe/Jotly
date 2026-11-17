/** In-memory DayAffirmationStore for route tests. */
import { DayAffirmation } from "@prisma/client";
import { formatDateOnly } from "../tasks/task-store";
import { DayAffirmationStore, DayAffirmationUpsertInput } from "./day-affirmation-store";

export class InMemoryDayAffirmationStore implements DayAffirmationStore {
  private readonly affirmations = new Map<string, DayAffirmation>();
  private idCounter = 1;

  async getByDate(targetDate: Date, userId: string): Promise<DayAffirmation | null> {
    const key = `${userId}:${formatDateOnly(targetDate)}`;
    return this.affirmations.get(key) ?? null;
  }

  async upsert(input: DayAffirmationUpsertInput): Promise<DayAffirmation> {
    const key = `${input.userId}:${formatDateOnly(input.targetDate)}`;
    const now = new Date();
    const existing = this.affirmations.get(key);

    const nextValue: DayAffirmation = {
      id: existing?.id ?? `day-affirmation-${this.idCounter++}`,
      userId: input.userId,
      targetDate: input.targetDate,
      text: input.text,
      isCompleted: input.isCompleted,
      completedAt: input.completedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.affirmations.set(key, nextValue);
    return nextValue;
  }
}
