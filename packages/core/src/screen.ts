import {
  type CaptureImage,
  type MatchOptions,
  type MatchWaitOptions,
  type MatchResult,
  type Region,
  type Rgb,
  type TemplateImage,
} from "@spotterjs/base";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  captureForMatch,
  findAllNeedle,
  findNeedle,
  waitForNeedle,
} from "./match";
import { callNative, SpotterError } from "./errors";
import { image } from "./image";
import { loadNative } from "./native";

export type ColorInput = Rgb | `#${string}`;

export type FindColorOptions = {
  tolerance?: number;
  region?: Region;
};

export type WaitForColorOptions = FindColorOptions & {
  timeoutMs: number;
  intervalMs?: number;
};

export type DiffOptions = {
  perPixelThreshold?: number;
};

export type DiffStats = {
  meanAbsDiff: number;
  changedFraction: number;
};

export type WaitForStableOptions = {
  region?: Region;
  threshold?: number;
  settleMs?: number;
  timeoutMs?: number;
  intervalMs?: number;
};

export type HighlightOptions = {
  color?: ColorInput;
  capture?: CaptureImage;
  prefix?: string;
};

/**
 * Screen capture and full-screen template matching helpers.
 *
 * - Coordinates are screen coordinates.
 * - `needle` can be a PNG/JPEG/WebP path or an encoded image `Buffer`.
 * - Matching uses NCC by default; see the template matching guide for backend details.
 *
 * @example
 * ```ts
 * const match = await screen.findTemplate("./button.png", { confidence: 0.9 });
 * mouse.tap(match.center.x, match.center.y);
 * ```
 */
