import * as path from "path";

export type HostConfig = {
  workspaceRoot: string;
  allowShell: boolean;
  maxBytes: number;
  execTimeoutMs: number;
  writeDenylist: string[];
};

let _config: HostConfig | null = null;

function envRoot(): string {
  return (
    process.env.SPOTTER_WORKSPACE_ROOT?.trim() ||
    process.cwd()
  );
}

function envBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

export function getHostConfig(): HostConfig {
  if (_config) return _config;
  _config = {
    workspaceRoot: path.resolve(envRoot()),
    allowShell: envBool("SPOTTER_ALLOW_SHELL", false),
    maxBytes: Number(process.env.SPOTTER_FS_MAX_BYTES || 1048576),
    execTimeoutMs: Number(process.env.SPOTTER_EXEC_TIMEOUT_MS || 60000),
    writeDenylist: [".env", ".env.local", "credentials.json", "secrets.json"],
  };
  return _config;
}

export function configureHost(partial: Partial<HostConfig>): void {
  _config = { ...getHostConfig(), ...partial };
  _config.workspaceRoot = path.resolve(_config.workspaceRoot);
}
