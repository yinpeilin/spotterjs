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
  encoding?: BufferEncoding | null;
  maxBytes?: number;
};

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

export type DirEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
};

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
