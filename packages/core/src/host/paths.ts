import * as fs from "fs";
import * as path from "path";
import { getHostConfig } from "./config";
import { SpotterJsError, type SpotterErrorContext } from "../errors";

export class HostPathError extends SpotterJsError {
  constructor(
    message: string,
    code = "HOST_PATH_ERROR",
    context?: SpotterErrorContext,
    cause?: unknown
  ) {
    super(code, message, { context, cause });
    this.name = "HostPathError";
  }
}

/** Resolve a user path relative to workspace and ensure it stays inside the root. */
export function resolveWorkspacePath(userPath: string): string {
  const { workspaceRoot } = getHostConfig();
  const resolved = path.resolve(workspaceRoot, userPath);
  const rel = path.relative(workspaceRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new HostPathError(
      `path escapes workspace: ${userPath} (root: ${workspaceRoot})`,
      "HOST_PATH_OUTSIDE_WORKSPACE",
      { userPath, workspaceRoot }
    );
  }
  return resolved;
}

export function assertWriteAllowed(resolved: string): void {
  const base = path.basename(resolved).toLowerCase();
  const { writeDenylist } = getHostConfig();
  if (writeDenylist.some((d) => base === d.toLowerCase())) {
    throw new HostPathError(`writing to '${base}' is denied`, "HOST_WRITE_DENIED", {
      basename: base,
    });
  }
}

export function assertWithinSize(size: number): void {
  const { maxBytes } = getHostConfig();
  if (size > maxBytes) {
    throw new HostPathError(`size ${size} exceeds limit ${maxBytes}`, "HOST_SIZE_LIMIT", {
      size,
      maxBytes,
    });
  }
}

export function statSafe(resolved: string): fs.Stats {
  try {
    return fs.statSync(resolved);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new HostPathError(msg, "HOST_STAT_FAILED", undefined, e);
  }
}
