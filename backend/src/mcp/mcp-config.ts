import { z } from "zod";

/**
 * Configuration of the MCP server (LLM access to Jotly).
 * Everything comes from environment variables; nothing user-specific is hard-coded.
 */
export type McpConfig = {
  /** Public origin, e.g. https://jotly.godwinavodagbe.com (no trailing slash). */
  baseUrl: string;
  /** Protected resource URL advertised to clients: `${baseUrl}/mcp`. */
  resourceUrl: string;
  /** Google accounts allowed to connect (lower-cased). */
  allowedEmails: Set<string>;
  /** Jotly account every MCP call acts as. */
  jotlyUserEmail: string;
  /** Exact redirect URIs, or prefixes when ending with `*`. */
  allowedRedirectUris: string[];
  /** Hosts allowed to serve Client ID Metadata Documents. */
  cimdAllowedHosts: Set<string>;
  googleClientId: string;
  googleClientSecret: string;
  rateLimitPerSecond: number;
  rateLimitBurst: number;
  dailyWriteLimit: number;
};

export const MCP_SCOPE = "jotly";

const csv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().min(1).optional()
);

const rawSchema = z.object({
  MCP_ENABLED: z.string().optional(),
  MCP_BASE_URL: optionalString,
  MCP_ALLOWED_EMAILS: z.string().optional(),
  MCP_JOTLY_USER_EMAIL: optionalString,
  MCP_ALLOWED_REDIRECT_URIS: z.string().optional(),
  MCP_CIMD_ALLOWED_HOSTS: z.string().optional(),
  MCP_GOOGLE_CLIENT_ID: optionalString,
  MCP_GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  MCP_RATE_LIMIT_PER_SECOND: z.coerce.number().positive().default(3),
  MCP_RATE_LIMIT_BURST: z.coerce.number().int().positive().default(30),
  MCP_DAILY_WRITE_LIMIT: z.coerce.number().int().positive().default(100),
});

/**
 * Returns null when the MCP server is disabled. Throws when it is enabled but
 * misconfigured, so the backend refuses to start rather than run half-open.
 */
export function loadMcpConfig(env: NodeJS.ProcessEnv): McpConfig | null {
  const raw = rawSchema.parse(env);

  if (!["true", "1"].includes((raw.MCP_ENABLED ?? "").trim().toLowerCase())) {
    return null;
  }

  const problems: string[] = [];
  const baseUrl = (raw.MCP_BASE_URL ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+$/.test(baseUrl)) {
    problems.push("MCP_BASE_URL must be an origin such as https://jotly.example.com");
  }

  const allowedEmails = new Set(csv(raw.MCP_ALLOWED_EMAILS).map((email) => email.toLowerCase()));
  if (allowedEmails.size === 0) {
    problems.push("MCP_ALLOWED_EMAILS is empty: nobody could connect");
  }

  const jotlyUserEmail = (raw.MCP_JOTLY_USER_EMAIL ?? "").trim().toLowerCase();
  if (!jotlyUserEmail) {
    problems.push("MCP_JOTLY_USER_EMAIL is required");
  }

  const allowedRedirectUris = csv(raw.MCP_ALLOWED_REDIRECT_URIS);
  if (allowedRedirectUris.length === 0) {
    problems.push("MCP_ALLOWED_REDIRECT_URIS is empty: no client could complete OAuth");
  }

  const googleClientId = raw.MCP_GOOGLE_CLIENT_ID ?? raw.GOOGLE_CLIENT_ID ?? "";
  const googleClientSecret = raw.MCP_GOOGLE_CLIENT_SECRET ?? raw.GOOGLE_CLIENT_SECRET ?? "";
  if (!googleClientId || !googleClientSecret) {
    problems.push("MCP_GOOGLE_CLIENT_ID/SECRET (or GOOGLE_CLIENT_ID/SECRET) are required");
  }

  if (problems.length > 0) {
    throw new Error(`Invalid MCP configuration: ${problems.join("; ")}`);
  }

  const cimdHosts = csv(raw.MCP_CIMD_ALLOWED_HOSTS ?? "claude.ai,chatgpt.com");

  return {
    baseUrl,
    resourceUrl: `${baseUrl}/mcp`,
    allowedEmails,
    jotlyUserEmail,
    allowedRedirectUris,
    cimdAllowedHosts: new Set(cimdHosts.map((host) => host.toLowerCase())),
    googleClientId,
    googleClientSecret,
    rateLimitPerSecond: raw.MCP_RATE_LIMIT_PER_SECOND,
    rateLimitBurst: raw.MCP_RATE_LIMIT_BURST,
    dailyWriteLimit: raw.MCP_DAILY_WRITE_LIMIT,
  };
}

export function isRedirectUriAllowed(config: Pick<McpConfig, "allowedRedirectUris">, uri: string): boolean {
  return config.allowedRedirectUris.some((allowed) =>
    allowed.endsWith("*") ? uri.startsWith(allowed.slice(0, -1)) : uri === allowed
  );
}
