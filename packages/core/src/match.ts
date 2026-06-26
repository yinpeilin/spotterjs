import {
  type CaptureImage,
  type MatchOptions,
  type MatchWaitOptions,
  type MatchResult,
  type Region,
  type TemplateImage,
} from "@spotterjs/base";

import { callNative, type SpotterErrorContext } from "./errors";
import { loadNative } from "./native";
import { toMatchResult, toNativeOpts } from "./match-shared";

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
    backend: options?.backend,
  };
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
    toMatchResult(native.findTemplate(path, buffer, toNativeOpts(options)), options?.backend)
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
    native
      .findAllTemplates(path, buffer, toNativeOpts(options))
      .map((match) => toMatchResult(match, options?.backend))
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
        ),
        matchOptions.backend
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
        native.findTemplateInWindow(windowId, path, buffer, toNativeOpts(options)),
        options?.backend
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
        .map((match) => toMatchResult(match, options?.backend))
  );
}

function sleepSync(ms: number): void {
  if (!Number.isFinite(ms) || ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Poll {@link findNeedleInWindow} until a match appears or the timeout expires.
 *
 * The native layer has no window-scoped wait, so this polls synchronously to
 * match the rest of the synchronous `windows` API.
 */
export function waitForNeedleInWindow(
  windowId: string,
  needle: TemplateImage,
  options: MatchWaitOptions
): MatchResult {
  const { timeoutMs, intervalMs, ...matchOptions } = options;
  const deadline = Date.now() + timeoutMs;
  const poll = intervalMs ?? 200;
  let lastError: unknown;
  for (;;) {
    try {
      return findNeedleInWindow(windowId, needle, matchOptions);
    } catch (error) {
      lastError = error;
      if (Date.now() >= deadline) break;
      sleepSync(Math.min(poll, Math.max(0, deadline - Date.now())));
    }
  }
  throw lastError;
}

/**
 * Capture the screen for the matching pipeline.
 * @param region Optional screen region. Omit to capture the full screen.
 */
export function captureForMatch(region?: Region): CaptureImage {
  const native = loadNative();
  return callNative("captureForMatch", { region }, () => native.captureScreen(region));
}
