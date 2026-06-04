import WebSocket = require("ws");
import {
  isSpotterError,
  SpotterError,
  toSpotterError,
  type Point,
  type Region,
  type SpotterErrorCode,
  type SpotterErrorContext,
  type SpotterErrorOptions,
} from "@spotterjs/base";

const PROTOCOL_VERSION = 2;
const DEFAULT_TIMEOUT_MS = 30_000;

export type AndroidErrorCode = `SPOTTER_ANDROID_${string}`;
export type AndroidErrorContext = SpotterErrorContext;

export {
  isSpotterError,
  SpotterError,
  toSpotterError,
  type SpotterErrorCode,
  type SpotterErrorContext,
};

function androidError(
  code: AndroidErrorCode,
  message: string,
  options: Omit<SpotterErrorOptions, "domain"> = {}
): SpotterError {
  return new SpotterError(code, message, {
    ...options,
    domain: "android",
  });
}

export interface AndroidPairOptions {
  url: string;
  code: string;
  clientId?: string;
  timeoutMs?: number;
}

export interface AndroidConnectOptions {
  url: string;
  sessionToken: string;
  timeoutMs?: number;
}

export interface AndroidTreeOptions {
  maxDepth?: number;
}

export interface AndroidGesturePoint {
  x: number;
  y: number;
}

export interface AndroidGestureStroke {
  points: AndroidGesturePoint[];
  durationMs?: number;
  startDelayMs?: number;
}

export interface AndroidElementNode {
  text: string;
  resourceId: string;
  className: string;
  packageName: string;
  contentDescription: string;
  clickable: boolean;
  enabled: boolean;
  checked: boolean;
  selected: boolean;
  scrollable: boolean;
  focusable: boolean;
  bounds: Region;
  center: Point;
  children: AndroidElementNode[];
  depth: number;
  path: string;
}

export interface AndroidDisplayInfo {
  width: number;
  height: number;
  density?: number;
}

export interface AndroidCurrentApp {
  packageName?: string;
  activity?: string;
}

export interface AndroidCompanionDevice {
  readonly url: string;
  readonly sessionToken: string;
  close(): void;
  heartbeat(): Promise<void>;
  status(): Promise<Record<string, unknown>>;
  dumpTree(options?: AndroidTreeOptions): Promise<AndroidElementNode>;
  tap(x: number, y: number): Promise<void>;
  swipe(from: Point, to: Point, options?: { durationMs?: number }): Promise<void>;
  gesture(strokes: AndroidGestureStroke[]): Promise<void>;
  text(text: string): Promise<void>;
  keyevent(key: string | number): Promise<void>;
  back(): Promise<void>;
  home(): Promise<void>;
  launchApp(packageName: string): Promise<AndroidCurrentApp>;
  getDisplayInfo(): Promise<AndroidDisplayInfo>;
  currentApp(): Promise<AndroidCurrentApp>;
}

type JsonMessage = Record<string, unknown>;
type RawData = WebSocket.RawData;
type PendingWait = {
  resolve: (value: JsonMessage) => void;
  reject: (error: unknown) => void;
  timer: NodeJS.Timeout;
};

class SocketSession {
  readonly socket: WebSocket;
  private readonly buffer: JsonMessage[] = [];
  private readonly waiters: PendingWait[] = [];
  private failure: unknown;

  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on("message", (raw: RawData) => this.onMessage(raw));
    socket.on("close", () =>
      this.fail(
        androidError(
          "SPOTTER_ANDROID_COMPANION_CONNECTION_CLOSED",
          "Android companion connection closed"
        )
      )
    );
    socket.on("error", (error) =>
      this.fail(
        androidError("SPOTTER_ANDROID_COMPANION_CONNECTION_FAILED", "Android companion socket error", {
          context: { message: error.message },
          cause: error,
        })
      )
    );
  }

  close(): void {
    this.socket.close();
  }

  send(message: JsonMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.send(JSON.stringify(message), (error: Error | undefined) => {
        if (error) {
          reject(
            androidError("SPOTTER_ANDROID_COMPANION_SEND_FAILED", "Failed to send Android companion message", {
              context: { messageType: message.type },
              cause: error,
            })
          );
        }
        else resolve();
      });
    });
  }

  nextMessage(timeoutMs: number): Promise<JsonMessage> {
    if (this.failure !== undefined) {
      return Promise.reject(this.failure);
    }
    const buffered = this.buffer.shift();
    if (buffered !== undefined) {
      return Promise.resolve(buffered);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeWaiter(waiter);
        reject(
          androidError(
            "SPOTTER_ANDROID_COMPANION_TIMEOUT",
            "Timed out waiting for Android companion response",
            { context: { timeoutMs } }
          )
        );
      }, timeoutMs);
      const waiter: PendingWait = {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        timer,
      };
      this.waiters.push(waiter);
    });
  }

  private onMessage(raw: RawData): void {
    let message: JsonMessage;
    try {
      message = parseMessage(raw);
    } catch (error) {
      this.fail(error);
      return;
    }

    const waiter = this.waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(message);
      return;
    }
    this.buffer.push(message);
  }

  private fail(error: unknown): void {
    if (this.failure !== undefined) return;
    this.failure = error;
    while (this.waiters.length) {
      const waiter = this.waiters.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.reject(error);
      }
    }
    this.buffer.length = 0;
  }

  private removeWaiter(waiter: PendingWait): void {
    const index = this.waiters.indexOf(waiter);
    if (index >= 0) {
      this.waiters.splice(index, 1);
    }
  }
}

