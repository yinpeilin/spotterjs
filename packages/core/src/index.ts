import { loadNative } from "./native";
import type { NativeWindow } from "./native";
import { centerOf, type CaptureImage, type Region } from "@spotterjs/base";
import { encodePngBase64 } from "./capture";

type LetterKey =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z"
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

type FunctionKey =
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "F5"
  | "F6"
  | "F7"
  | "F8"
  | "F9"
  | "F10"
  | "F11"
  | "F12";

type NamedKey =
  | "Enter"
  | "Return"
  | "Tab"
  | "Escape"
  | "Esc"
  | "Space"
  | "Backspace"
  | "Delete"
  | "Up"
  | "Down"
  | "Left"
  | "Right"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"
  | "Ctrl"
  | "Control"
  | "LeftControl"
  | "RightControl"
  | "Shift"
  | "LeftShift"
  | "RightShift"
  | "Alt"
  | "LeftAlt"
  | "RightAlt"
  | "Meta"
  | "Win"
  | "Cmd"
  | "LeftSuper"
  | "RightSuper";

/**
 * 键盘按键名称。
 *
 * 推荐使用 `Enter`、`Ctrl`、`V` 这类首字母大写/大写字母写法。
 * 常见小写别名（如 `enter`、`ctrl`、`esc`）由 native 层兼容解析。
 */
export type KeyName =
  | LetterKey
  | FunctionKey
  | Lowercase<FunctionKey>
  | NamedKey
  | Lowercase<NamedKey>;

type KeyInput = KeyName | KeyName[];

const pressedKeys = new Set<string>();

function keyList(keys: KeyInput): string[] {
  return (Array.isArray(keys) ? keys : [keys]).map((key) => String(key));
}

function normalizeKeyName(key: string): string {
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();
  if (/^[a-z]$/.test(lower)) return lower.toUpperCase();
  const aliases: Record<string, string> = {
    enter: "Enter",
    return: "Enter",
    tab: "Tab",
    escape: "Escape",
    esc: "Escape",
    space: "Space",
    backspace: "Backspace",
    delete: "Delete",
    up: "Up",
    down: "Down",
    left: "Left",
    right: "Right",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
    ctrl: "Ctrl",
    control: "Ctrl",
    leftcontrol: "LeftControl",
    rightcontrol: "RightControl",
    shift: "Shift",
    leftshift: "LeftShift",
    rightshift: "RightShift",
    alt: "Alt",
    leftalt: "LeftAlt",
    rightalt: "RightAlt",
    meta: "Meta",
    win: "Win",
    cmd: "Cmd",
    leftsuper: "LeftSuper",
    rightsuper: "RightSuper",
  };
  if (/^f([1-9]|1[0-2])$/.test(lower)) return lower.toUpperCase();
  return aliases[lower] ?? trimmed;
}

function mapWindow(w: NativeWindow) {
  return {
    id: w.id,
    idHex: w.idHex,
    title: w.title,
    region: w.region,
    processId: w.processId,
    processName: w.processName,
    exePath: w.exePath,
    isMinimized: w.isMinimized,
    isForeground: w.isForeground,
  };
}

/**
 * 鼠标输入模拟。
 *
 * 坐标均为屏幕像素。可通过 {@link mouse.setConfig} 调整移动速度与操作间隔。
 */
export const mouse = {
  /** 当前光标位置（屏幕坐标） */
  getPosition() {
    return loadNative().getPosition();
  },

  /** 移动光标到 `(x, y)`（带轨迹/延迟，由 native 配置决定） */
  move(x: number, y: number) {
    loadNative().mouseMove(x, y);
  },

  /** 沿路径逐点移动 */
  movePath(points: Array<{ x: number; y: number }>) {
    loadNative().mouseMovePath(points);
  },

  /** 直线移动到 `(x, y)`（比 `move` 更直接） */
  moveStraight(x: number, y: number) {
    loadNative().mouseMoveStraight(x, y);
  },

  /** 单击；默认左键 */
  click(button?: "left" | "right" | "middle") {
    loadNative().mouseClick(button);
  },

  /** 双击；默认左键 */
  doubleClick(button?: "left" | "right" | "middle") {
    loadNative().mouseDoubleClick(button);
  },

  /** 按下按键（不释放） */
  press(button?: "left" | "right" | "middle") {
    loadNative().mousePress(button);
  },

  /** 释放按键 */
  release(button?: "left" | "right" | "middle") {
    loadNative().mouseRelease(button);
  },

  /** 按住按键拖拽到 `(x, y)` */
  drag(x: number, y: number, button?: "left" | "right" | "middle") {
    loadNative().mouseDrag(x, y, button);
  },

  /**
   * 滚轮。
   * @param direction 滚动方向
   * @param amount 滚动量，默认 1
   */
  scroll(direction: "up" | "down" | "left" | "right", amount = 1) {
    const n = loadNative();
    switch (direction) {
      case "up":
        n.mouseScrollUp(amount);
        break;
      case "down":
        n.mouseScrollDown(amount);
        break;
      case "left":
        n.mouseScrollLeft(amount);
        break;
      case "right":
        n.mouseScrollRight(amount);
        break;
    }
  },

  /** 移动并单击 `(x, y)` */
  tap(x: number, y: number, button?: "left" | "right" | "middle") {
    loadNative().tapAt(x, y, button);
  },

  /**
   * 鼠标行为配置。
   * @param config.autoDelayMs 各步操作间延迟
   * @param config.mouseSpeed 移动速度（native 语义）
   */
  setConfig(config: { autoDelayMs?: number; mouseSpeed?: number }) {
    loadNative().setMouseConfig({
      autoDelayMs: config.autoDelayMs,
      mouseSpeed: config.mouseSpeed,
    });
  },
};

