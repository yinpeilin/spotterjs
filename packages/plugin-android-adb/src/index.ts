import { image } from "@spotterjs/core";
import type {
  CaptureImage,
  MatchOptions,
  MatchResult,
  Point,
  TemplateImage,
} from "@spotterjs/base";
import { AdbError, normalizeOptions, resolveAdbPath, runAdb } from "./adb";
import type { RunOptions } from "./adb";
import { discoverDevices } from "./discovery";
import { AdbDeviceGroup } from "./group";
import { escapeAdbText } from "./input";
import { connectNetworkRaw, pairTcp } from "./pairing";
import { isAndroidElementNode } from "./uiautomator";
import type {
  AndroidConnectOptions,
  AndroidCurrentApp,
  AndroidDevice,
  AndroidDeviceInfo,
  AndroidDisplayInfo,
  AndroidElementNode,
  AndroidElementQuery,
  AndroidElementQueryOptions,
  AndroidElementTarget,
  AndroidNetworkOptions,
  AndroidOptions,
  AndroidPairTcpOptions,
  AndroidTreeOptions,
} from "./types";

export { AdbError, resolveAdbPath };
export type {
  AdbErrorCode,
  RunOptions,
} from "./adb";

export type AndroidAutomationErrorCode =
  | "ANDROID_INVALID_ARGUMENT"
  | "ANDROID_UNSAFE_REMOTE_PATH"
  | "ANDROID_ELEMENT_NOT_FOUND"
  | "ANDROID_ELEMENT_WAIT_TIMEOUT"
  | "ANDROID_TEMPLATE_WAIT_TIMEOUT"
  | "ANDROID_DISPLAY_PARSE_FAILED";

/** Error thrown by high-level Android automation helpers. */
export class AndroidAutomationError extends Error {
  /** Stable machine-readable automation error code. */
  readonly code: AndroidAutomationErrorCode;
  /** Additional diagnostic context such as query, timeout, or path values. */
  readonly context?: Record<string, unknown>;
  /** Original lower-level error when this wraps another failure. */
  readonly cause?: unknown;

