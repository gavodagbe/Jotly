import { buildApp } from "./app";
import { getEnv } from "./config/env";

async function start(): Promise<void> {
  const env = getEnv();
  const app = buildApp({
    logLevel: env.LOG_LEVEL,
    authSessionTtlHours: env.AUTH_SESSION_TTL_HOURS
  });

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error(error, "Unable to start backend server");
    process.exit(1);
  }
}

void start();
