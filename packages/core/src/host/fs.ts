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
  /** 文本编码；`null` 表示返回原始 Buffer */
  encoding?: BufferEncoding | null;
  /** 覆盖全局 maxBytes 限制 */
  maxBytes?: number;
};

/**
 * 读取工作区内文件（路径相对于 {@link HostConfig.workspaceRoot}）。
 * @throws 路径逃逸、非文件、超大文件
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
 * 写入工作区文件（自动创建父目录）。
 * @throws 路径逃逸、denylist、超大内容
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

/** 目录项摘要（`path` 为相对工作区的 POSIX 风格路径） */
export type DirEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
};

/** 列出目录内容 */
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

/** 文件/目录 stat（不含完整 resolved 路径，返回原始相对路径） */
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
