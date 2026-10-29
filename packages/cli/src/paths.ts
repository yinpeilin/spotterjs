import { resolve } from "node:path";

/** Capture paths are workspace-relative; use the same root when reading them. */
export function resolveImagePath(imagePath: string): string {
  return resolve(process.env.SPOTTERJS_WORKSPACE_ROOT?.trim() || process.cwd(), imagePath);
}
