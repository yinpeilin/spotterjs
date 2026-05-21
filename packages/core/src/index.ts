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
export type { A11yQuery, A11yConfig, TreeHealth, AttachReport } from "./accessibility";
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

export const mouse = {
  getPosition() {
    return loadNative().getPosition();
  },
  move(x: number, y: number) {
    loadNative().mouseMove(x, y);
  },
  movePath(points: Array<{ x: number; y: number }>) {
    loadNative().mouseMovePath(points);
  },
  moveStraight(x: number, y: number) {
    loadNative().mouseMoveStraight(x, y);
  },
  click(button?: "left" | "right" | "middle") {
    loadNative().mouseClick(button);
  },
  doubleClick(button?: "left" | "right" | "middle") {
    loadNative().mouseDoubleClick(button);
  },
  press(button?: "left" | "right" | "middle") {
    loadNative().mousePress(button);
  },
  release(button?: "left" | "right" | "middle") {
    loadNative().mouseRelease(button);
  },
  drag(x: number, y: number, button?: "left" | "right" | "middle") {
    loadNative().mouseDrag(x, y, button);
  },
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
  tap(x: number, y: number, button?: "left" | "right" | "middle") {
    loadNative().tapAt(x, y, button);
  },
  setConfig(config: { autoDelayMs?: number; mouseSpeed?: number }) {
    loadNative().setMouseConfig({
      autoDelayMs: config.autoDelayMs,
      mouseSpeed: config.mouseSpeed,
    });
  },
};

export const keyboard = {
  type(text: string) {
    loadNative().keyboardTypeText(text);
  },
  press(keys: string[]) {
    loadNative().keyboardPressKeys(keys);
  },
  release(keys: string[]) {
    loadNative().keyboardReleaseKeys(keys);
  },
  typeKey(key: string) {
    loadNative().keyboardTypeKey(key);
  },
  shortcut(keys: string[]) {
    loadNative().keyboardShortcut(keys);
  },
  setConfig(config: { autoDelayMs?: number }) {
    loadNative().setKeyboardConfig({ autoDelayMs: config.autoDelayMs });
  },
};

export const clipboard = {
  set(text: string) {
    loadNative().clipboardSet(text);
  },
  get(): string {
    return loadNative().clipboardGet();
  },
};

export const windowApi = {
  list() {
    return loadNative().listWindows().map(mapWindow);
  },
  getActive() {
    return mapWindow(loadNative().getActiveWindow());
  },
  focus(id: string) {
    return loadNative().focusWindow(id);
  },
  getRegion(id: string) {
    return loadNative().getWindowRegion(id);
  },
  getRegionClamped(id: string) {
    return loadNative().getWindowRegionClamped(id);
  },
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
  capture(id: string): CaptureImage {
    return loadNative().captureWindow(id);
  },
};

export { centerOf };

export function captureToBase64(capture: CaptureImage): string {
  return encodePngBase64(capture);
}
