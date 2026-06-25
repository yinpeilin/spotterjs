import {
  type CaptureImage,
  type MatchOptions,
  type MatchResult,
  type MatchWaitOptions,
  type TemplateImage,
  type WindowInfo,
} from "@spotterjs/base";
import { callNative } from "./errors";
import { loadNative, type NativeWindow } from "./native";
import {
  findAllNeedleInWindow,
  findNeedleInWindow,
  waitForNeedleInWindow,
} from "./match";

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
  getActive(): WindowInfo {
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
  getRegion(id: string) {
    return callNative("windows.region", { windowId: id }, () =>
      loadNative().getWindowRegion(id)
    );
  },

  /** Return the visible-clamped window outer-frame region. */
  getRegionClamped(id: string) {
    return callNative("windows.regionClamped", { windowId: id }, () =>
      loadNative().getWindowRegionClamped(id)
    );
  },

  /** Return the client-area origin in screen coordinates. */
  getClientOrigin(id: string) {
    return callNative("windows.clientOrigin", { windowId: id }, () =>
      loadNative().getWindowClientOrigin(id)
    );
  },

  /** Move the window's top-left outer corner to `(x, y)` in screen coordinates. */
  move(id: string, x: number, y: number): void {
    callNative("windows.move", { windowId: id, x, y }, () =>
      loadNative().moveWindow(id, x, y)
    );
  },

  /** Resize the window's outer frame to `width` x `height` pixels. */
  resize(id: string, width: number, height: number): void {
    callNative("windows.resize", { windowId: id, width, height }, () =>
      loadNative().resizeWindow(id, width, height)
    );
  },

  /** Minimize the window. */
  minimize(id: string): void {
    callNative("windows.minimize", { windowId: id }, () =>
      loadNative().minimizeWindow(id)
    );
  },

  /** Restore the window from a minimized or maximized state. */
  restore(id: string): void {
    callNative("windows.restore", { windowId: id }, () =>
      loadNative().restoreWindow(id)
    );
  },

  /**
   * Capture the window contents as a raw RGBA {@link CaptureImage}.
   *
   * The native layer defines whether window decoration is included.
   */
  capture(id: string): CaptureImage {
    return callNative("windows.capture", { windowId: id }, () =>
      loadNative().captureWindow(id)
    );
  },

  /**
   * Find the best template match inside a window.
   *
   * Returned coordinates are screen coordinates. Window-scoped matching is
   * usually faster and less ambiguous than full-screen matching.
   * @throws When no match reaches the configured confidence.
   */
  findTemplate(
    id: string,
    needle: TemplateImage,
    options?: MatchOptions
  ): MatchResult {
    return findNeedleInWindow(id, needle, options);
  },

  /**
   * Find all template matches inside a window.
   *
   * Returned coordinates are screen coordinates, or an empty array when none
   * match.
   */
  findAllTemplates(
    id: string,
    needle: TemplateImage,
    options?: MatchOptions
  ): MatchResult[] {
    return findAllNeedleInWindow(id, needle, options);
  },

  /**
   * Poll until a template appears inside a window.
   *
   * Returned coordinates are screen coordinates. Polling runs on the calling
   * thread because the native layer has no window-scoped wait.
   * @throws When no match appears before the timeout.
   */
  waitForTemplate(
    id: string,
    needle: TemplateImage,
    options: MatchWaitOptions
  ): MatchResult {
    return waitForNeedleInWindow(id, needle, options);
  },

  /**
   * Find a template inside a window and click its center.
   *
   * Equivalent to {@link windows.findTemplate} followed by a tap at the match
   * center.
   * @returns The clicked match in screen coordinates.
   * @throws When no match reaches the configured confidence.
   */
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
