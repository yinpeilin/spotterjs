import type { CaptureImage, MatchOptions, MatchProvider, Region } from "@spotter/base";
import { loadNative } from "./native";

function toNativeOpts(opts?: MatchOptions) {
  if (!opts) return undefined;
  return {
    confidence: opts.confidence,
    searchRegion: opts.searchRegion,
    multiScale: opts.multiScale,
    scaleMin: opts.scaleMin,
    scaleMax: opts.scaleMax,
    scaleStep: opts.scaleStep,
  };
}

export function createNccMatchProvider(): MatchProvider {
  const native = loadNative();
  return {
    async find(needle, options) {
      return native.findTemplate(
        typeof needle === "string" ? needle : "",
        toNativeOpts(options)
      );
    },
    async findAll(needle, options) {
      return native.findAllTemplates(
        typeof needle === "string" ? needle : "",
        toNativeOpts(options)
      );
    },
    async waitFor(needle, timeoutMs, options, intervalMs) {
      return native.waitForTemplate(
        typeof needle === "string" ? needle : "",
        timeoutMs,
        toNativeOpts(options),
        intervalMs
      );
    },
  };
}

export function captureForMatch(region?: Region): CaptureImage {
  const native = loadNative();
  return native.captureScreen(region);
}
