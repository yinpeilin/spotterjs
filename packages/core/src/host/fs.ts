import * as fs from "fs";
import * as path from "path";
import { getHostConfig } from "./config";
import {
  assertWithinSize,
  assertWriteAllowed,
  resolveWorkspacePath,
  statSafe,
} from "./paths";

export type ReadFileOptions = {
  /** Text encoding. Use `null` to return a raw Buffer. */
  encoding?: BufferEncoding | null;
  /** Override the global max byte limit for this read. */
  maxBytes?: number;
};

/**
 * Read a file inside the configured workspace root.
 * @throws For path escape, non-file targets, or files over the byte limit.
 */
export function readFile(filePath: string, opts?: ReadFileOptions): string | Buffer {
  const resolved = resolveWorkspacePath(filePath);
  const st = statSafe(resolved);
  if (!st.isFile()) {
    throw new Error(`not a file: ${filePath}`);
  }
  assertWithinSize(st.size);
  if (opts?.encoding === null) {
    return fs.readFileSync(resolved);
  }
  return fs.readFileSync(resolved, opts?.encoding ?? "utf8");
}

/**
 * Write a file inside the configured workspace root, creating parent
 * directories as needed.
 * @throws For path escape, denied filenames, or content over the byte limit.
 */
export function writeFile(
  filePath: string,
  content: string | Buffer,
  opts?: { encoding?: BufferEncoding }
): void {
  const resolved = resolveWorkspacePath(filePath);
  assertWriteAllowed(resolved);
  const data =
    typeof content === "string"
      ? Buffer.from(content, opts?.encoding ?? "utf8")
      : content;
  assertWithinSize(data.length);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, data);
}

/** Directory entry summary. `path` is POSIX-style and relative to the workspace. */
export type DirEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
};

/** List entries inside a workspace directory. */
export function listDir(dirPath = "."): DirEntry[] {
  const resolved = resolveWorkspacePath(dirPath);
  const st = statSafe(resolved);
  if (!st.isDirectory()) {
    throw new Error(`not a directory: ${dirPath}`);
  }
  return fs.readdirSync(resolved).map((name) => {
    const full = path.join(resolved, name);
    const s = statSafe(full);
    const rel = path.relative(getHostConfig().workspaceRoot, full);
    return {
      name,
      path: rel.split(path.sep).join("/"),
      isDirectory: s.isDirectory(),
      isFile: s.isFile(),
      size: s.size,
    };
  });
}

/** Return file or directory metadata without exposing the resolved absolute path. */
export function stat(filePath: string) {
  const resolved = resolveWorkspacePath(filePath);
  const st = statSafe(resolved);
  return {
    path: filePath,
    isDirectory: st.isDirectory(),
    isFile: st.isFile(),
    size: st.size,
    mtimeMs: st.mtimeMs,
  };
}
