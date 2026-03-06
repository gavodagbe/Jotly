import { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/health", async () => ({
    status: "ok"
  }));
};

export default healthRoutes;
