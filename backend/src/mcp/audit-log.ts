import { PrismaClient } from "@prisma/client";

/** One line per tool call: who, which tool, outcome, duration. Never the content. */
export type McpAuditEntry = {
  email: string | null;
  clientId: string | null;
  tool: string;
  status: string;
  durationMs: number;
  argKeys: string[];
  targetId: string | null;
};

export type McpAuditStore = {
  record(entry: McpAuditEntry): Promise<void>;
  close?: () => Promise<void>;
};

export function createPrismaMcpAuditStore(prisma = new PrismaClient()): McpAuditStore {
  return {
    async record(entry) {
      await prisma.mcpAuditLog.create({ data: entry });
    },
    async close() {
      await prisma.$disconnect();
    },
  };
}

export class InMemoryMcpAuditStore implements McpAuditStore {
  readonly entries: McpAuditEntry[] = [];

  async record(entry: McpAuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}
