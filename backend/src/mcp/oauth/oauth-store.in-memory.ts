import {
  McpAuthCodeRecord,
  McpAuthRequestRecord,
  McpOAuthClientRecord,
  McpOAuthStore,
  McpTokenRecord,
} from "./oauth-store";

/** Test double mirroring the Prisma store (keys are plain strings, "/" allowed). */
export class InMemoryMcpOAuthStore implements McpOAuthStore {
  readonly clients = new Map<string, McpOAuthClientRecord>();
  readonly requests = new Map<string, McpAuthRequestRecord>();
  readonly codes = new Map<string, McpAuthCodeRecord>();
  readonly tokens = new Map<string, McpTokenRecord>();
  private counter = 1;

  async upsertClient(client: Omit<McpOAuthClientRecord, "updatedAt">): Promise<McpOAuthClientRecord> {
    const record = { ...client, updatedAt: new Date() };
    this.clients.set(client.clientId, record);
    return record;
  }

  async getClient(clientId: string): Promise<McpOAuthClientRecord | null> {
    return this.clients.get(clientId) ?? null;
  }

  async createAuthRequest(input: Omit<McpAuthRequestRecord, "id">): Promise<McpAuthRequestRecord> {
    const record = { ...input, id: `req-${this.counter++}` };
    this.requests.set(record.id, record);
    return record;
  }

  async getAuthRequestByStateHash(stateHash: string): Promise<McpAuthRequestRecord | null> {
    return [...this.requests.values()].find((request) => request.stateHash === stateHash) ?? null;
  }

  async updateAuthRequest(
    id: string,
    patch: Partial<Pick<McpAuthRequestRecord, "email" | "consentCsrfHash">>
  ): Promise<void> {
    const existing = this.requests.get(id);
    if (existing) {
      this.requests.set(id, { ...existing, ...patch });
    }
  }

  async deleteAuthRequest(id: string): Promise<void> {
    this.requests.delete(id);
  }

  async createAuthCode(input: Omit<McpAuthCodeRecord, "usedAt">): Promise<void> {
    this.codes.set(input.codeHash, { ...input, usedAt: null });
  }

  async consumeAuthCode(codeHash: string, now: Date): Promise<McpAuthCodeRecord | null> {
    const existing = this.codes.get(codeHash);
    if (!existing || existing.usedAt) {
      return null;
    }
    const used = { ...existing, usedAt: now };
    this.codes.set(codeHash, used);
    return used;
  }

  async createToken(input: Omit<McpTokenRecord, "id" | "revokedAt">): Promise<McpTokenRecord> {
    const record = { ...input, id: `tok-${this.counter++}`, revokedAt: null };
    this.tokens.set(record.id, record);
    return record;
  }

  async getTokenByHash(tokenHash: string): Promise<McpTokenRecord | null> {
    return [...this.tokens.values()].find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async revokeToken(id: string, now: Date): Promise<void> {
    const existing = this.tokens.get(id);
    if (existing && !existing.revokedAt) {
      this.tokens.set(id, { ...existing, revokedAt: now });
    }
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.familyId === familyId && !token.revokedAt) {
        this.tokens.set(token.id, { ...token, revokedAt: now });
      }
    }
  }

  async deleteExpired(now: Date): Promise<void> {
    for (const map of [this.requests, this.codes, this.tokens] as Map<string, { expiresAt: Date }>[]) {
      for (const [key, value] of map) {
        if (value.expiresAt < now) {
          map.delete(key);
        }
      }
    }
  }
}
