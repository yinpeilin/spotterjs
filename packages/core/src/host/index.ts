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

export const host = {
  configure: configureHost,
  readFile,
  writeFile,
  listDir,
  stat,
  openPath,
  exec: execCommand,
  getShellInfo,
};
