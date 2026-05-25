import {
  type CaptureImage,
  type MatchOptions,
  type MatchResult,
  type TemplateImage,
  type WindowInfo,
} from "@spotterjs/base";
import { loadNative, type NativeWindow } from "./native";
import { toMatchResult, toNativeOpts } from "./match";

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

function needleArgs(needle: TemplateImage): { path: string; buffer?: Buffer } {
  if (typeof needle === "string") {
    return { path: needle };
  }

  return { path: "", buffer: needle };
}

export type WindowWaitOptions = {
  titleContains: string;
  timeoutMs: number;
  pollMs?: number;
};

export const windows = {
  /** List all top-level windows. */
  list(): WindowInfo[] {
    return loadNative().listWindows().map(mapWindow);
  },

  /** Return the current foreground window. */
  active(): WindowInfo {
    return mapWindow(loadNative().getActiveWindow());
  },

  /** Wait until a window title contains the requested text. */
  wait(options: WindowWaitOptions): WindowInfo {
    return mapWindow(
      loadNative().waitForWindowByTitle(
        options.titleContains,
        options.timeoutMs,
        options.pollMs
      )
    );
  },

  /** Bring a window to the foreground. */
  focus(id: string): boolean {
    return loadNative().focusWindow(id);
  },

  /** Return the window outer-frame screen region. */
  region(id: string) {
    return loadNative().getWindowRegion(id);
  },

  /** Return the visible-clamped window outer-frame region. */
  regionClamped(id: string) {
    return loadNative().getWindowRegionClamped(id);
  },

  /** Return the client-area origin in screen coordinates. */
  clientOrigin(id: string) {
    return loadNative().getWindowClientOrigin(id);
  },

  move(id: string, x: number, y: number): void {
    loadNative().moveWindow(id, x, y);
  },

  resize(id: string, width: number, height: number): void {
    loadNative().resizeWindow(id, width, height);
  },

  minimize(id: string): void {
    loadNative().minimizeWindow(id);
  },

  restore(id: string): void {
    loadNative().restoreWindow(id);
  },

  capture(id: string): CaptureImage {
    return loadNative().captureWindow(id);
  },

  findTemplate(
    id: string,
    needle: TemplateImage,
    options?: MatchOptions
  ): MatchResult {
    const { path, buffer } = needleArgs(needle);
    return toMatchResult(
      loadNative().findTemplateInWindow(id, path, buffer, toNativeOpts(options))
    );
  },

  findAllTemplates(
    id: string,
    needle: TemplateImage,
    options?: MatchOptions
  ): MatchResult[] {
    const { path, buffer } = needleArgs(needle);
    return loadNative()
      .findAllTemplatesInWindow(id, path, buffer, toNativeOpts(options))
      .map(toMatchResult);
  },

  tapTemplate(
    id: string,
    needle: TemplateImage,
    options?: MatchOptions
  ): MatchResult {
    const match = windows.findTemplate(id, needle, options);
    const { x, y } = match.center;
    loadNative().tapAt(x, y);
    return match;
  },
};
