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

function loadImageFromBuffer(bytes: Buffer): CaptureImage {
  return loadNative().loadImageFromBuffer(bytes);
}

async function findInCapture(
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

async function findAllInCapture(
  haystack: CaptureImage,
  needle: TemplateImage,
  options?: MatchOptions
): Promise<MatchResult[]> {
  return loadNative()
    .findAllTemplateBuffers(haystack, loadNeedle(needle), toNativeOpts(options))
    .map(toMatchResult);
}

export const image = {
  /** Decode an encoded PNG/JPEG/WebP buffer into a raw RGBA capture. */
  decode(bytes: Buffer): CaptureImage {
    return loadImageFromBuffer(bytes);
  },

  /** Match a template against an already captured RGBA image. */
  find: findInCapture,

  /** Return all matches in an already captured RGBA image. */
  findAll: findAllInCapture,
};
