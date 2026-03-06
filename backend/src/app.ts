import Fastify, { FastifyInstance } from "fastify";
import healthRoutes from "./routes/health";

export type BuildAppOptions = {
  logLevel: string;
};

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: {
      level: options.logLevel
    }
  });

  app.register(healthRoutes);

  return app;
}
