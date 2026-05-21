import { centerOf, type CaptureImage, type MatchOptions, type Region } from "@spotter/base";
import {
  captureForMatch,
  findAllNeedle,
  findNeedle,
  toNativeOpts,
  waitForNeedle,
} from "./match";
import { loadNative } from "./native";

export const screen = {
  width(): number {
    return loadNative().getScreenWidth();
  },
  height(): number {
    return loadNative().getScreenHeight();
  },
  size(): { width: number; height: number } {
    return loadNative().getScreenSize();
  },
  capture(region?: Region): CaptureImage {
    return captureForMatch(region);
  },
  captureWindow(windowId: string): CaptureImage {
    return loadNative().captureWindow(windowId);
  },
  captureActive(): CaptureImage {
    const active = loadNative().getActiveWindow();
    return loadNative().captureWindow(active.id);
  },
  tapTemplate(needle: string | Buffer, options?: MatchOptions): Region {
    const native = loadNative();
    const path = typeof needle === "string" ? needle : "";
    const buffer = typeof needle === "string" ? undefined : needle;
    const region = native.findTemplate(path, buffer, toNativeOpts(options));
    const { x, y } = centerOf(region);
    native.tapAt(x, y);
    return region;
  },
  find(needle: string | Buffer, options?: MatchOptions): Promise<Region> {
    return findNeedle(needle, options);
  },
  findAll(needle: string | Buffer, options?: MatchOptions): Promise<Region[]> {
    return findAllNeedle(needle, options);
  },
  waitFor(
    needle: string | Buffer,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs?: number
  ): Promise<Region> {
    return waitForNeedle(needle, timeoutMs, options, intervalMs);
  },
};