  constructor(
    code: AndroidAutomationErrorCode,
    message: string,
    options: { context?: Record<string, unknown>; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "AndroidAutomationError";
    this.code = code;
    this.context = options.context;
    this.cause = options.cause;
  }
}
export type {
  AndroidBatchResult,
  AndroidConnectOptions,
  AndroidCurrentApp,
  AndroidDevice,
  AndroidDeviceConnection,
  AndroidDeviceGroup,
  AndroidDeviceInfo,
  AndroidDeviceState,
  AndroidDisplayInfo,
  AndroidElementNode,
  AndroidElementQuery,
  AndroidElementQueryOptions,
  AndroidElementTarget,
  AndroidNetworkOptions,
  AndroidOptions,
  AndroidPairTcpOptions,
  AndroidTreeOptions,
} from "./types";

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
    const devices = await discoverDevices(this.options);
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
      return image.decode(bytes);
    });
  }

  tap(x: number, y: number): Promise<void> {
    try {
      assertFiniteNumber(x, "x");
      assertFiniteNumber(y, "y");
    } catch (error) {
      return Promise.reject(error);
    }
    return this.enqueue(() =>
      this.runDevice(["shell", "input", "tap", String(x), String(y)]).then(noop)
    );
  }

  swipe(
    from: Point,
    to: Point,
    options?: { durationMs?: number }
  ): Promise<void> {
    try {
      assertPoint(from, "from");
      assertPoint(to, "to");
      if (options?.durationMs !== undefined) {
        assertNonNegativeNumber(options.durationMs, "durationMs");
      }
    } catch (error) {
      return Promise.reject(error);
    }
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

  dumpTree(options?: AndroidTreeOptions): Promise<AndroidElementNode> {
    const remotePath = options?.remotePath ?? "/sdcard/window.xml";
    try {
      assertSafeRemotePath(remotePath);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.enqueue(async () => {
      try {
        await this.runDevice(["shell", "uiautomator", "dump", remotePath]);
        const xml = (await this.runDevice([
          "exec-out",
          "cat",
          remotePath,
        ])) as string;
        const { parseUiautomatorXml } = await import("./uiautomator");
        const tree = parseUiautomatorXml(xml);
        return options?.maxDepth === undefined
          ? tree
          : limitTreeDepth(tree, options.maxDepth);
      } finally {
        try {
          await this.runDevice(["shell", "rm", "-f", remotePath]);
        } catch {
          // Best-effort cleanup should never mask the dump/read failure.
        }
      }
    });
  }

  async findElement(
    query: AndroidElementQuery,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode> {
    const matches = await this.findElements(query, options);
    const first = matches[0];
    if (!first) {
      throw new AndroidAutomationError(
        "ANDROID_ELEMENT_NOT_FOUND",
        `Android element not found: ${JSON.stringify(query)}`,
        { context: { query } }
      );
    }
    return first;
  }

  async findElements(
    query: AndroidElementQuery,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode[]> {
    const tree = await this.dumpTree(options);
    const { findAndroidElements } = await import("./uiautomator");
    return findAndroidElements(tree, query, options);
  }

  async waitForElement(
    query: AndroidElementQuery,
    timeoutMs: number,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode> {
    assertNonNegativeNumber(timeoutMs, "timeoutMs");
    const deadline = Date.now() + timeoutMs;
    const pollMs = options?.pollMs ?? 250;
    assertNonNegativeNumber(pollMs, "pollMs");
    let lastError: unknown;

    while (Date.now() <= deadline) {
      try {
        return await this.findElement(query, options);
      } catch (error) {
        lastError = error;
        if (Date.now() > deadline) break;
        if (pollMs > 0) await sleep(pollMs);
      }
    }

    if (lastError instanceof Error) {
      throw new AndroidAutomationError(
        "ANDROID_ELEMENT_WAIT_TIMEOUT",
        `Timed out waiting for Android element: ${lastError.message}`,
        { context: { query, timeoutMs, pollMs }, cause: lastError }
      );
    }
    throw new AndroidAutomationError(
      "ANDROID_ELEMENT_WAIT_TIMEOUT",
      "Timed out waiting for Android element",
      { context: { query, timeoutMs, pollMs } }
    );
  }

  async tapElement(
    target: AndroidElementTarget,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode> {
    const element = await this.resolveElement(target, options);
    await this.tap(element.center.x, element.center.y);
    return element;
  }

  async typeElement(
    target: AndroidElementTarget,
    text: string,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode> {
    const element = await this.tapElement(target, options);
    await this.text(text);
    return element;
  }

  shell(command: string): Promise<string> {
    return this.enqueue(() =>
      this.runDevice(["shell", command]).then((output) => output as string)
    );
  }

  getDisplayInfo(): Promise<AndroidDisplayInfo> {
    return this.enqueue(async () => {
      const size = (await this.runDevice(["shell", "wm", "size"])) as string;
      const density = (await this.runDevice(["shell", "wm", "density"])) as string;
      return parseDisplayInfo(size, density);
    });
  }

  wake(): Promise<void> {
    return this.keyevent("WAKEUP");
  }

  sleep(): Promise<void> {
    return this.keyevent("SLEEP");
  }

  currentApp(): Promise<AndroidCurrentApp> {
    return this.enqueue(async () => {
      const raw = (await this.runDevice(["shell", "dumpsys", "window"])) as string;
      return parseCurrentApp(raw);
    });
  }

  clearApp(packageName: string): Promise<void> {
    return this.enqueue(() =>
      this.runDevice(["shell", "pm", "clear", packageName]).then(noop)
    );
  }

  async find(
    needle: TemplateImage,
    options?: MatchOptions
  ): Promise<MatchResult> {
    return image.find(await this.capture(), needle, options);
  }

  async findAll(
    needle: TemplateImage,
    options?: MatchOptions
  ): Promise<MatchResult[]> {
    return image.findAll(await this.capture(), needle, options);
  }

  async waitFor(
    needle: TemplateImage,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs?: number
  ): Promise<MatchResult> {
    assertNonNegativeNumber(timeoutMs, "timeoutMs");
    const deadline = Date.now() + timeoutMs;
    const pollMs = intervalMs ?? 250;
    assertNonNegativeNumber(pollMs, "intervalMs");
    let lastError: unknown;

    while (Date.now() <= deadline) {
      try {
        return await image.find(await this.capture(), needle, options);
      } catch (error) {
        lastError = error;
        if (Date.now() > deadline) break;
        if (pollMs > 0) await sleep(pollMs);
      }
    }

    if (lastError instanceof Error) {
      throw new AndroidAutomationError(
        "ANDROID_TEMPLATE_WAIT_TIMEOUT",
        `Timed out waiting for Android template: ${lastError.message}`,
        { context: { timeoutMs, pollMs }, cause: lastError }
      );
    }
    throw new AndroidAutomationError(
      "ANDROID_TEMPLATE_WAIT_TIMEOUT",
      "Timed out waiting for Android template",
      { context: { timeoutMs, pollMs } }
    );
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

  private resolveElement(
    target: AndroidElementTarget,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode> {
    if (isAndroidElementNode(target)) return Promise.resolve(target);
    return this.findElement(target, options);
  }
}

function noop(): void {
  return undefined;
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new AndroidAutomationError(
      "ANDROID_INVALID_ARGUMENT",
      `${label} must be a finite number`,
      { context: { label, value } }
    );
  }
}

function assertNonNegativeNumber(value: number, label: string): void {
  assertFiniteNumber(value, label);
  if (value < 0) {
    throw new AndroidAutomationError(
      "ANDROID_INVALID_ARGUMENT",
      `${label} must be >= 0`,
      { context: { label, value } }
    );
  }
}

function assertPoint(point: Point, label: string): void {
  assertFiniteNumber(point.x, `${label}.x`);
  assertFiniteNumber(point.y, `${label}.y`);
}

function assertSafeRemotePath(remotePath: string): void {
  if (
    !remotePath ||
    !remotePath.startsWith("/sdcard/") ||
    remotePath.includes("..") ||
    /[\s;&|`$<>\\]/.test(remotePath)
  ) {
    throw new AndroidAutomationError(
      "ANDROID_UNSAFE_REMOTE_PATH",
      "remotePath must be an absolute safe path under /sdcard/",
      { context: { remotePath } }
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDisplayInfo(sizeOutput: string, densityOutput: string): AndroidDisplayInfo {
  const overrideSize = /Override size:\s*(\d+)x(\d+)/i.exec(sizeOutput);
  const physicalSize = /Physical size:\s*(\d+)x(\d+)/i.exec(sizeOutput);
  const size = overrideSize ?? physicalSize;
  if (!size) {
    throw new AndroidAutomationError(
      "ANDROID_DISPLAY_PARSE_FAILED",
      `Unable to parse Android display size: ${sizeOutput}`,
      { context: { sizeOutput } }
    );
  }
  const overrideDensity = /Override density:\s*(\d+)/i.exec(densityOutput);
  const physicalDensity = /Physical density:\s*(\d+)/i.exec(densityOutput);
  const density = overrideDensity ?? physicalDensity;
  return {
    width: Number(size[1]),
    height: Number(size[2]),
    density: density ? Number(density[1]) : undefined,
  };
}

function parseCurrentApp(raw: string): AndroidCurrentApp {
  const focus =
    /mCurrentFocus=.*?\s([A-Za-z0-9_.]+)\/([^\s}]+)/.exec(raw) ??
    /mFocusedApp=.*?\s([A-Za-z0-9_.]+)\/([^\s}]+)/.exec(raw);
  return {
    packageName: focus?.[1],
    activity: focus?.[2],
    raw,
  };
}

function limitTreeDepth(
  node: AndroidElementNode,
  maxDepth: number
): AndroidElementNode {
  return {
    ...node,
    children:
      node.depth >= maxDepth
        ? []
        : node.children.map((child) => limitTreeDepth(child, maxDepth)),
  };
}

/** Convenience namespace for Android ADB discovery, connection, and automation. */
export const android = {
  resolveAdbPath,

  /** Discover Android devices currently visible to adb. */
  discover(options?: AndroidOptions): Promise<AndroidDeviceInfo[]> {
    return discoverDevices(options);
  },

  /** Connect to a specific adb serial and return a device automation handle. */
  async connect(options: AndroidConnectOptions): Promise<AndroidDevice> {
    return new AdbDevice(options);
  },

  /** Connect to the only available device, or throw when none/multiple are available. */
  async connectDefault(options?: AndroidOptions): Promise<AndroidDevice> {
    const devices = await discoverDevices(options);
    const available = devices.filter((device) => device.state === "device");
    if (available.length === 1) {
      return new AdbDevice({ serial: available[0].serial, ...options });
    }
    if (available.length === 0) {
      throw new AdbError(
        "ADB_DEVICE_NOT_FOUND",
        "no available Android device; connect USB debugging or use wireless adb connect",
        undefined,
        devices
      );
    }
    throw new AdbError(
      "ADB_MULTIPLE_DEVICES",
      "multiple Android devices are available; use connectAll or pass a serial",
      undefined,
      available
    );
  },

  /** Connect every available device and retain skipped device metadata. */
  async connectAll(options?: AndroidOptions): Promise<AdbDeviceGroup> {
    const devices = await discoverDevices(options);
    const available = devices.filter((device) => device.state === "device");
    const skipped = devices.filter((device) => device.state !== "device");
    return new AdbDeviceGroup(
      available.map((device) => new AdbDevice({ serial: device.serial, ...options })),
      skipped
    );
  },

  /** Pair an Android 11+ wireless debugging target using `adb pair`. */
  pairTcp(options: AndroidPairTcpOptions): Promise<void> {
    return pairTcp(options);
  },

  /** Connect to a paired wireless adb target and return its device handle. */
  async connectNetwork(options: AndroidNetworkOptions): Promise<AndroidDevice> {
    const serial = await connectNetworkRaw(options);
    const devices = await discoverDevices(options);
    const device = devices.find(
      (candidate) => candidate.serial === serial && candidate.state === "device"
    );
    if (!device) {
      throw new AdbError(
        "ADB_DEVICE_NOT_FOUND",
        `wireless Android device connected but not visible to adb: ${serial}`,
        undefined,
        devices
      );
    }
    return new AdbDevice({ serial: device.serial, ...options });
  },

};
