import { isSpotterError } from "@spotterjs/base";
import { ZodError, type ZodIssue } from "zod";
import type { CommandConfig, CommandRegistry } from "../registry.js";

export type CommandResult = {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code?: string;
    domain?: string;
    hint?: string;
    context?: unknown;
  };
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

function formatZodIssue(issue: ZodIssue): string {
  const path = issue.path.join(".");
  if (issue.code === "unrecognized_keys") {
    const detail = `Unexpected field(s): ${issue.keys.join(", ")}`;
    return path ? `${path}: ${detail}` : detail;
  }
  return path ? `${path}: ${issue.message}` : issue.message;
}

export function formatZodError(name: string, error: ZodError): CommandResult {
  const formatted = error.issues.map(formatZodIssue);
  return {
    success: false,
    error: {
      message: `${name} failed: invalid arguments (${formatted.join("; ")})`,
      code: "SPOTTER_CLI_INVALID_ARGUMENTS",
      domain: "cli",
      hint: `Run "spotterjs schema ${name}" to inspect the expected JSON input schema.`,
      context: {
        issues: error.issues.slice(0, 5).map((issue) => ({
          path: issue.path.join(".") || "(root)",
          message:
            issue.code === "unrecognized_keys"
              ? `Unexpected field(s): ${issue.keys.join(", ")}`
              : issue.message,
        })),
      },
    },
  };
}

/** Preserve stable native error codes and concise diagnostic context. */
export function errorResult(name: string, error: unknown): CommandResult {
  if (error instanceof ZodError) {
    return formatZodError(name, error);
  }
  const message = error instanceof Error ? error.message : String(error);
  const spotterError = isSpotterError(error) ? error : undefined;
  return {
    success: false,
    error: {
      message: `${name} failed: ${message}`,
      ...(spotterError?.code ? { code: spotterError.code } : {}),
      ...(spotterError?.domain ? { domain: spotterError.domain } : {}),
      ...(spotterError?.hint ? { hint: spotterError.hint } : {}),
      ...(spotterError?.context === undefined ? {} : { context: summarizeContext(spotterError.context) }),
    },
  };
}

/** Format top-level CLI parsing, JSON, and file-loading errors consistently. */
export function cliErrorResult(error: unknown): CommandResult {
  if (error instanceof ZodError) {
    return formatZodError("spotterjs", error);
  }
  if (isSpotterError(error)) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        ...(error.domain ? { domain: error.domain } : {}),
        ...(error.hint ? { hint: error.hint } : {}),
        ...(error.context === undefined ? {} : { context: summarizeContext(error.context) }),
      },
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;

  if (error instanceof SyntaxError) {
    return {
      success: false,
      error: {
        message: `Invalid JSON input: ${message}`,
        code: "SPOTTER_CLI_INVALID_JSON",
        domain: "cli",
        hint: "Pass valid JSON, or use --file PATH or --stdin for multiline/Unicode text to avoid shell quoting issues.",
      },
    };
  }
  if (code?.startsWith("ERR_PARSE_ARGS_")) {
    return {
      success: false,
      error: {
        message,
        code: "SPOTTER_CLI_INVALID_ARGS",
        domain: "cli",
        hint: 'Run "spotterjs --help" to inspect supported CLI flags and commands.',
      },
    };
  }
  if (code === "ENOENT") {
    return {
      success: false,
      error: {
        message,
        code: "SPOTTER_CLI_FILE_NOT_FOUND",
        domain: "cli",
        hint: "Verify that the specified file path exists and is readable.",
      },
    };
  }
  return {
    success: false,
    error: { message },
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
