import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { workerQueue } from "./execution.js";
import { errorResult, json, type CommandResult } from "./tools/results.js";

export type CommandConfig = {
  description?: string;
  inputSchema?: z.ZodRawShape | z.ZodTypeAny;
};
export type CommandHandler = (
  args: any,
  context?: { signal?: AbortSignal }
) => CommandResult | Promise<CommandResult>;
export type CommandStep = { name: string; arguments?: Record<string, unknown> };
type CommandEntry = {
  description?: string;
  schema: z.ZodTypeAny;
  handler: CommandHandler;
};

/** In-process commands with argument validation and one serialized desktop queue. */
export class CommandRegistry {
  private readonly entries = new Map<string, CommandEntry>();
  private readonly cleanups: Array<() => void | Promise<void>> = [];
  private closed = false;

  registerTool(name: string, config: CommandConfig, handler: CommandHandler): void {
    if (this.closed) throw new Error("Command registry is closed");
    if (!name || this.entries.has(name)) throw new Error(`Duplicate or empty command: ${name}`);
    const schema = config.inputSchema instanceof z.ZodObject
      ? config.inputSchema.strict()
      : config.inputSchema instanceof z.ZodType
        ? config.inputSchema
        : z.object(config.inputSchema ?? {}).strict();
    this.entries.set(name, { description: config.description, schema, handler });
  }

  list() {
    return [...this.entries].map(([name, entry]) => ({
      name,
      description: entry.description,
      inputSchema: zodToJsonSchema(entry.schema, { $refStrategy: "none" }),
    }));
  }

  registerCleanup(cleanup: () => void | Promise<void>): void {
    if (this.closed) throw new Error("Command registry is closed");
    this.cleanups.push(cleanup);
  }

  private prepare(name: string, args: unknown) {
    if (this.closed) throw new Error("Command registry is closed");
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`Unknown command: ${name}`);
    return { name, handler: entry.handler, args: entry.schema.parse(args) };
  }

  execute(name: string, args: unknown = {}, signal?: AbortSignal): Promise<CommandResult> {
    return workerQueue.run(async () => {
      try {
        if (signal?.aborted) throw new Error("Command cancelled before execution");
        const prepared = this.prepare(name, args);
        return await prepared.handler(prepared.args, { signal });
      } catch (error) {
        return errorResult(name, error);
      }
    });
  }

  registerSequence(): void {
    this.registerTool("spotter_run_sequence", {
      description: "Run up to 100 commands in order. Validate the entire plan first and stop at the first failure; completed actions are not rolled back or retried.",
      inputSchema: {
        steps: z.array(z.object({
          name: z.string().min(1),
          arguments: z.record(z.unknown()).optional(),
        }).strict()).min(1).max(100),
      },
    }, ({ steps }, context) => this.runSequence(steps, context?.signal));
  }

  /** Called only while execute() already holds the queue. */
  private async runSequence(steps: CommandStep[], signal?: AbortSignal): Promise<CommandResult> {
    let prepared;
    try {
      prepared = steps.map((step) => {
        if (step.name === "spotter_run_sequence") throw new Error("Nested sequences are not supported");
        return this.prepare(step.name, step.arguments ?? {});
      });
    } catch (error) {
      return errorResult("spotter_run_sequence", error);
    }
    const results: Array<{ name: string; result: CommandResult }> = [];
    for (const step of prepared) {
      let result: CommandResult;
      try {
        if (signal?.aborted) throw new Error("Sequence cancelled before next action");
        result = await step.handler(step.args, { signal });
      } catch (error) {
        result = errorResult(step.name, error);
      }
      results.push({ name: step.name, result });
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          data: { completed: results.length - 1, failedIndex: results.length - 1, results },
        };
      }
    }
    return json({ completed: results.length, results });
  }

  close(): Promise<void> {
    return workerQueue.run(async () => {
      if (this.closed) return;
      this.closed = true;
      const errors: unknown[] = [];
      for (const cleanup of this.cleanups.splice(0).reverse()) {
        try { await cleanup(); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "Command cleanup failed");
    });
  }
}
