import * as fs from "fs";
import * as path from "path";
import { getHostConfig } from "./config";

export class HostPathError extends Error {
  constructor(message: string) {
    super(message);
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
      `path escapes workspace: ${userPath} (root: ${workspaceRoot})`
    );
  }
  return resolved;
}

export function assertWriteAllowed(resolved: string): void {
  const base = path.basename(resolved).toLowerCase();
  const { writeDenylist } = getHostConfig();
  if (writeDenylist.some((d) => base === d.toLowerCase())) {
    throw new HostPathError(`writing to '${base}' is denied`);
  }
}

export function assertWithinSize(size: number): void {
  const { maxBytes } = getHostConfig();
  if (size > maxBytes) {
    throw new HostPathError(`size ${size} exceeds limit ${maxBytes}`);
  }
}

export function statSafe(resolved: string): fs.Stats {
  try {
    return fs.statSync(resolved);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new HostPathError(msg);
  }
}
