import {
  type CaptureImage,
  type MatchOptions,
  type MatchWaitOptions,
  type MatchResult,
  type Region,
  type TemplateImage,
} from "@spotterjs/base";
import {
  captureForMatch,
  findAllNeedle,
  findNeedle,
  waitForNeedle,
} from "./match";
import { callNative } from "./errors";
import { loadNative } from "./native";

/**
 * Screen capture and full-screen template matching helpers.
 *
 * - Coordinates are screen coordinates.
 * - `needle` can be a PNG/JPEG/WebP path or an encoded image `Buffer`.
 * - Matching uses NCC; see the template matching guide for details.
 *
 * @example
 * ```ts
 * const match = await screen.find("./button.png", { confidence: 0.9 });
 * mouse.tap(match.center.x, match.center.y);
 * ```
 */
export const screen = {
  /** Return the primary screen width in pixels. */
  width(): number {
    return callNative("screen.width", {}, () => loadNative().getScreenWidth());
  },

  /** Return the primary screen height in pixels. */
  height(): number {
    return callNative("screen.height", {}, () => loadNative().getScreenHeight());
  },

  /** Return the primary screen size. */
  size(): { width: number; height: number } {
    return callNative("screen.size", {}, () => loadNative().getScreenSize());
  },

  /**
   * Capture the full screen or a screen sub-region.
   * @param region Optional screen region. Omit to capture the full screen.
   * @returns Raw RGBA {@link CaptureImage}.
   */
  capture(region?: Region): CaptureImage {
    return captureForMatch(region);
  },

  /**
   * Capture a window by ID.
   *
   * The native layer defines whether window decoration is included.
   * @param windowId {@link WindowInfo.id}
   */
  captureWindow(windowId: string): CaptureImage {
    return callNative("screen.captureWindow", { windowId }, () =>
      loadNative().captureWindow(windowId)
    );
  },

  /** Capture the current foreground window. */
  captureActive(): CaptureImage {
    return callNative("screen.captureActive", {}, () => {
      const native = loadNative();
      const active = native.getActiveWindow();
      return native.captureWindow(active.id);
    });
  },

  /**
   * Find a template and click its center.
   *
   * The returned match uses screen coordinates.
   * @returns The clicked match.
   * @throws When no template match reaches the configured confidence.
   */
  async tap(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult> {
    const native = loadNative();
    const match = await findNeedle(needle, options);
    const { x, y } = match.center;
    callNative("screen.tap", { x, y }, () => native.tapAt(x, y));
    return match;
  },

  /**
   * Find the best template match on the screen or inside `options.region`.
   *
   * Each call captures the screen before matching. Returned coordinates are
   * screen coordinates even when `options.region` is set.
   * @throws When no match reaches the configured confidence.
   */
  find(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult> {
    return findNeedle(needle, options);
  },

  /**
   * Find all template matches on the screen.
   *
   * Returned coordinates are screen coordinates. Ordering follows native
   * de-duplication and sorting.
   */
  findAll(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult[]> {
    return findAllNeedle(needle, options);
  },

  /**
   * Poll until a template appears.
   *
   * @param timeoutMs Timeout in milliseconds. The call throws on timeout.
   * @param intervalMs Delay between attempts. Native defaults are used when omitted.
   */
  waitFor(
    needle: TemplateImage,
    options: MatchWaitOptions
  ): Promise<MatchResult> {
    return waitForNeedle(needle, options);
  },
};
