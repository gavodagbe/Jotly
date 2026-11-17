/** In-memory DayBilanStore for route tests. */
import { DayBilan } from "@prisma/client";
import { formatDateOnly } from "../tasks/task-store";
import { DayBilanStore, DayBilanUpsertInput } from "./day-bilan-store";

export class InMemoryDayBilanStore implements DayBilanStore {
  private readonly bilans = new Map<string, DayBilan>();
  private idCounter = 1;

  async getByDate(targetDate: Date, userId: string): Promise<DayBilan | null> {
    const key = `${userId}:${formatDateOnly(targetDate)}`;
    return this.bilans.get(key) ?? null;
  }

  async upsert(input: DayBilanUpsertInput): Promise<DayBilan> {
    const key = `${input.userId}:${formatDateOnly(input.targetDate)}`;
    const now = new Date();
    const existing = this.bilans.get(key);

    const nextValue: DayBilan = {
      id: existing?.id ?? `day-bilan-${this.idCounter++}`,
      userId: input.userId,
      targetDate: input.targetDate,
      mood: input.mood,
      wins: input.wins,
      blockers: input.blockers,
      lessonsLearned: input.lessonsLearned,
      tomorrowTop3: input.tomorrowTop3,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.bilans.set(key, nextValue);
    return nextValue;
  }
}