class CompanionDevice implements AndroidCompanionDevice {
  readonly url: string;
  readonly sessionToken: string;
  private readonly session: SocketSession;
  private readonly timeoutMs: number;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: {
    url: string;
    sessionToken: string;
    session: SocketSession;
    timeoutMs: number;
  }) {
    this.url = options.url;
    this.sessionToken = options.sessionToken;
    this.session = options.session;
    this.timeoutMs = options.timeoutMs;
  }

  close(): void {
    this.session.close();
  }

  async heartbeat(): Promise<void> {
    await this.request({ type: "heartbeat", sessionToken: this.sessionToken }, "pong");
  }

  async status(): Promise<Record<string, unknown>> {
    const response = await this.request(
      { type: "status", sessionToken: this.sessionToken },
      "status"
    );
    return readObject(response, "state");
  }

  async dumpTree(options: AndroidTreeOptions = {}): Promise<AndroidElementNode> {
    const response = await this.request(
      {
        type: "dumpTree",
        sessionToken: this.sessionToken,
        ...defined({ maxDepth: options.maxDepth }),
      },
      "tree"
    );
    return readObject(response, "tree") as unknown as AndroidElementNode;
  }

  async tap(x: number, y: number): Promise<void> {
    await this.request({ type: "tap", sessionToken: this.sessionToken, x, y }, "ok");
  }

  async swipe(
    from: Point,
    to: Point,
    options: { durationMs?: number } = {}
  ): Promise<void> {
    await this.request(
      {
        type: "swipe",
        sessionToken: this.sessionToken,
        from,
        to,
        ...defined({ durationMs: options.durationMs }),
      },
      "ok"
    );
  }

  async gesture(strokes: AndroidGestureStroke[]): Promise<void> {
    await this.request(
      {
        type: "gesture",
        sessionToken: this.sessionToken,
        strokes: strokes.map((stroke) => ({
          points: stroke.points,
          ...defined({ durationMs: stroke.durationMs, startDelayMs: stroke.startDelayMs }),
        })),
      },
      "ok"
    );
  }

  async text(text: string): Promise<void> {
    await this.request({ type: "text", sessionToken: this.sessionToken, text }, "ok");
  }

  async keyevent(key: string | number): Promise<void> {
    await this.request({ type: "keyevent", sessionToken: this.sessionToken, key }, "ok");
  }

  back(): Promise<void> {
    return this.keyevent("BACK");
  }

  home(): Promise<void> {
    return this.keyevent("HOME");
  }

  async launchApp(packageName: string): Promise<AndroidCurrentApp> {
    const response = await this.request(
      { type: "launchApp", sessionToken: this.sessionToken, packageName },
      "appLaunched"
    );
    return {
      packageName: readOptionalString(response, "packageName"),
      activity: readOptionalString(response, "activity"),
    };
  }

  async getDisplayInfo(): Promise<AndroidDisplayInfo> {
    const response = await this.request(
      { type: "displayInfo", sessionToken: this.sessionToken },
      "displayInfo"
    );
    return {
      width: readNumber(response, "width"),
      height: readNumber(response, "height"),
      density:
        response.density === undefined ? undefined : readNumber(response, "density"),
    };
  }

  async currentApp(): Promise<AndroidCurrentApp> {
    const response = await this.request(
      { type: "currentApp", sessionToken: this.sessionToken },
      "currentApp"
    );
    return {
      packageName: readOptionalString(response, "packageName"),
      activity: readOptionalString(response, "activity"),
    };
  }

  private request(message: JsonMessage, expectedType: string): Promise<JsonMessage> {
    return this.enqueue(async () => {
      await this.session.send(message);
      const response = await this.session.nextMessage(this.timeoutMs);
      if (response.type === "error") {
        throw errorFromMessage(response);
      }
      if (response.type !== expectedType) {
        throw androidError(
          "SPOTTER_ANDROID_COMPANION_INVALID_MESSAGE",
          `Expected ${expectedType} response, got ${String(response.type)}`,
          { context: { responseType: response.type } }
        );
      }
      return response;
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.then(noop, noop);
    return next;
  }
}

export const android = {
  async pair(options: AndroidPairOptions): Promise<AndroidCompanionDevice> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const session = await openSession(options.url, timeoutMs);
    const hello = await session.nextMessage(timeoutMs);
    assertMessageType(hello, "hello");
    assertProtocolVersion(hello);
    const token = await pairSession(session, options, timeoutMs);
    return new CompanionDevice({
      url: options.url,
      sessionToken: token,
      session,
      timeoutMs,
    });
  },

  async connect(options: AndroidConnectOptions): Promise<AndroidCompanionDevice> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const session = await openSession(options.url, timeoutMs);
    const hello = await session.nextMessage(timeoutMs);
    assertMessageType(hello, "hello");
    assertProtocolVersion(hello);
    return new CompanionDevice({
      url: options.url,
      sessionToken: options.sessionToken,
      session,
      timeoutMs,
    });
  },
};

