import type {
  CaptureImage,
  MatchOptions,
  MatchResult,
  Point,
  Region,
  TemplateImage,
} from "@spotterjs/base";

export type AndroidDeviceState =
  | "device"
  | "offline"
  | "unauthorized"
  | "unknown";

export type AndroidDeviceConnection = "usb" | "network" | "emulator";

export interface AndroidDeviceInfo {
  serial: string;
  state: AndroidDeviceState;
  connection: AndroidDeviceConnection;
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

export interface AndroidPairTcpOptions extends AndroidOptions {
  host: string;
  port: number;
  code: string;
}

export interface AndroidNetworkOptions extends AndroidOptions {
  host: string;
  port: number;
}

export interface AndroidTreeOptions {
  remotePath?: string;
  maxDepth?: number;
}

export interface AndroidElementQuery {
  text?: string;
  textContains?: string;
  resourceId?: string;
  resourceIdContains?: string;
  className?: string;
  classNameContains?: string;
  contentDescription?: string;
  contentDescriptionContains?: string;
  packageName?: string;
  clickable?: boolean;
  enabled?: boolean;
  checked?: boolean;
  selected?: boolean;
  scrollable?: boolean;
  focusable?: boolean;
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

export interface AndroidElementQueryOptions extends AndroidTreeOptions {
  pollMs?: number;
}

export type AndroidElementTarget = AndroidElementQuery | AndroidElementNode;

export interface AndroidDisplayInfo {
  width: number;
  height: number;
  density?: number;
}

export interface AndroidCurrentApp {
  packageName?: string;
  activity?: string;
  raw: string;
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
  dumpTree(options?: AndroidTreeOptions): Promise<AndroidElementNode>;
  findElement(
    query: AndroidElementQuery,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode>;
  findElements(
    query: AndroidElementQuery,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode[]>;
  waitForElement(
    query: AndroidElementQuery,
    timeoutMs: number,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode>;
  tapElement(
    target: AndroidElementTarget,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode>;
  typeElement(
    target: AndroidElementTarget,
    text: string,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode>;
  shell(command: string): Promise<string>;
  getDisplayInfo(): Promise<AndroidDisplayInfo>;
  wake(): Promise<void>;
  sleep(): Promise<void>;
  currentApp(): Promise<AndroidCurrentApp>;
  clearApp(packageName: string): Promise<void>;
  find(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult>;
  findAll(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult[]>;
  waitFor(
    needle: TemplateImage,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs?: number
  ): Promise<MatchResult>;
}

export interface AndroidBatchResult<T> {
  serial: string;
  ok: boolean;
  value?: T;
  error?: string;
}

export interface AndroidDeviceGroup {
  devices: AndroidDevice[];
  skipped: AndroidDeviceInfo[];
  tapAll(x: number, y: number): Promise<Array<AndroidBatchResult<void>>>;
  swipeAll(
    from: Point,
    to: Point,
    options?: { durationMs?: number }
  ): Promise<Array<AndroidBatchResult<void>>>;
  captureAll(): Promise<Array<AndroidBatchResult<CaptureImage>>>;
}
