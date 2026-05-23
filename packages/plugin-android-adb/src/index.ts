import { execFile, type ExecFileException } from "node:child_process";
import {
  findAllInCapture,
  findInCapture,
  loadImageFromBuffer,
} from "@spotterjs/core";
import type {
  CaptureImage,
  MatchOptions,
  MatchResult,
  Point,
  TemplateImage,
} from "@spotterjs/base";

export type AndroidDeviceState = "device" | "offline" | "unauthorized";

export interface AndroidDeviceInfo {
  serial: string;
  state: AndroidDeviceState;
  model?: string;
  product?: string;
  transportId?: string;
}

export interface AndroidConnectOptions {
  serial: string;
  adbPath?: string;
  timeoutMs?: number;
}

export interface AndroidOptions {
  adbPath?: string;
  timeoutMs?: number;
}

export interface AndroidDevice {
  serial: string;
  getInfo(): Promise<AndroidDeviceInfo>;
  capture(): Promise<CaptureImage>;
  tap(x: number, y: number): Promise<void>;
  swipe(
    from: Point,
    to: Point,
    options?: { durationMs?: number }
  ): Promise<void>;
  text(text: string): Promise<void>;
  keyevent(key: string | number): Promise<void>;
  back(): Promise<void>;
  home(): Promise<void>;
  startApp(packageName: string, activity?: string): Promise<void>;
  stopApp(packageName: string): Promise<void>;
  find(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult>;
  findAll(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult[]>;
  waitFor(
    needle: TemplateImage,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs?: number
  ): Promise<MatchResult>;
}

export type AdbErrorCode =
  | "ADB_NOT_FOUND"
  | "ADB_TIMEOUT"
  | "ADB_COMMAND_FAILED"
  | "ADB_DEVICE_NOT_FOUND"
  | "ADB_DEVICE_OFFLINE"
  | "ADB_DEVICE_UNAUTHORIZED";

export class AdbError extends Error {
  readonly code: AdbErrorCode;
  readonly stderr?: string;

  constructor(code: AdbErrorCode, message: string, stderr?: string) {
    super(message);
    this.name = "AdbError";
    this.code = code;
    this.stderr = stderr;
  }
}

type RunOptions = Required<Pick<AndroidOptions, "adbPath" | "timeoutMs">>;

const DEFAULT_ADB_PATH = "adb";
const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeOptions(options?: AndroidOptions): RunOptions {
  return {
    adbPath: options?.adbPath ?? DEFAULT_ADB_PATH,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

function runAdb(
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
          reject(toAdbError(error, String(stderr ?? "")));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function toAdbError(error: ExecFileException, stderr: string): AdbError {
  if (error.code === "ENOENT") {
    return new AdbError(
      "ADB_NOT_FOUND",
      "adb executable not found; install Android platform-tools or pass adbPath",
      stderr
    );
  }
  if (error.killed || error.signal === "SIGTERM") {
    return new AdbError("ADB_TIMEOUT", "adb command timed out", stderr);
  }
  const message = stderr || error.message || "adb command failed";
  if (/device offline/i.test(message)) {
    return new AdbError("ADB_DEVICE_OFFLINE", message, stderr);
  }
  if (/unauthorized/i.test(message)) {
    return new AdbError("ADB_DEVICE_UNAUTHORIZED", message, stderr);
  }
  if (/device .*not found|no devices/i.test(message)) {
    return new AdbError("ADB_DEVICE_NOT_FOUND", message, stderr);
  }
  return new AdbError("ADB_COMMAND_FAILED", message, stderr);
}

export function parseAdbDevices(output: string): AndroidDeviceInfo[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices"))
    .map((line) => {
      const parts = line.split(/\s+/);
      const serial = parts[0];
      const state = parts[1] as AndroidDeviceState;
      const info: AndroidDeviceInfo = { serial, state };

      for (const part of parts.slice(2)) {
        const [key, value] = part.split(":", 2);
        if (!value) continue;
        if (key === "model") info.model = value;
        if (key === "product") info.product = value;
        if (key === "transport_id") info.transportId = value;
      }

      return info;
    });
}

export function escapeAdbText(text: string): string {
  return text
    .replace(/[&|;<>()$`\\"]/g, " ")
    .trim()
    .replace(/\s+/g, "%s");
}

function componentName(packageName: string, activity?: string): string {
  if (!activity) return packageName;
  if (activity.includes("/")) return activity;
  return `${packageName}/${activity}`;
}

class AdbDevice implements AndroidDevice {
  readonly serial: string;
  private readonly options: RunOptions;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: AndroidConnectOptions) {
    this.serial = options.serial;
    this.options = normalizeOptions(options);
  }

  async getInfo(): Promise<AndroidDeviceInfo> {
    const devices = await android.listDevices(this.options);
    const device = devices.find((d) => d.serial === this.serial);
    if (!device) {
      throw new AdbError(
        "ADB_DEVICE_NOT_FOUND",
        `adb device not found: ${this.serial}`
      );
    }
    if (device.state === "offline") {
      throw new AdbError("ADB_DEVICE_OFFLINE", `adb device offline: ${this.serial}`);
    }
    if (device.state === "unauthorized") {
      throw new AdbError(
        "ADB_DEVICE_UNAUTHORIZED",
        `adb device unauthorized: ${this.serial}`
      );
    }
    return device;
  }

  capture(): Promise<CaptureImage> {
    return this.enqueue(async () => {
      const bytes = (await this.runDevice(
        ["exec-out", "screencap", "-p"],
        { encoding: "buffer" }
      )) as Buffer;
      return loadImageFromBuffer(bytes);
    });
  }

  tap(x: number, y: number): Promise<void> {
    return this.enqueue(() =>
      this.runDevice(["shell", "input", "tap", String(x), String(y)]).then(noop)
    );
  }

  swipe(
    from: Point,
    to: Point,
    options?: { durationMs?: number }
  ): Promise<void> {
    const args = [
      "shell",
      "input",
      "swipe",
      String(from.x),
      String(from.y),
      String(to.x),
      String(to.y),
    ];
    if (options?.durationMs !== undefined) args.push(String(options.durationMs));
    return this.enqueue(() => this.runDevice(args).then(noop));
  }

  text(text: string): Promise<void> {
    return this.enqueue(() =>
      this.runDevice(["shell", "input", "text", escapeAdbText(text)]).then(noop)
    );
  }

  keyevent(key: string | number): Promise<void> {
    return this.enqueue(() =>
      this.runDevice(["shell", "input", "keyevent", String(key)]).then(noop)
    );
  }

  back(): Promise<void> {
    return this.keyevent("BACK");
  }

  home(): Promise<void> {
    return this.keyevent("HOME");
  }

  startApp(packageName: string, activity?: string): Promise<void> {
    return this.enqueue(() =>
      this.runDevice([
        "shell",
        "am",
        "start",
        "-n",
        componentName(packageName, activity),
      ]).then(noop)
    );
  }

  stopApp(packageName: string): Promise<void> {
    return this.enqueue(() =>
      this.runDevice(["shell", "am", "force-stop", packageName]).then(noop)
    );
  }

  async find(
    needle: TemplateImage,
    options?: MatchOptions
  ): Promise<MatchResult> {
    return findInCapture(await this.capture(), needle, options);
  }

  async findAll(
    needle: TemplateImage,
    options?: MatchOptions
  ): Promise<MatchResult[]> {
    return findAllInCapture(await this.capture(), needle, options);
  }

  async waitFor(
    needle: TemplateImage,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs?: number
  ): Promise<MatchResult> {
    const deadline = Date.now() + timeoutMs;
    const pollMs = intervalMs ?? 250;
    let lastError: unknown;

    while (Date.now() <= deadline) {
      try {
        return await findInCapture(await this.capture(), needle, options);
      } catch (error) {
        lastError = error;
        if (Date.now() > deadline) break;
        if (pollMs > 0) await sleep(pollMs);
      }
    }

    if (lastError instanceof Error) {
      throw new Error(`Timed out waiting for Android template: ${lastError.message}`);
    }
    throw new Error("Timed out waiting for Android template");
  }

  private runDevice(
    args: string[],
    options?: { encoding?: BufferEncoding | "buffer" }
  ): Promise<string | Buffer> {
    return runAdb(["-s", this.serial, ...args], {
      ...this.options,
      ...options,
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.then(noop, noop);
    return next;
  }
}

function noop(): void {
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const android = {
  async listDevices(options?: AndroidOptions): Promise<AndroidDeviceInfo[]> {
    const stdout = (await runAdb(["devices", "-l"], options)) as string;
    return parseAdbDevices(stdout);
  },

  async connect(options: AndroidConnectOptions): Promise<AndroidDevice> {
    return new AdbDevice(options);
  },

  async connectTcp(
    address: string,
    options?: AndroidOptions
  ): Promise<AndroidDevice> {
    const normalized = normalizeOptions(options);
    await runAdb(["connect", address], normalized);
    return new AdbDevice({ serial: address, ...normalized });
  },
};
