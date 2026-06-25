export { configureHost, getHostConfig, type HostConfig } from "./config";
export { resolveWorkspacePath } from "./paths";
export { getShellInfo, execCommand, type ShellInfo, type ShellKind, type ExecResult } from "./shell";
export {
  readFile,
  writeFile,
  listDir,
  stat,
  type DirEntry,
  type ReadFileOptions,
} from "./fs";
export { openPath } from "./open";

import { configureHost } from "./config";
import { execCommand, getShellInfo } from "./shell";
import { listDir, readFile, stat, writeFile } from "./fs";
import { openPath } from "./open";

/**
 * Sandboxed workspace I/O for agent and MCP scenarios.
 *
 * - All user paths are constrained to `workspaceRoot`.
 * - Writes to sensitive files such as `.env` are blocked by default.
 * - Shell execution is disabled until explicitly enabled.
 *
 * Environment variables: `SPOTTERJS_WORKSPACE_ROOT`, `SPOTTERJS_ALLOW_SHELL`,
 * `SPOTTERJS_FS_MAX_BYTES`, `SPOTTERJS_EXEC_TIMEOUT_MS`, `SPOTTERJS_SHELL`
 */
export const host = {
  configure: configureHost,
  readFile,
  writeFile,
  listDir,
  stat,
  /** Open a workspace file or directory with the OS default application. */
  openPath,
  exec: execCommand,
  getShellInfo,
};
