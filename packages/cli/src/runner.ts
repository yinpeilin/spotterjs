import { SpotterError, type SpotterErrorCode, type SpotterErrorContext } from "@spotterjs/base";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { installSkill, skillPath } from "./skill.js";
import type { CommandRegistry } from "./registry.js";
import { cliErrorResult, type CommandResult } from "./tools/results.js";

function cliError(
  code: SpotterErrorCode,
  message: string,
  hint?: string,
  context?: SpotterErrorContext
): SpotterError {
  return new SpotterError(code, message, { domain: "cli", hint, context });
}

const help = `Usage: spotterjs <command> [options]

  list [--all]                       List available automation commands
  schema <name>                      Show a command's JSON input schema
  run <name> [--json JSON | --file PATH | --stdin]
                                     Execute one automation command
  sequence [--json JSON | --file PATH | --stdin]
                                     Execute an array of {name, arguments} steps
  skill path                         Locate the bundled agent skill
  skill install --target DIRECTORY [--force]
                                     Install the skill into an agent skills directory

  --workspace PATH                   Workspace for files and screenshot artifacts
  --help, -h                         Show this help
  --version, -v                      Show the installed version

JSON commands write {success,data,error} to stdout; errors exit with status 1.
Optional commands: SPOTTERJS_A11Y=1, SPOTTERJS_ANDROID=1, SPOTTERJS_RECORDING=1.
Use --file or --stdin for Unicode text and to avoid shell quoting issues.
`;

type CliIo = {
  stdout(text: string): void;
  readStdin(signal?: AbortSignal): Promise<string>;
};
type CliDependencies = {
  createRegistry?: (options: { all?: boolean; discovery?: boolean; workspace?: string }) => Promise<CommandRegistry>;
};

async function readStdin(signal?: AbortSignal): Promise<string> {
  if (process.stdin.isTTY) {
    throw cliError(
      "SPOTTER_CLI_INVALID_INPUT",
      "--stdin requires piped JSON input",
      "Pipe JSON into stdin (e.g. echo '{}' | spotterjs run <name> --stdin) or use --json / --file."
    );
  }
  signal?.throwIfAborted();
  const chunks: Buffer[] = [];
  const cancel = () =>
    process.stdin.destroy(
      cliError("SPOTTER_CLI_CANCELLED", "Command cancelled while reading input")
    );
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw cliError(
      "SPOTTER_CLI_INVALID_ARGUMENTS",
      "Command arguments must be a JSON object",
      'Pass a JSON object such as "{}" or \'{"key":"value"}\'.'
    );
  }
  return value as Record<string, unknown>;
}

