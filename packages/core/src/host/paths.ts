import * as fs from "fs";
import * as path from "path";
import { getHostConfig } from "./config";
import { SpotterError, type SpotterErrorCode, type SpotterErrorContext } from "../errors";

export function hostError(
  message: string,
  code: SpotterErrorCode = "SPOTTER_HOST_PATH_ERROR",
  context?: SpotterErrorContext,
  cause?: unknown
): SpotterError {
  return new SpotterError(code, message, {
    cause,
    context,
    domain: "host",
  });
}

/** Resolve a user path relative to workspace and ensure it stays inside the root. */
export function resolveWorkspacePath(userPath: string): string {
  const { workspaceRoot } = getHostConfig();
  const resolved = path.resolve(workspaceRoot, userPath);
  const rel = path.relative(workspaceRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw hostError(
      `path escapes workspace: ${userPath} (root: ${workspaceRoot})`,
      "SPOTTER_HOST_PATH_OUTSIDE_WORKSPACE",
      { userPath, workspaceRoot }
    );
  }
  return resolved;
}

export function assertWriteAllowed(resolved: string): void {
  const base = path.basename(resolved).toLowerCase();
  const { writeDenylist } = getHostConfig();
  if (writeDenylist.some((d) => base === d.toLowerCase())) {
    throw hostError(`writing to '${base}' is denied`, "SPOTTER_HOST_WRITE_DENIED", {
      basename: base,
    });
  }
}

export function assertWithinSize(size: number): void {
  const { maxBytes } = getHostConfig();
  if (size > maxBytes) {
    throw hostError(`size ${size} exceeds limit ${maxBytes}`, "SPOTTER_HOST_SIZE_LIMIT", {
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
    throw hostError(msg, "SPOTTER_HOST_STAT_FAILED", undefined, e);
  }
}
