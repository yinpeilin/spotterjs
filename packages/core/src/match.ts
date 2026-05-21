import type { CaptureImage, MatchOptions, Region } from "@spotter/base";
import { loadNative } from "./native";

export function toNativeOpts(opts?: MatchOptions) {
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

function needleArgs(needle: string | Buffer): { path: string; buffer?: Buffer } {
  if (typeof needle === "string") {
    return { path: needle };
  }
  return { path: "", buffer: needle };
}

export async function findNeedle(
  needle: string | Buffer,
  options?: MatchOptions
): Promise<Region> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return native.findTemplate(path, buffer, toNativeOpts(options));
}

export async function findAllNeedle(
  needle: string | Buffer,
  options?: MatchOptions
): Promise<Region[]> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return native.findAllTemplates(path, buffer, toNativeOpts(options));
}

export async function waitForNeedle(
  needle: string | Buffer,
  timeoutMs: number,
  options?: MatchOptions,
  intervalMs?: number
): Promise<Region> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return native.waitForTemplate(
    path,
    buffer,
    timeoutMs,
    toNativeOpts(options),
    intervalMs
  );
}

export function captureForMatch(region?: Region): CaptureImage {
  const native = loadNative();
  return native.captureScreen(region);
}
