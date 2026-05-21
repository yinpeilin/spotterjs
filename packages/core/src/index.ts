import { loadNative } from "./native";
import type { NativeWindow } from "./native";
import { centerOf, type CaptureImage, type Region } from "@spotter/base";
import { encodePngBase64 } from "./capture";

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
 * 键名格式与 native 层一致（如 `"enter"`、`"ctrl"`、`"a"`）。
 */
export const keyboard = {
  /** 输入 Unicode 文本（逐字符） */
  type(text: string) {
    loadNative().keyboardTypeText(text);
  },

  /** 按下多个键（组合键第一步） */
  press(keys: string[]) {
    loadNative().keyboardPressKeys(keys);
  },

  /** 释放多个键 */
  release(keys: string[]) {
    loadNative().keyboardReleaseKeys(keys);
  },

  /** 按下并释放单个键 */
  typeKey(key: string) {
    loadNative().keyboardTypeKey(key);
  },

  /** 快捷键：依次 press → release */
  shortcut(keys: string[]) {
    loadNative().keyboardShortcut(keys);
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

export * from "@spotter/base";
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
  matchTapScreen,
  toLocal,
  toMatchBox,
  toScreen,
} from "./match-coords";
export type { MatchBox, WindowFrame } from "./match-coords";
