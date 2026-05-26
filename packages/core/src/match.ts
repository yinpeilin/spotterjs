import {
  centerOf,
  type CaptureImage,
  type MatchOptions,
  type MatchWaitOptions,
  type MatchResult,
  type Region,
  type TemplateImage,
} from "@spotterjs/base";

import { wrapNativeError, type SpotterErrorContext } from "./errors";
import { loadNative } from "./native";

/** Convert public {@link MatchOptions} into the native option shape. */
export function toNativeOpts(opts?: MatchOptions) {
  if (!opts) return undefined;
  const scale = opts.scale;
  const scaleConfig = typeof scale === "object" ? scale : undefined;

  return {
    confidence: opts.confidence,
    searchRegion: opts.region,
    multiScale: scale === true || typeof scale === "object" ? true : undefined,
    scaleMin: scaleConfig?.min,
    scaleMax: scaleConfig?.max,
    scaleStep: scaleConfig?.step,
  };
}

type NativeMatchResult = {
  region: Region;
  score: number;
};

export function needleArgs(needle: TemplateImage): { path: string; buffer?: Buffer } {
  if (typeof needle === "string") {
    return { path: needle };
  }

  return { path: "", buffer: needle };
}

function matchContext(needle: TemplateImage, options?: MatchOptions): SpotterErrorContext {
  return {
    needle: typeof needle === "string" ? "path" : "buffer",
    confidence: options?.confidence,
    region: options?.region,
    scale: options?.scale,
  };
}

function callNative<T>(api: string, context: SpotterErrorContext, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    throw wrapNativeError(api, error, context);
  }
}

export function toMatchResult(native: NativeMatchResult): MatchResult {
  return {
    region: native.region,
    center: centerOf(native.region),
    score: native.score,
  };
}

export function loadNeedleCapture(needle: TemplateImage): CaptureImage {
  const native = loadNative();
  return typeof needle === "string"
    ? native.loadImageFromPath(needle)
    : native.loadImageFromBuffer(needle);
}

/**
 * Full-screen template matching with one capture and NCC scan.
 * @internal Used by `screen`; prefer `screen.find` in user code.
 */
export async function findNeedle(
  needle: TemplateImage,
  options?: MatchOptions
): Promise<MatchResult> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return callNative("findNeedle", matchContext(needle, options), () =>
    toMatchResult(native.findTemplate(path, buffer, toNativeOpts(options)))
  );
}

/**
 * Find all full-screen template matches.
 * @internal Used by `screen`; prefer `screen.findAll` in user code.
 */
export async function findAllNeedle(
  needle: TemplateImage,
  options?: MatchOptions
): Promise<MatchResult[]> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return callNative("findAllNeedle", matchContext(needle, options), () =>
    native.findAllTemplates(path, buffer, toNativeOpts(options)).map(toMatchResult)
  );
}

/**
 * Poll until a full-screen template appears.
 * @internal Used by `screen`; prefer `screen.waitFor` in user code.
 */
export async function waitForNeedle(
  needle: TemplateImage,
  options: MatchWaitOptions
): Promise<MatchResult> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  const { timeoutMs, intervalMs, ...matchOptions } = options;
  return callNative(
    "waitForNeedle",
    { ...matchContext(needle, matchOptions), timeoutMs, intervalMs },
    () =>
      toMatchResult(
        native.waitForTemplate(
          path,
          buffer,
          timeoutMs,
          toNativeOpts(matchOptions),
          intervalMs
        )
      )
  );
}

export function findNeedleInWindow(
  windowId: string,
  needle: TemplateImage,
  options?: MatchOptions
): MatchResult {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return callNative(
    "findNeedleInWindow",
    { ...matchContext(needle, options), windowId },
    () =>
      toMatchResult(
        native.findTemplateInWindow(windowId, path, buffer, toNativeOpts(options))
      )
  );
}

export function findAllNeedleInWindow(
  windowId: string,
  needle: TemplateImage,
  options?: MatchOptions
): MatchResult[] {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return callNative(
    "findAllNeedleInWindow",
    { ...matchContext(needle, options), windowId },
    () =>
      native
        .findAllTemplatesInWindow(windowId, path, buffer, toNativeOpts(options))
        .map(toMatchResult)
  );
}

export async function findNeedleInCapture(
  haystack: CaptureImage,
  needle: TemplateImage,
  options?: MatchOptions
): Promise<MatchResult> {
  return callNative("findNeedleInCapture", matchContext(needle, options), () =>
    toMatchResult(
      loadNative().findTemplateBuffers(
        haystack,
        loadNeedleCapture(needle),
        toNativeOpts(options)
      )
    )
  );
}

export async function findAllNeedleInCapture(
  haystack: CaptureImage,
  needle: TemplateImage,
  options?: MatchOptions
): Promise<MatchResult[]> {
  return callNative("findAllNeedleInCapture", matchContext(needle, options), () =>
    loadNative()
      .findAllTemplateBuffers(haystack, loadNeedleCapture(needle), toNativeOpts(options))
      .map(toMatchResult)
  );
}

/**
 * Capture the screen for the matching pipeline.
 * @param region Optional screen region. Omit to capture the full screen.
 */
export function captureForMatch(region?: Region): CaptureImage {
  const native = loadNative();
  return callNative("captureForMatch", { region }, () => native.captureScreen(region));
}
