import {
  type CaptureImage,
  type MatchOptions,
  type MatchResult,
  type TemplateImage,
  type WindowInfo,
} from "@spotterjs/base";
import { callNative } from "./errors";
import { loadNative, type NativeWindow } from "./native";
import { findAllNeedleInWindow, findNeedleInWindow } from "./match";

function mapWindow(w: NativeWindow): WindowInfo {
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

export type WindowWaitOptions = {
  titleContains: string;
  timeoutMs: number;
  pollMs?: number;
};

export const windows = {
  /** List all top-level windows. */
  list(): WindowInfo[] {
    return callNative("windows.list", {}, () =>
      loadNative().listWindows().map(mapWindow)
    );
  },

  /** Return the current foreground window. */
  active(): WindowInfo {
    return callNative("windows.active", {}, () =>
      mapWindow(loadNative().getActiveWindow())
    );
  },

  /** Wait until a window title contains the requested text. */
  wait(options: WindowWaitOptions): WindowInfo {
    return callNative("windows.wait", { ...options }, () =>
      mapWindow(
        loadNative().waitForWindowByTitle(
          options.titleContains,
          options.timeoutMs,
          options.pollMs
        )
      )
    );
  },

  /** Bring a window to the foreground. */
  focus(id: string): boolean {
    return callNative("windows.focus", { windowId: id }, () =>
      loadNative().focusWindow(id)
    );
  },

  /** Return the window outer-frame screen region. */
  region(id: string) {
    return callNative("windows.region", { windowId: id }, () =>
      loadNative().getWindowRegion(id)
    );
  },

  /** Return the visible-clamped window outer-frame region. */
  regionClamped(id: string) {
    return callNative("windows.regionClamped", { windowId: id }, () =>
      loadNative().getWindowRegionClamped(id)
    );
  },

  /** Return the client-area origin in screen coordinates. */
  clientOrigin(id: string) {
    return callNative("windows.clientOrigin", { windowId: id }, () =>
      loadNative().getWindowClientOrigin(id)
    );
  },

  move(id: string, x: number, y: number): void {
    callNative("windows.move", { windowId: id, x, y }, () =>
      loadNative().moveWindow(id, x, y)
    );
  },

  resize(id: string, width: number, height: number): void {
    callNative("windows.resize", { windowId: id, width, height }, () =>
      loadNative().resizeWindow(id, width, height)
    );
  },

  minimize(id: string): void {
    callNative("windows.minimize", { windowId: id }, () =>
      loadNative().minimizeWindow(id)
    );
  },

  restore(id: string): void {
    callNative("windows.restore", { windowId: id }, () =>
      loadNative().restoreWindow(id)
    );
  },

  capture(id: string): CaptureImage {
    return callNative("windows.capture", { windowId: id }, () =>
      loadNative().captureWindow(id)
    );
  },

  findTemplate(
    id: string,
    needle: TemplateImage,
    options?: MatchOptions
  ): MatchResult {
    return findNeedleInWindow(id, needle, options);
  },

  findAllTemplates(
    id: string,
    needle: TemplateImage,
    options?: MatchOptions
  ): MatchResult[] {
    return findAllNeedleInWindow(id, needle, options);
  },

  tapTemplate(
    id: string,
    needle: TemplateImage,
    options?: MatchOptions
  ): MatchResult {
    const match = windows.findTemplate(id, needle, options);
    const { x, y } = match.center;
    callNative("windows.tapTemplate", { windowId: id, x, y }, () =>
      loadNative().tapAt(x, y)
    );
    return match;
  },
};
