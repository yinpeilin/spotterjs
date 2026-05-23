import {
  type CaptureImage,
  type MatchOptions,
  type MatchResult,
  type TemplateImage,
} from "@spotterjs/base";

import { loadNative } from "./native";
import { toMatchResult, toNativeOpts } from "./match";

function loadNeedle(needle: TemplateImage): CaptureImage {
  const native = loadNative();
  return typeof needle === "string"
    ? native.loadImageFromPath(needle)
    : native.loadImageFromBuffer(needle);
}

export function loadImageFromBuffer(bytes: Buffer): CaptureImage {
  return loadNative().loadImageFromBuffer(bytes);
}

export async function findInCapture(
  haystack: CaptureImage,
  needle: TemplateImage,
  options?: MatchOptions
): Promise<MatchResult> {
  return toMatchResult(
    loadNative().findTemplateBuffers(
      haystack,
      loadNeedle(needle),
      toNativeOpts(options)
    )
  );
}

export async function findAllInCapture(
  haystack: CaptureImage,
  needle: TemplateImage,
  options?: MatchOptions
): Promise<MatchResult[]> {
  return loadNative()
    .findAllTemplateBuffers(haystack, loadNeedle(needle), toNativeOpts(options))
    .map(toMatchResult);
}

export async function waitForInCapture(
  haystack: CaptureImage,
  needle: TemplateImage,
  timeoutMs: number,
  options?: MatchOptions,
  intervalMs?: number
): Promise<MatchResult> {
  return toMatchResult(
    loadNative().waitForTemplateBuffers(
      haystack,
      loadNeedle(needle),
      timeoutMs,
      toNativeOpts(options),
      intervalMs
    )
  );
}
