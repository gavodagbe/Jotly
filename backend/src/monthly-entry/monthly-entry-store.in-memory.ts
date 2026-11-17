/** In-memory MonthlyEntryStore for route tests. */
import { MonthlyEntry } from "@prisma/client";
import { MonthlyEntryStore, MonthlyEntryUpsertInput } from "./monthly-entry-store";

export class InMemoryMonthlyEntryStore implements MonthlyEntryStore {
  private readonly entries = new Map<string, MonthlyEntry>();
  private idCounter = 1;

  private key(userId: string, year: number, month: number): string {
    return `${userId}:${year}:${month}`;
  }

  async getByMonth(year: number, month: number, userId: string): Promise<MonthlyEntry | null> {
    return this.entries.get(this.key(userId, year, month)) ?? null;
  }

  async listByUser(userId: string): Promise<MonthlyEntry[]> {
    return [...this.entries.values()].filter((entry) => entry.userId === userId);
  }

  async upsert(input: MonthlyEntryUpsertInput): Promise<MonthlyEntry> {
    const key = this.key(input.userId, input.year, input.month);
    const existing = this.entries.get(key);
    const now = new Date();
    const entry: MonthlyEntry = {
      id: existing?.id ?? `monthly-${this.idCounter++}`,
      userId: input.userId,
      year: input.year,
      month: input.month,
      objective: input.objective !== undefined ? input.objective : existing?.objective ?? null,
      review: input.review !== undefined ? input.review : existing?.review ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.entries.set(key, entry);
    return entry;
  }
}
