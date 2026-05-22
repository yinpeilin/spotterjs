export { configureHost, getHostConfig, type HostConfig } from "./config";
export { HostPathError, resolveWorkspacePath } from "./paths";
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
 * 沙箱化工作区 I/O（面向 Agent / MCP）。
 *
 * - 所有路径限制在 `workspaceRoot` 内
 * - 写操作拦截 `.env` 等敏感文件
 * - shell 默认关闭，需显式开启
 *
 * 环境变量：`SPOTTERJS_WORKSPACE_ROOT`、`SPOTTERJS_ALLOW_SHELL`、
 * `SPOTTERJS_FS_MAX_BYTES`、`SPOTTERJS_EXEC_TIMEOUT_MS`、`SPOTTERJS_SHELL`
 */
export const host = {
  configure: configureHost,
  readFile,
  writeFile,
  listDir,
  stat,
  /** 用系统默认应用打开路径（文件或目录） */
  openPath,
  exec: execCommand,
  getShellInfo,
};
