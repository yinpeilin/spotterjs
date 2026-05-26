import * as path from "path";

/**
 * Workspace host I/O configuration for agent and MCP scenarios.
 *
 * Defaults are read from environment variables and can be overridden with
 * {@link configureHost}.
 */
export type HostConfig = {
  /** Workspace root. Relative user paths must resolve inside this directory. */
  workspaceRoot: string;
  /** Whether shell execution is enabled. */
  allowShell: boolean;
  /** Maximum bytes for one file read/write or command output stream. */
  maxBytes: number;
  /** Default shell command timeout in milliseconds. */
  execTimeoutMs: number;
  /** File basenames that cannot be written. */
  writeDenylist: string[];
};

let _config: HostConfig | null = null;

function envRoot(): string {
  return (
    process.env.SPOTTERJS_WORKSPACE_ROOT?.trim() ||
    process.cwd()
  );
}

function envBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

/** Return the current host configuration, initializing it on first use. */
export function getHostConfig(): HostConfig {
  if (_config) return _config;
  _config = {
    workspaceRoot: path.resolve(envRoot()),
    allowShell: envBool("SPOTTERJS_ALLOW_SHELL", false),
    maxBytes: Number(process.env.SPOTTERJS_FS_MAX_BYTES || 1048576),
    execTimeoutMs: Number(process.env.SPOTTERJS_EXEC_TIMEOUT_MS || 60000),
    writeDenylist: [".env", ".env.local", "credentials.json", "secrets.json"],
  };
  return _config;
}

/** Merge host configuration overrides and resolve `workspaceRoot` absolutely. */
export function configureHost(partial: Partial<HostConfig>): void {
  _config = { ...getHostConfig(), ...partial };
  _config.workspaceRoot = path.resolve(_config.workspaceRoot);
}