export const screen = {
  /** Return the primary screen width in pixels. */
  getWidth(): number {
    return callNative("screen.width", {}, () => loadNative().getScreenWidth());
  },

  /** Return the primary screen height in pixels. */
  getHeight(): number {
    return callNative("screen.height", {}, () => loadNative().getScreenHeight());
  },

  /** Return the primary screen size. */
  getSize(): { width: number; height: number } {
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
  async tapTemplate(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult> {
    const native = loadNative();
    const match = await findNeedle(needle, options);
    const { x, y } = match.center;
    callNative("screen.tapTemplate", { x, y }, () => native.tapAt(x, y));
    return match;
  },

  /**
   * Find the best template match on the screen or inside `options.region`.
   *
   * Each call captures the screen before matching. Returned coordinates are
   * screen coordinates even when `options.region` is set.
   * @throws When no match reaches the configured confidence.
   */
  findTemplate(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult> {
    return findNeedle(needle, options);
  },

  /**
   * Find all template matches on the screen.
   *
   * Returned coordinates are screen coordinates. Ordering follows native
   * de-duplication and sorting.
   */
  findAllTemplates(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult[]> {
    return findAllNeedle(needle, options);
  },

  /**
   * Poll until a template appears.
   *
   * @param timeoutMs Timeout in milliseconds. The call throws on timeout.
   * @param intervalMs Delay between attempts. Native defaults are used when omitted.
   */
  waitForTemplate(
    needle: TemplateImage,
    options: MatchWaitOptions
  ): Promise<MatchResult> {
    return waitForNeedle(needle, options);
  },

  color: {
    /** Read the RGB color at a screen coordinate. */
    get(x: number, y: number): Rgb {
      return callNative("screen.color.get", { x, y }, () =>
        loadNative().getPixelColor(x, y)
      );
    },

    /** Find the first pixel matching a color. */
    find(color: ColorInput, options: FindColorOptions = {}) {
      const rgb = parseColor(color);
      const tolerance = normalizeTolerance(options.tolerance);
      return callNative("screen.color.find", { rgb, ...options }, () =>
        loadNative().findColor(rgb, tolerance, options.region)
      );
    },

    /** Find all pixels matching a color. */
    findAll(color: ColorInput, options: FindColorOptions = {}) {
      const rgb = parseColor(color);
      const tolerance = normalizeTolerance(options.tolerance);
      return callNative("screen.color.findAll", { rgb, ...options }, () =>
        loadNative().findAllColor(rgb, tolerance, options.region)
      );
    },

    /** Poll until the pixel at `(x, y)` matches a color. */
    wait(x: number, y: number, color: ColorInput, options: WaitForColorOptions): boolean {
      const rgb = parseColor(color);
      const tolerance = normalizeTolerance(options.tolerance);
      return callNative("screen.color.wait", { x, y, rgb, ...options }, () =>
        loadNative().waitForColor(
          x,
          y,
          rgb,
          tolerance,
          options.timeoutMs,
          options.intervalMs
        )
      );
    },
  },

  /** Compare two same-sized RGBA captures. */
  diff(previous: CaptureImage, current: CaptureImage, options: DiffOptions = {}): DiffStats {
    const threshold = normalizeTolerance(options.perPixelThreshold);
    const stats = callNative("screen.diff", { threshold }, () =>
      loadNative().regionDiff(previous, current, threshold)
    );
    return {
      meanAbsDiff: stats.meanAbsDiff,
      changedFraction: stats.changedFraction,
    };
  },

  /** Wait until a screen region has remained visually stable. */
  waitForStable(options: WaitForStableOptions = {}): boolean {
    const threshold = options.threshold ?? 0;
    const settleMs = options.settleMs ?? 250;
    const timeoutMs = options.timeoutMs ?? 5_000;
    const intervalMs = options.intervalMs ?? 100;
    return callNative("screen.waitForStable", { ...options }, () =>
      loadNative().waitForScreenStable(
        options.region,
        threshold,
        settleMs,
        timeoutMs,
        intervalMs
      )
    );
  },

  /** Capture the screen and write a PNG artifact with a software region outline. */
  highlight(region: Region, options: HighlightOptions = {}): string {
    const capture = options.capture ?? screen.capture();
    const annotated = annotateRegion(capture, region, parseColor(options.color ?? "#00cc66"));
    const artifact = artifactPath(options.prefix ?? "screen-highlight", "png");
    writeArtifactFile(artifact, image.encode(annotated));
    return artifact;
  },
};

function parseColor(color: ColorInput): Rgb {
  if (typeof color !== "string") {
    return {
      r: normalizeChannel(color.r),
      g: normalizeChannel(color.g),
      b: normalizeChannel(color.b),
    };
  }

  const match = /^#?([0-9a-fA-F]{6})$/.exec(color);
  if (!match) {
    throw new SpotterError(
      "SPOTTER_CORE_INVALID_COLOR",
      `invalid RGB hex color: ${color}`,
      { context: { color }, domain: "core" }
    );
  }
  const hex = match[1]!;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function normalizeChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeTolerance(value: number | undefined): number {
  return normalizeChannel(value ?? 0);
}

function annotateRegion(capture: CaptureImage, region: Region, color: Rgb): CaptureImage {
  const output: CaptureImage = {
    width: capture.width,
    height: capture.height,
    data: Buffer.from(capture.data),
  };
  const rgba = [color.r, color.g, color.b, 255] as const;
  const left = Math.round(region.left);
  const top = Math.round(region.top);
  const right = Math.round(region.left + region.width - 1);
  const bottom = Math.round(region.top + region.height - 1);
  drawLine(output, left, top, right, top, rgba);
  drawLine(output, right, top, right, bottom, rgba);
  drawLine(output, right, bottom, left, bottom, rgba);
  drawLine(output, left, bottom, left, top, rgba);
  return output;
}

function drawLine(
  capture: CaptureImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: readonly [number, number, number, number]
) {
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - cx);
  const sx = cx < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - cy);
  const sy = cy < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    setPixel(capture, cx, cy, color);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      cx += sx;
    }
    if (e2 <= dx) {
      err += dx;
      cy += sy;
    }
  }
}

function setPixel(
  capture: CaptureImage,
  x: number,
  y: number,
  color: readonly [number, number, number, number]
) {
  if (x < 0 || y < 0 || x >= capture.width || y >= capture.height) return;
  const offset = (y * capture.width + x) * 4;
  capture.data[offset] = color[0];
  capture.data[offset + 1] = color[1];
  capture.data[offset + 2] = color[2];
  capture.data[offset + 3] = color[3];
}

function artifactPath(prefix: string, ext: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "-");
  const nonce = Math.random().toString(36).slice(2, 8);
  return `.spotter/artifacts/${safePrefix}-${stamp}-${nonce}.${ext}`;
}

function writeArtifactFile(relativePath: string, content: Buffer): void {
  const root = path.resolve(process.env.SPOTTERJS_WORKSPACE_ROOT?.trim() || process.cwd());
  const resolved = path.resolve(root, relativePath);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new SpotterError(
      "SPOTTER_CORE_ARTIFACT_PATH_ESCAPE",
      `artifact path escapes workspace: ${relativePath}`,
      { context: { path: relativePath }, domain: "core" }
    );
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content);
}
