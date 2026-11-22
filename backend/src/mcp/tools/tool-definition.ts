import type { z, ZodRawShape } from "zod";
import type { McpDomainStores, ToolContext } from "./tool-kit";

/** A Jotly MCP tool: schema + handler returning plain JSON. Registration adds auth meta, audit and limits. */
export type McpTool<Shape extends ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  /** Write tools count against the daily write quota. */
  write: boolean;
  handler(args: z.objectOutputType<Shape, z.ZodTypeAny>, ctx: ToolContext, stores: McpDomainStores): Promise<object>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMcpTool = McpTool<any>;
