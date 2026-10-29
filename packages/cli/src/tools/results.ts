import { isSpotterError } from "@spotterjs/base";
import type { CommandConfig, CommandRegistry } from "../registry.js";

export type CommandResult = {
  success: boolean;
  data?: any;
  error?: { message: string; code?: string; domain?: string; context?: unknown };
};
export type ToolResult = CommandResult;

/** Return a plain text command result. */
export function ok(text = "ok"): CommandResult {
  return { success: true, data: text };
}

/** Return structured command data without encoding it as a JSON string. */
export function json(data: unknown): CommandResult {
  return { success: true, data };
}

/** Preserve stable native error codes and concise diagnostic context. */
export function errorResult(name: string, error: unknown): CommandResult {
  const message = error instanceof Error ? error.message : String(error);
  const spotterError = isSpotterError(error) ? error : undefined;
  return {
    success: false,
    error: {
      message: `${name} failed: ${message}`,
      ...(spotterError?.code ? { code: spotterError.code } : {}),
      ...(spotterError?.domain ? { domain: spotterError.domain } : {}),
      ...(spotterError?.context === undefined ? {} : { context: summarizeContext(spotterError.context) }),
    },
  };
}

function summarizeContext(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "string") return value.length > 180 ? `${value.slice(0, 177)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 5).map((item) => summarizeContext(item, depth + 1));
  if (typeof value === "object") {
    if (depth >= 2) return "[object]";
    return Object.fromEntries(Object.entries(value).slice(0, 12).map(([key, item]) => [key, summarizeContext(item, depth + 1)]));
  }
  return String(value);
}

/** Register a local command and convert thrown operational errors to results. */
export function registerSafeTool<T = any>(
  registry: CommandRegistry,
  name: string,
  config: CommandConfig,
  handler: (args: T, context?: { signal?: AbortSignal }) => Promise<CommandResult> | CommandResult
): void {
  registry.registerTool(name, config, async (args: T, context) => {
    try { return await handler(args, context); } catch (error) { return errorResult(name, error); }
  });
}

/** Keep focus, input and connected Android sessions together in one process. */
export function registerSequenceTool(registry: CommandRegistry): void {
  registry.registerSequence();
}
