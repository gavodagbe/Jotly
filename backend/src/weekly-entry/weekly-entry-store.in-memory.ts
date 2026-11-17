/** In-memory WeeklyEntryStore for route tests. */
import { WeeklyEntry } from "@prisma/client";
import { WeeklyEntryStore, WeeklyEntryUpsertInput } from "./weekly-entry-store";

export class InMemoryWeeklyEntryStore implements WeeklyEntryStore {
  private readonly entries = new Map<string, WeeklyEntry>();
  private idCounter = 1;

  private key(userId: string, year: number, isoWeek: number): string {
    return `${userId}:${year}:${isoWeek}`;
  }

  async getByWeek(year: number, isoWeek: number, userId: string): Promise<WeeklyEntry | null> {
    return this.entries.get(this.key(userId, year, isoWeek)) ?? null;
  }

  async listByUser(userId: string): Promise<WeeklyEntry[]> {
    return [...this.entries.values()].filter((entry) => entry.userId === userId);
  }

  async upsert(input: WeeklyEntryUpsertInput): Promise<WeeklyEntry> {
    const key = this.key(input.userId, input.year, input.isoWeek);
    const existing = this.entries.get(key);
    const now = new Date();
    const entry: WeeklyEntry = {
      id: existing?.id ?? `weekly-${this.idCounter++}`,
      userId: input.userId,
      year: input.year,
      isoWeek: input.isoWeek,
      objective: input.objective !== undefined ? input.objective : existing?.objective ?? null,
      review: input.review !== undefined ? input.review : existing?.review ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.entries.set(key, entry);
    return entry;
  }
}