function openSession(url: string, timeoutMs: number): Promise<SocketSession> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(
        androidError(
          "SPOTTER_ANDROID_COMPANION_TIMEOUT",
          "Timed out opening Android companion connection",
          { context: { timeoutMs, url } }
        )
      );
    }, timeoutMs);
    socket.once("open", () => {
      clearTimeout(timer);
      resolve(new SocketSession(socket));
    });
    socket.once("error", (error: Error) => {
      clearTimeout(timer);
      reject(
        androidError("SPOTTER_ANDROID_COMPANION_CONNECTION_FAILED", "Failed to open Android companion connection", {
          context: { url, message: error.message },
          cause: error,
        })
      );
    });
  });
}

function pairSession(
  session: SocketSession,
  options: AndroidPairOptions,
  timeoutMs: number
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      await session.send({
        type: "pair",
        protocolVersion: PROTOCOL_VERSION,
        clientId: options.clientId,
        code: options.code,
      });
      const response = await session.nextMessage(timeoutMs);
      if (response.type === "error") {
        reject(errorFromMessage(response));
        return;
      }
      assertMessageType(response, "paired");
      resolve(readString(response, "sessionToken"));
    } catch (error: unknown) {
      reject(error);
    }
  });
}

function assertMessageType(message: JsonMessage, expectedType: string): void {
  if (message.type !== expectedType) {
    throw androidError(
      "SPOTTER_ANDROID_COMPANION_INVALID_MESSAGE",
      `Expected ${expectedType} response, got ${String(message.type)}`,
      { context: { responseType: message.type } }
    );
  }
}

function assertProtocolVersion(message: JsonMessage): void {
  if (message.protocolVersion !== PROTOCOL_VERSION) {
    throw androidError(
      "SPOTTER_ANDROID_COMPANION_INVALID_MESSAGE",
      `Expected protocolVersion ${PROTOCOL_VERSION}, got ${String(message.protocolVersion)}`,
      { context: { protocolVersion: message.protocolVersion } }
    );
  }
}

function parseMessage(raw: RawData): JsonMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw)) as unknown;
  } catch (error) {
    throw androidError("SPOTTER_ANDROID_COMPANION_INVALID_MESSAGE", "Android companion message must be valid JSON", {
      context: { raw: String(raw).slice(0, 200) },
      cause: error,
    });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw androidError(
      "SPOTTER_ANDROID_COMPANION_INVALID_MESSAGE",
      "Android companion message must be a JSON object"
    );
  }
  return parsed as JsonMessage;
}

function errorFromMessage(message: JsonMessage): SpotterError {
  const remoteCode = readOptionalString(message, "code");
  return androidError(
    "SPOTTER_ANDROID_COMPANION_ERROR",
    readOptionalString(message, "message") ?? "Android companion returned an error",
    { context: { response: message, ...defined({ remoteCode }) } }
  );
}

function readString(message: JsonMessage, key: string): string {
  const value = message[key];
  if (typeof value !== "string") {
    throw androidError(
      "SPOTTER_ANDROID_COMPANION_INVALID_MESSAGE",
      `${key} must be a string`,
      { context: { key, value } }
    );
  }
  return value;
}

function readOptionalString(message: JsonMessage, key: string): string | undefined {
  const value = message[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw androidError(
      "SPOTTER_ANDROID_COMPANION_INVALID_MESSAGE",
      `${key} must be a string`,
      { context: { key, value } }
    );
  }
  return value;
}

function readNumber(message: JsonMessage, key: string): number {
  const value = message[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw androidError(
      "SPOTTER_ANDROID_COMPANION_INVALID_MESSAGE",
      `${key} must be a finite number`,
      { context: { key, value } }
    );
  }
  return value;
}

function readObject(message: JsonMessage, key: string): Record<string, unknown> {
  const value = message[key];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw androidError(
      "SPOTTER_ANDROID_COMPANION_INVALID_MESSAGE",
      `${key} must be an object`,
      { context: { key, value } }
    );
  }
  return value as Record<string, unknown>;
}

function defined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
}

function noop(): void {
  return undefined;
}
