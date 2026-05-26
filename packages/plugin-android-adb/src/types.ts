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

/** How adb can reach a discovered Android device. */
export type AndroidDeviceConnection = "usb" | "network" | "emulator";

/** Metadata reported by `adb devices -l` for one Android target. */
export interface AndroidDeviceInfo {
  /** adb serial used by all device-scoped commands. */
  serial: string;
  /** Current adb transport state. Only `device` is ready for automation. */
  state: AndroidDeviceState;
  /** Inferred transport class based on the adb serial format. */
  connection: AndroidDeviceConnection;
  /** Optional device model reported by adb. */
  model?: string;
  /** Optional Android product name reported by adb. */
  product?: string;
  /** Optional adb transport id reported by newer platform-tools. */
  transportId?: string;
}

/** Options for connecting to a known Android adb serial. */
export interface AndroidConnectOptions {
  /** adb serial such as `emulator-5554`, a USB serial, or `host:port`. */
  serial: string;
  /** Path to the adb executable. Defaults to `SPOTTERJS_ADB_PATH`, PATH lookup, or common SDK locations. */
  adbPath?: string;
  /** Per-command timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
}

/** Shared options for adb discovery and connection helpers. */
export interface AndroidOptions {
  /** Path to the adb executable. Defaults to `SPOTTERJS_ADB_PATH`, PATH lookup, or common SDK locations. */
  adbPath?: string;
  /** Per-command timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
}

/** Options for pairing an Android 11+ wireless debugging device. */
export interface AndroidPairTcpOptions extends AndroidOptions {
  /** Device host or IP address shown in Android wireless debugging. */
  host: string;
  /** Pairing port shown in Android wireless debugging. */
  port: number;
  /** Pairing code shown on the Android device. */
  code: string;
}

/** Options for connecting to a previously paired wireless adb device. */
export interface AndroidNetworkOptions extends AndroidOptions {
  /** Device host or IP address. */
  host: string;
  /** adb connect port. */
  port: number;
}

/** Options for dumping and trimming the Android UIAutomator tree. */
export interface AndroidTreeOptions {
  /** Temporary XML path on the device. Must stay under `/sdcard/`. */
  remotePath?: string;
  /** Maximum element depth to return. Depth starts at 0 for the root node. */
  maxDepth?: number;
}

/** Query fields used to match Android UIAutomator nodes. */
export interface AndroidElementQuery {
  /** Exact visible text match. */
  text?: string;
  /** Substring match against visible text. */
  textContains?: string;
  /** Exact Android resource id match. */
  resourceId?: string;
  /** Substring match against Android resource id. */
  resourceIdContains?: string;
  /** Exact class name match. */
  className?: string;
  /** Substring match against class name. */
  classNameContains?: string;
  /** Exact content description match. */
  contentDescription?: string;
  /** Substring match against content description. */
  contentDescriptionContains?: string;
  /** Exact package name match. */
  packageName?: string;
  /** Match the node clickable flag. */
  clickable?: boolean;
  /** Match the node enabled flag. */
  enabled?: boolean;
  /** Match the node checked flag. */
  checked?: boolean;
  /** Match the node selected flag. */
  selected?: boolean;
  /** Match the node scrollable flag. */
  scrollable?: boolean;
  /** Match the node focusable flag. */
  focusable?: boolean;
}

/** Normalized Android UIAutomator node. Coordinates are in physical device pixels. */
export interface AndroidElementNode {
  /** Visible text, or an empty string when absent. */
  text: string;
  /** Android resource id, or an empty string when absent. */
  resourceId: string;
  /** Android view class name. */
  className: string;
  /** Owning Android package name. */
  packageName: string;
  /** Accessibility content description, or an empty string when absent. */
  contentDescription: string;
  /** Whether UIAutomator marks the node clickable. */
  clickable: boolean;
  /** Whether UIAutomator marks the node enabled. */
  enabled: boolean;
  /** Whether UIAutomator marks the node checked. */
  checked: boolean;
  /** Whether UIAutomator marks the node selected. */
  selected: boolean;
  /** Whether UIAutomator marks the node scrollable. */
  scrollable: boolean;
  /** Whether UIAutomator marks the node focusable. */
  focusable: boolean;
  /** Node bounds in Android device pixel coordinates. */
  bounds: Region;
  /** Center point derived from `bounds`, in Android device pixel coordinates. */
  center: Point;
  /** Child nodes in UIAutomator tree order. */
  children: AndroidElementNode[];
  /** Depth from the root node, where root is 0. */
  depth: number;
  /** Stable tree path such as `0.1.2` within one dump. */
  path: string;
}

/** Query options for element lookup and wait helpers. */
export interface AndroidElementQueryOptions extends AndroidTreeOptions {
  /** Poll interval in milliseconds for wait helpers. Defaults to 250. */
  pollMs?: number;
}

/** Existing node or query object accepted by element action helpers. */
export type AndroidElementTarget = AndroidElementQuery | AndroidElementNode;

/** Android display metrics parsed from `wm size` and `wm density`. */
export interface AndroidDisplayInfo {
  /** Display width in physical device pixels. */
  width: number;
  /** Display height in physical device pixels. */
  height: number;
  /** Display density dpi when available. */
  density?: number;
}

/** Currently focused Android package/activity parsed from dumpsys output. */
export interface AndroidCurrentApp {
  /** Focused package name when it can be parsed. */
  packageName?: string;
  /** Focused activity name when it can be parsed. */
  activity?: string;
  /** Raw dumpsys output used for parsing. */
  raw: string;
}

/** High-level automation handle for one Android adb device. */
export interface AndroidDevice {
  /** adb serial for this device. */
  serial: string;
  /** Refresh device metadata and validate that the target is available. */
  getInfo(): Promise<AndroidDeviceInfo>;
  /** Capture the current screen as RGBA pixels. */
  capture(): Promise<CaptureImage>;
  /** Tap a point in Android device pixel coordinates. */
  tap(x: number, y: number): Promise<void>;
  /** Swipe between two Android device pixel coordinates. */
  swipe(
    from: Point,
    to: Point,
    options?: { durationMs?: number }
  ): Promise<void>;
  /** Type text through `adb shell input text`. */
  text(text: string): Promise<void>;
  /** Send an Android key event name or numeric key code. */
  keyevent(key: string | number): Promise<void>;
  /** Press Android Back. */
  back(): Promise<void>;
  /** Press Android Home. */
  home(): Promise<void>;
  /** Start an Android package or package/activity component. */
  startApp(packageName: string, activity?: string): Promise<void>;
  /** Force-stop an Android package. */
  stopApp(packageName: string): Promise<void>;
  /** Dump and parse the Android UIAutomator tree. */
  dumpTree(options?: AndroidTreeOptions): Promise<AndroidElementNode>;
  /** Find the first UIAutomator node matching a query. */
  findElement(
    query: AndroidElementQuery,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode>;
  /** Find all UIAutomator nodes matching a query. */
  findElements(
    query: AndroidElementQuery,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode[]>;
  /** Poll until a UIAutomator node matching a query is found. */
  waitForElement(
    query: AndroidElementQuery,
    timeoutMs: number,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode>;
  /** Resolve a node or query and tap the target node center. */
  tapElement(
    target: AndroidElementTarget,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode>;
  /** Resolve a node or query, tap it, and type text. */
  typeElement(
    target: AndroidElementTarget,
    text: string,
    options?: AndroidElementQueryOptions
  ): Promise<AndroidElementNode>;
  /** Run a raw adb shell command and return stdout. */
  shell(command: string): Promise<string>;
  /** Read Android display size and density. */
  getDisplayInfo(): Promise<AndroidDisplayInfo>;
  /** Wake the device with a key event. */
  wake(): Promise<void>;
  /** Put the device to sleep with a key event. */
  sleep(): Promise<void>;
  /** Return the currently focused package/activity and raw dumpsys output. */
  currentApp(): Promise<AndroidCurrentApp>;
  /** Clear app data with `pm clear`. */
  clearApp(packageName: string): Promise<void>;
  /** Find the best template match on the current screenshot. */
  find(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult>;
  /** Find all template matches on the current screenshot. */
  findAll(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult[]>;
  /** Poll screenshots until a template match is found. */
  waitFor(
    needle: TemplateImage,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs?: number
  ): Promise<MatchResult>;
}

/** Result envelope for a command run across multiple Android devices. */
export interface AndroidBatchResult<T> {
  /** adb serial for the device that produced this result. */
  serial: string;
  /** Whether the command completed successfully for this device. */
  ok: boolean;
  /** Successful result value, when any. */
  value?: T;
  /** Error message when `ok` is false. */
  error?: string;
  /** Error code when the thrown error exposes one. */
  code?: string;
}

/** Batch automation handle for every currently available Android device. */
export interface AndroidDeviceGroup {
  /** Device handles with adb state `device`. */
  devices: AndroidDevice[];
  /** Discovered devices skipped because they were offline, unauthorized, or unknown. */
  skipped: AndroidDeviceInfo[];
  /** Tap the same Android device pixel coordinate on every available device. */
  tapAll(x: number, y: number): Promise<Array<AndroidBatchResult<void>>>;
  /** Swipe the same Android device pixel coordinates on every available device. */
  swipeAll(
    from: Point,
    to: Point,
    options?: { durationMs?: number }
  ): Promise<Array<AndroidBatchResult<void>>>;
  /** Capture screenshots from every available device. */
  captureAll(): Promise<Array<AndroidBatchResult<CaptureImage>>>;
}
