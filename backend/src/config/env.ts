import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/jotly"),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 365).default(24 * 7),
  AI_ASSISTANT_PROVIDER: z.enum(["heuristic", "openai"]).default("heuristic"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  OPENAI_API_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_ASSISTANT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info")
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsedEnv = envSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    const details = parsedEnv.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cachedEnv = parsedEnv.data;
  return cachedEnv;
}
