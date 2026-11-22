import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { McpActionLogStore } from "./actions/action-log-store";
import { McpAuditStore } from "./audit-log";
import { McpConfig } from "./mcp-config";
import { buildMcpServer, McpReindex } from "./mcp-server";
import { BearerGuard } from "./oauth/bearer-guard";
import { DailyQuota, TokenBucketLimiter } from "./rate-limit";
import { McpDomainStores } from "./tools/tool-kit";

export type McpRouteOptions = {
  config: McpConfig;
  guard: BearerGuard;
  stores: McpDomainStores;
  auditStore: McpAuditStore;
  actionLog: McpActionLogStore;
  reindex?: McpReindex;
  now?: () => Date;
};

/** POST /mcp — Streamable HTTP, stateless (one server + transport per request, JSON responses). */
export function registerMcpRoute(app: FastifyInstance, options: McpRouteOptions): void {
  const { config, guard } = options;
  const callLimiter = new TokenBucketLimiter(config.rateLimitPerSecond, config.rateLimitBurst);
  const writeQuota = new DailyQuota(config.dailyWriteLimit);

  app.post("/mcp", async (request, reply) => {
    const auth = await guard.verify(request.headers.authorization);
    if (!auth.ok) {
      return guard.refuse(request, reply, auth.reason);
    }

    const server = buildMcpServer(auth.context, {
      stores: options.stores,
      auditStore: options.auditStore,
      actionLog: options.actionLog,
      reindex: options.reindex,
      callLimiter,
      writeQuota,
      log: request.log,
      now: options.now,
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });

    reply.hijack();
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
      request.log.error({ err: error }, "MCP request failed");
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "content-type": "application/json" });
        reply.raw.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }));
      }
    }
  });

  // Stateless server: no SSE stream to resume, no session to delete. Unauthenticated probes still get the 401.
  const notAllowed = async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await guard.verify(request.headers.authorization);
    if (!auth.ok) return guard.refuse(request, reply, auth.reason);
    return reply.code(405).header("allow", "POST").send({ error: "method_not_allowed" });
  };
  app.get("/mcp", notAllowed);
  app.delete("/mcp", notAllowed);
}