/** Testable CLI boundary: one JSON result and a stable exit status per invocation. */
export async function runCli(
  argv: string[],
  io: CliIo = { stdout: (text) => process.stdout.write(text), readStdin },
  dependencies: CliDependencies = {},
  signal?: AbortSignal
): Promise<number> {
  let registry: CommandRegistry | undefined;
  let result: CommandResult;
  try {
    signal?.throwIfAborted();
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: "string" },
        file: { type: "string" },
        stdin: { type: "boolean" },
        workspace: { type: "string" },
        all: { type: "boolean" },
        target: { type: "string" },
        force: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
    if (values.help || argv.length === 0) { io.stdout(help); return 0; }
    if (values.version) {
      const metadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
      io.stdout(`${metadata.version}\n`);
      return 0;
    }
    const [command, name, ...extra] = positionals;
    if (!["list", "schema", "run", "sequence", "skill"].includes(command)) {
      throw cliError(
        "SPOTTER_CLI_UNKNOWN_COMMAND",
        `Unknown CLI command: ${command}; use --help`,
        'Valid CLI subcommands are "list", "schema", "run", "sequence", and "skill".',
        { command }
      );
    }
    if (extra.length || ((command === "list" || command === "sequence") && name)) {
      throw cliError(
        "SPOTTER_CLI_INVALID_ARGS",
        "Unexpected positional arguments; use --help",
        'Run "spotterjs --help" to inspect command syntax.'
      );
    }
    const inputCount = [values.json !== undefined, values.file !== undefined, !!values.stdin].filter(Boolean).length;
    if (inputCount > 1) {
      throw cliError(
        "SPOTTER_CLI_INVALID_INPUT",
        "Choose only one of --json, --file, or --stdin",
        "Provide arguments through a single input flag."
      );
    }
    if (inputCount && command !== "run" && command !== "sequence") {
      throw cliError(
        "SPOTTER_CLI_INVALID_ARGS",
        "JSON input is only supported for run and sequence",
        'Remove --json / --file / --stdin or use "spotterjs run <name>".'
      );
    }
    if (values.all && command !== "list") {
      throw cliError(
        "SPOTTER_CLI_INVALID_ARGS",
        "--all is only supported for list",
        'Use "spotterjs list --all".'
      );
    }
    if ((values.target !== undefined || values.force) && command !== "skill") {
      throw cliError(
        "SPOTTER_CLI_INVALID_ARGS",
        "--target and --force are only supported for skill install",
        'Use "spotterjs skill install --target DIRECTORY [--force]".'
      );
    }
    if (command === "skill") {
      if (name === "path") {
        if (values.target !== undefined || values.force) {
          throw cliError(
            "SPOTTER_CLI_INVALID_ARGS",
            "skill path does not accept install options",
            'Use "spotterjs skill path" without --target or --force.'
          );
        }
        result = { success: true, data: { path: skillPath } };
      } else if (name === "install" && values.target?.trim()) {
        result = { success: true, data: { path: installSkill(values.target, values.force) } };
      } else {
        throw cliError(
          "SPOTTER_CLI_INVALID_ARGS",
          "Use skill path or skill install --target DIRECTORY",
          'Run "spotterjs skill path" or "spotterjs skill install --target DIRECTORY".'
        );
      }
    } else {
      if ((command === "schema" || command === "run") && !name) {
        throw cliError(
          "SPOTTER_CLI_INVALID_ARGS",
          `${command} requires a command name`,
          'Run "spotterjs list --all" to see available command names.'
        );
      }
      let args: unknown = {};
      if (inputCount) {
        const raw = values.json ?? (values.file !== undefined ? readFileSync(resolve(values.file), "utf8") : await io.readStdin(signal));
        args = JSON.parse(raw.replace(/^\uFEFF/, ""));
      } else if (command === "sequence") {
        throw cliError(
          "SPOTTER_CLI_INVALID_INPUT",
          "sequence requires JSON input (--json, --file, or --stdin)",
          'Pass a JSON array of { "name", "arguments" } steps via --json, --file, or --stdin.'
        );
      }
      if (command === "run") object(args);
      if (command === "sequence" && !Array.isArray(args)) {
        throw cliError(
          "SPOTTER_CLI_INVALID_ARGUMENTS",
          "Sequence input must be a JSON array of steps",
          'Pass a JSON array like \'[{"name":"desktop_list_windows"}]\'.'
        );
      }
      signal?.throwIfAborted();
      const create = dependencies.createRegistry ?? (await import("./runtime.js")).createCommandRegistry;
      registry = await create({
        all: command === "schema" || !!values.all,
        discovery: command === "list" || command === "schema",
        workspace: values.workspace,
      });
      if (command === "list") result = { success: true, data: registry.list() };
      else if (command === "schema") {
        const info = registry.list().find((entry) => entry.name === name);
        if (!info) {
          throw cliError(
            "SPOTTER_CLI_UNKNOWN_COMMAND",
            `Unknown automation command: ${name}; use list --all`,
            'Run "spotterjs list --all" to view all available commands and optional environment flags.',
            { command: name }
          );
        }
        result = { success: true, data: info };
      } else result = await registry.execute(command === "sequence" ? "spotter_run_sequence" : name!, command === "sequence" ? { steps: args } : object(args), signal);
    }
  } catch (error) {
    result = cliErrorResult(error);
  } finally {
    if (registry) {
      try { await registry.close(); }
      catch (error) {
        const prior = result!;
        const cleanupMessage = `Command cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
        result = {
          ...prior,
          success: false,
          error: {
            ...prior?.error,
            message: prior?.error ? `${prior.error.message}; ${cleanupMessage}` : cleanupMessage,
          },
        };
      }
    }
  }
  io.stdout(`${JSON.stringify(result!)}\n`);
  return result!.success ? 0 : 1;
}
