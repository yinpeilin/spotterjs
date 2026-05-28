import WebSocket = require("ws");
import type { Point, Region } from "@spotterjs/base";

const PROTOCOL_VERSION = 2;
const DEFAULT_TIMEOUT_MS = 30_000;

export type AndroidCompanionErrorCode =
  | "ANDROID_COMPANION_TIMEOUT"
  | "ANDROID_COMPANION_CONNECTION_CLOSED"
  | "ANDROID_COMPANION_INVALID_MESSAGE"
  | string;

export class AndroidCompanionError extends Error {
  readonly code: AndroidCompanionErrorCode;
  readonly context?: Record<string, unknown>;

  constructor(
    code: AndroidCompanionErrorCode,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AndroidCompanionError";
    this.code = code;
    this.context = context;
  }
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
        new AndroidCompanionError(
          "ANDROID_COMPANION_CONNECTION_CLOSED",
          "Android companion connection closed"
        )
      )
    );
    socket.on("error", (error) => this.fail(error));
  }

  close(): void {
    this.socket.close();
  }

  send(message: JsonMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.send(JSON.stringify(message), (error: Error | undefined) => {
        if (error) reject(error);
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
          new AndroidCompanionError(
            "ANDROID_COMPANION_TIMEOUT",
            "Timed out waiting for Android companion response",
            { timeoutMs }
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
        throw new AndroidCompanionError(
          "ANDROID_COMPANION_INVALID_MESSAGE",
          `Expected ${expectedType} response, got ${String(response.type)}`,
          { responseType: response.type }
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
        new AndroidCompanionError(
          "ANDROID_COMPANION_TIMEOUT",
          "Timed out opening Android companion connection",
          { timeoutMs, url }
        )
      );
    }, timeoutMs);
    socket.once("open", () => {
      clearTimeout(timer);
      resolve(new SocketSession(socket));
    });
    socket.once("error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
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
    throw new AndroidCompanionError(
      "ANDROID_COMPANION_INVALID_MESSAGE",
      `Expected ${expectedType} response, got ${String(message.type)}`,
      { responseType: message.type }
    );
  }
}

function assertProtocolVersion(message: JsonMessage): void {
  if (message.protocolVersion !== PROTOCOL_VERSION) {
    throw new AndroidCompanionError(
      "ANDROID_COMPANION_INVALID_MESSAGE",
      `Expected protocolVersion ${PROTOCOL_VERSION}, got ${String(message.protocolVersion)}`,
      { protocolVersion: message.protocolVersion }
    );
  }
}

function parseMessage(raw: RawData): JsonMessage {
  const parsed = JSON.parse(String(raw)) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AndroidCompanionError(
      "ANDROID_COMPANION_INVALID_MESSAGE",
      "Android companion message must be a JSON object"
    );
  }
  return parsed as JsonMessage;
}

function errorFromMessage(message: JsonMessage): AndroidCompanionError {
  return new AndroidCompanionError(
    readOptionalString(message, "code") ?? "ANDROID_COMPANION_ERROR",
    readOptionalString(message, "message") ?? "Android companion returned an error",
    { response: message }
  );
}

function readString(message: JsonMessage, key: string): string {
  const value = message[key];
  if (typeof value !== "string") {
    throw new AndroidCompanionError(
      "ANDROID_COMPANION_INVALID_MESSAGE",
      `${key} must be a string`,
      { key, value }
    );
  }
  return value;
}

function readOptionalString(message: JsonMessage, key: string): string | undefined {
  const value = message[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new AndroidCompanionError(
      "ANDROID_COMPANION_INVALID_MESSAGE",
      `${key} must be a string`,
      { key, value }
    );
  }
  return value;
}

function readNumber(message: JsonMessage, key: string): number {
  const value = message[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AndroidCompanionError(
      "ANDROID_COMPANION_INVALID_MESSAGE",
      `${key} must be a finite number`,
      { key, value }
    );
  }
  return value;
}

function readObject(message: JsonMessage, key: string): Record<string, unknown> {
  const value = message[key];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AndroidCompanionError(
      "ANDROID_COMPANION_INVALID_MESSAGE",
      `${key} must be an object`,
      { key, value }
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
