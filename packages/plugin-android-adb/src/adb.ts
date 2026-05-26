import { execFile, type ExecFileException } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AndroidDeviceInfo, AndroidOptions } from "./types";

export type AdbErrorCode =
  | "ADB_NOT_FOUND"
  | "ADB_TIMEOUT"
  | "ADB_COMMAND_FAILED"
  | "ADB_DEVICE_NOT_FOUND"
  | "ADB_DEVICE_OFFLINE"
  | "ADB_DEVICE_UNAUTHORIZED"
  | "ADB_MULTIPLE_DEVICES";

/** Error thrown when adb discovery, connection, or command execution fails. */
export class AdbError extends Error {
  /** Stable machine-readable adb error code. */
  readonly code: AdbErrorCode;
  /** stderr captured from adb when available. */
  readonly stderr?: string;
  /** Device list attached to discovery/selection errors. */
  readonly devices?: AndroidDeviceInfo[];
  /** Additional diagnostic context such as adb path, args, and timeout. */
  readonly context?: Record<string, unknown>;
  /** Original process error when this wraps a lower-level failure. */
  readonly cause?: unknown;

  constructor(
    code: AdbErrorCode,
    message: string,
    stderr?: string,
    devices?: AndroidDeviceInfo[],
    options: { context?: Record<string, unknown>; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "AdbError";
    this.code = code;
    this.stderr = stderr;
    this.devices = devices;
    this.context = options.context;
    this.cause = options.cause;
  }
}

/** Fully resolved adb execution options used internally by command helpers. */
export type RunOptions = Required<Pick<AndroidOptions, "adbPath" | "timeoutMs">>;

const DEFAULT_ADB_PATH = "adb";
const DEFAULT_TIMEOUT_MS = 30_000;

/** Resolve the adb executable path from explicit options, environment, PATH, or common SDK locations. */
export function resolveAdbPath(options?: AndroidOptions): string {
  const explicit = options?.adbPath?.trim();
  if (explicit) return explicit;

  const envPath = process.env.SPOTTERJS_ADB_PATH?.trim();
  if (envPath) return envPath;

  const pathMatch = findExecutableOnPath("adb");
  if (pathMatch) return pathMatch;

  const common = commonAdbPaths().find((candidate) => fs.existsSync(candidate));
  return common ?? DEFAULT_ADB_PATH;
}

/** Normalize partial Android options into concrete adb execution settings. */
export function normalizeOptions(options?: AndroidOptions): RunOptions {
  return {
    adbPath: resolveAdbPath(options),
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

/** Run an adb command and return stdout as text or bytes. */
export function runAdb(
  args: string[],
  options?: AndroidOptions & { encoding?: BufferEncoding | "buffer" }
): Promise<string | Buffer> {
  const normalized = normalizeOptions(options);
  const encoding = options?.encoding ?? "utf8";

  return new Promise((resolve, reject) => {
    execFile(
      normalized.adbPath,
      args,
      {
        timeout: normalized.timeoutMs,
        encoding: encoding === "buffer" ? "buffer" : encoding,
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(toAdbError(error, String(stderr ?? ""), {
            adbPath: normalized.adbPath,
            args,
            timeoutMs: normalized.timeoutMs,
          }));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function toAdbError(
  error: ExecFileException,
  stderr: string,
  context: Record<string, unknown>
): AdbError {
  if (error.code === "ENOENT") {
    return new AdbError(
      "ADB_NOT_FOUND",
      "adb executable not found; install Android platform-tools or pass adbPath",
      stderr,
      undefined,
      { context, cause: error }
    );
  }
  if (error.killed || error.signal === "SIGTERM") {
    return new AdbError("ADB_TIMEOUT", "adb command timed out", stderr, undefined, {
      context,
      cause: error,
    });
  }
  const message = stderr || error.message || "adb command failed";
  if (/device offline/i.test(message)) {
    return new AdbError("ADB_DEVICE_OFFLINE", message, stderr, undefined, {
      context,
      cause: error,
    });
  }
  if (/unauthorized/i.test(message)) {
    return new AdbError("ADB_DEVICE_UNAUTHORIZED", message, stderr, undefined, {
      context,
      cause: error,
    });
  }
  if (/device .*not found|no devices/i.test(message)) {
    return new AdbError("ADB_DEVICE_NOT_FOUND", message, stderr, undefined, {
      context,
      cause: error,
    });
  }
  return new AdbError("ADB_COMMAND_FAILED", message, stderr, undefined, {
    context,
    cause: error,
  });
}

function findExecutableOnPath(name: string): string | undefined {
  const pathValue = process.env.PATH ?? "";
  const exts =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
      : [""];

  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, `${name}${ext.toLowerCase()}`);
      if (fs.existsSync(candidate)) return candidate;
      const upper = path.join(dir, `${name}${ext.toUpperCase()}`);
      if (upper !== candidate && fs.existsSync(upper)) return upper;
    }
  }
  return undefined;
}

function commonAdbPaths(): string[] {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const candidates = [
    localAppData &&
      path.join(localAppData, "Android", "Sdk", "platform-tools", "adb.exe"),
    path.join(home, "AppData", "Local", "Android", "Sdk", "platform-tools", "adb.exe"),
    path.join(home, "Android", "Sdk", "platform-tools", "adb"),
    programFiles &&
      path.join(programFiles, "Android", "android-sdk", "platform-tools", "adb.exe"),
    programFilesX86 &&
      path.join(programFilesX86, "Android", "android-sdk", "platform-tools", "adb.exe"),
    "/usr/local/bin/adb",
    "/usr/bin/adb",
  ];
  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}