/**
 * 键盘输入模拟。
 *
 * 推荐键名写法：`"Enter"`、`"Ctrl"`、`"V"`。小写常见别名由 native 层兼容。
 * `up()` 只释放由 `down()` 记录的按键；需要强制发送 key-up 时使用 `rawUp()`。
 */
export const keyboard = {
  /** 输入 Unicode 文本。 */
  write(text: string) {
    loadNative().keyboardTypeText(text);
  },

  /** 按下并释放单个按键。 */
  tap(key: KeyName) {
    loadNative().keyboardTypeKey(String(key));
  },

  /** 按住一个或多个按键，并记录按下状态。 */
  down(keys: KeyInput) {
    const names = keyList(keys);
    loadNative().keyboardPressKeys(names);
    for (const name of names) {
      pressedKeys.add(normalizeKeyName(name));
    }
  },

  /** 释放由 {@link keyboard.down} 记录为按下的按键；未记录的按键会静默跳过。 */
  up(keys: KeyInput) {
    const names = keyList(keys);
    const releasable = names
      .filter((name) => pressedKeys.has(normalizeKeyName(name)))
      .reverse();
    if (releasable.length === 0) return;
    loadNative().keyboardReleaseKeys(releasable);
    for (const name of releasable) {
      pressedKeys.delete(normalizeKeyName(name));
    }
  },

  /** 直接发送底层 key-down，不记录状态。 */
  rawDown(keys: KeyInput) {
    loadNative().keyboardPressKeys(keyList(keys));
  },

  /** 直接发送底层 key-up，不检查状态。 */
  rawUp(keys: KeyInput) {
    loadNative().keyboardReleaseKeys(keyList(keys));
  },

  /** 快捷键：按住修饰键，敲击最后一个键，再释放修饰键。 */
  hotkey(keys: KeyName[]) {
    if (keys.length === 0) return;
    if (keys.length === 1) {
      keyboard.tap(keys[0]);
      return;
    }
    const modifiers = keys.slice(0, -1);
    const key = keys[keys.length - 1];
    keyboard.down(modifiers);
    try {
      keyboard.tap(key);
    } finally {
      keyboard.up(modifiers);
    }
  },

  /** @param config.autoDelayMs 按键间隔 */
  setConfig(config: { autoDelayMs?: number }) {
    loadNative().setKeyboardConfig({ autoDelayMs: config.autoDelayMs });
  },
};

/** 系统剪贴板读写（文本） */
export const clipboard = {
  set(text: string) {
    loadNative().clipboardSet(text);
  },
  get(): string {
    return loadNative().clipboardGet();
  },
};

/**
 * 顶层窗口管理（枚举、聚焦、移动、截图等）。
 *
 * 窗口 ID 来自 {@link desktop} 或 `list()`，为十进制字符串。
 */
export const windowApi = {
  /** 列出所有顶层窗口 */
  list() {
    return loadNative().listWindows().map(mapWindow);
  },

  /** 当前前台窗口 */
  getActive() {
    return mapWindow(loadNative().getActiveWindow());
  },

  /**
   * 将窗口置于前台。
   * @returns native 层是否成功
   */
  focus(id: string) {
    return loadNative().focusWindow(id);
  },

  /** 窗口外框屏幕区域 */
  getRegion(id: string) {
    return loadNative().getWindowRegion(id);
  },

  /** 外框区域，裁剪到可见屏幕范围 */
  getRegionClamped(id: string) {
    return loadNative().getWindowRegionClamped(id);
  },

  /** 客户区左上角在屏幕上的坐标 */
  getClientOrigin(id: string) {
    return loadNative().getWindowClientOrigin(id);
  },

  move(id: string, x: number, y: number) {
    loadNative().moveWindow(id, x, y);
  },

  resize(id: string, width: number, height: number) {
    loadNative().resizeWindow(id, width, height);
  },

  minimize(id: string) {
    loadNative().minimizeWindow(id);
  },

  restore(id: string) {
    loadNative().restoreWindow(id);
  },

  /** 截取窗口内容为 RGBA {@link CaptureImage} */
  capture(id: string): CaptureImage {
    return loadNative().captureWindow(id);
  },
};

export { centerOf };

/**
 * 将 {@link CaptureImage} 编码为 Base64 PNG。
 *
 * 等价于 `encodePngBase64(capture)`，便于 MCP / JSON 场景。
 */
export function captureToBase64(capture: CaptureImage): string {
  return encodePngBase64(capture);
}

export * from "@spotterjs/base";
export { screen } from "./screen";
export { findInWindow, findAllInWindow, tapInWindow } from "./template";
export { loadNative } from "./native";
export type {
  SpotterNative,
  NativeSpotter,
  NativeWindow,
  NativeDesktopApp,
  NativeCapture,
  NativeMatchOptions,
} from "./native";
export { accessibility } from "./accessibility";
export type {
  A11yQuery,
  A11yConfig,
  A11yDebugApi,
  A11yQuickApi,
  TreeHealth,
  AttachReport,
  TreeViewMode,
  TreeDumpOptions,
  ElementInfo,
  TreeNodeDump,
} from "./accessibility";
export { desktop } from "./desktop";
export { host, configureHost, HostPathError } from "./host";
export type { ShellInfo, ExecResult, DirEntry } from "./host";
export { encodePng, encodePngBase64 } from "./capture";
export {
  findAllInCapture,
  findInCapture,
  loadImageFromBuffer,
  waitForInCapture,
} from "./buffer-match";
export {
  matchTapScreen,
  toLocal,
  toMatchBox,
  toScreen,
} from "./match-coords";
export type { MatchBox, WindowFrame } from "./match-coords";
