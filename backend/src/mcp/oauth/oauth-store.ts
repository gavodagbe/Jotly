import { PrismaClient } from "@prisma/client";

export type McpOAuthClientRecord = {
  clientId: string;
  clientSecretHash: string | null;
  clientName: string | null;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
  jwksUri: string | null;
  isMetadataDocument: boolean;
  updatedAt: Date;
};

export type McpAuthRequestRecord = {
  id: string;
  stateHash: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  clientState: string | null;
  scope: string;
  resource: string | null;
  googleCodeVerifier: string;
  email: string | null;
  consentCsrfHash: string | null;
  expiresAt: Date;
};

export type McpAuthCodeRecord = {
  codeHash: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string | null;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type McpTokenKind = "access" | "refresh";

export type McpTokenRecord = {
  id: string;
  tokenHash: string;
  kind: McpTokenKind;
  familyId: string;
  clientId: string;
  email: string;
  scope: string;
  resource: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type McpOAuthStore = {
  upsertClient(client: Omit<McpOAuthClientRecord, "updatedAt">): Promise<McpOAuthClientRecord>;
  getClient(clientId: string): Promise<McpOAuthClientRecord | null>;

  createAuthRequest(input: Omit<McpAuthRequestRecord, "id">): Promise<McpAuthRequestRecord>;
  getAuthRequestByStateHash(stateHash: string): Promise<McpAuthRequestRecord | null>;
  updateAuthRequest(
    id: string,
    patch: Partial<Pick<McpAuthRequestRecord, "email" | "consentCsrfHash">>
  ): Promise<void>;
  deleteAuthRequest(id: string): Promise<void>;

  createAuthCode(input: Omit<McpAuthCodeRecord, "usedAt">): Promise<void>;
  /** Atomically marks the code used; returns null if unknown or already used. */
  consumeAuthCode(codeHash: string, now: Date): Promise<McpAuthCodeRecord | null>;

  createToken(input: Omit<McpTokenRecord, "id" | "revokedAt">): Promise<McpTokenRecord>;
  getTokenByHash(tokenHash: string): Promise<McpTokenRecord | null>;
  revokeToken(id: string, now: Date): Promise<void>;
  revokeFamily(familyId: string, now: Date): Promise<void>;

  deleteExpired(now: Date): Promise<void>;
  close?: () => Promise<void>;
};

function toTokenRecord(row: {
  id: string;
  tokenHash: string;
  kind: string;
  familyId: string;
  clientId: string;
  email: string;
  scope: string;
  resource: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
}): McpTokenRecord {
  return { ...row, kind: row.kind === "refresh" ? "refresh" : "access" };
}

export function createPrismaMcpOAuthStore(prisma = new PrismaClient()): McpOAuthStore {
  return {
    async upsertClient(client) {
      const { clientId, ...data } = client;
      return prisma.mcpOAuthClient.upsert({
        where: { clientId },
        create: client,
        update: data,
      });
    },

    async getClient(clientId) {
      return prisma.mcpOAuthClient.findUnique({ where: { clientId } });
    },

    async createAuthRequest(input) {
      return prisma.mcpAuthRequest.create({ data: input });
    },

    async getAuthRequestByStateHash(stateHash) {
      return prisma.mcpAuthRequest.findUnique({ where: { stateHash } });
    },

    async updateAuthRequest(id, patch) {
      await prisma.mcpAuthRequest.update({ where: { id }, data: patch });
    },

    async deleteAuthRequest(id) {
      await prisma.mcpAuthRequest.deleteMany({ where: { id } });
    },

    async createAuthCode(input) {
      await prisma.mcpAuthCode.create({ data: input });
    },

    async consumeAuthCode(codeHash, now) {
      const result = await prisma.mcpAuthCode.updateMany({
        where: { codeHash, usedAt: null },
        data: { usedAt: now },
      });
      if (result.count !== 1) {
        return null;
      }
      return prisma.mcpAuthCode.findUnique({ where: { codeHash } });
    },

    async createToken(input) {
      return toTokenRecord(await prisma.mcpToken.create({ data: input }));
    },

    async getTokenByHash(tokenHash) {
      const row = await prisma.mcpToken.findUnique({ where: { tokenHash } });
      return row ? toTokenRecord(row) : null;
    },

    async revokeToken(id, now) {
      await prisma.mcpToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
    },

    async revokeFamily(familyId, now) {
      await prisma.mcpToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
    },

    async deleteExpired(now) {
      await prisma.$transaction([
        prisma.mcpAuthRequest.deleteMany({ where: { expiresAt: { lt: now } } }),
        prisma.mcpAuthCode.deleteMany({ where: { expiresAt: { lt: now } } }),
        prisma.mcpToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      ]);
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
