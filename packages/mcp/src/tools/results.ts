import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** Return a plain text success result for an MCP tool. */
export function ok(text = "ok"): ToolResult {
  return { content: [{ type: "text", text }] };
}

/** Return a pretty-printed JSON text result for an MCP tool. */
export function json(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** Convert a thrown error into a structured MCP tool error result. */
export function errorResult(toolName: string, error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  const code = errorCode(error);
  const context = errorContext(error);
  const details = [
    code ? `code=${code}` : undefined,
    context ? `context=${JSON.stringify(context)}` : undefined,
  ].filter(Boolean);
  const suffix = details.length ? ` (${details.join(" ")})` : "";
  return {
    content: [{ type: "text", text: `${toolName} failed: ${message}${suffix}` }],
    isError: true,
  };
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function errorContext(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("context" in error)) return undefined;
  return summarizeContext((error as { context?: unknown }).context);
}

function summarizeContext(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "string") {
    return value.length > 180 ? `${value.slice(0, 177)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => summarizeContext(item, depth + 1));
  }
  if (typeof value === "object") {
    if (depth >= 2) return "[object]";
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 12)) {
      out[key] = summarizeContext(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Register an MCP tool and convert thrown errors into error results. */
export function registerSafeTool<T = any>(
  server: McpServer,
  name: string,
  config: { description?: string; inputSchema?: z.ZodRawShape | z.ZodObject<any> },
  handler: (args: T) => Promise<ToolResult> | ToolResult
): void {
  server.registerTool(name, config as never, async (args) => {
    try {
      return await handler(args as T);
    } catch (error) {
      return errorResult(name, error);
    }
  });
}
