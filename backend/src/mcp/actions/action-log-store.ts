import { Prisma, PrismaClient } from "@prisma/client";
import { ActionChange } from "./snapshots";

export type McpActionRecord = {
  id: string;
  userId: string;
  clientId: string | null;
  tool: string;
  changes: ActionChange[];
  createdAt: Date;
  undoneAt: Date | null;
};

export type McpActionLogStore = {
  create(input: { userId: string; clientId: string | null; tool: string; changes: ActionChange[] }): Promise<string>;
  get(id: string, userId: string): Promise<McpActionRecord | null>;
  /** Atomically marks the action undone; false if it was already undone. */
  markUndone(id: string, now: Date): Promise<boolean>;
  purgeBefore(date: Date): Promise<void>;
  close?: () => Promise<void>;
};

export function createPrismaMcpActionLogStore(prisma = new PrismaClient()): McpActionLogStore {
  return {
    async create(input) {
      const row = await prisma.mcpActionLog.create({
        data: { ...input, changes: input.changes as unknown as Prisma.InputJsonValue },
      });
      return row.id;
    },

    async get(id, userId) {
      const row = await prisma.mcpActionLog.findFirst({ where: { id, userId } });
      return row ? { ...row, changes: row.changes as unknown as ActionChange[] } : null;
    },

    async markUndone(id, now) {
      const result = await prisma.mcpActionLog.updateMany({ where: { id, undoneAt: null }, data: { undoneAt: now } });
      return result.count === 1;
    },

    async purgeBefore(date) {
      await prisma.mcpActionLog.deleteMany({ where: { createdAt: { lt: date } } });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}

export class InMemoryMcpActionLogStore implements McpActionLogStore {
  readonly records = new Map<string, McpActionRecord>();
  private counter = 1;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async create(input: { userId: string; clientId: string | null; tool: string; changes: ActionChange[] }) {
    const id = `action-${this.counter++}`;
    // Round-trip through JSON like the database does.
    const changes = JSON.parse(JSON.stringify(input.changes)) as ActionChange[];
    this.records.set(id, { ...input, id, changes, createdAt: this.now(), undoneAt: null });
    return id;
  }

  async get(id: string, userId: string) {
    const record = this.records.get(id);
    return record && record.userId === userId ? record : null;
  }

  async markUndone(id: string, now: Date) {
    const record = this.records.get(id);
    if (!record || record.undoneAt) return false;
    this.records.set(id, { ...record, undoneAt: now });
    return true;
  }

  async purgeBefore(date: Date) {
    for (const [id, record] of this.records) {
      if (record.createdAt < date) this.records.delete(id);
    }
  }
}
