import type { CaptureImage, MatchOptions, Region } from "@spotter/base";

import { loadNative } from "./native";

/** 将公共 {@link MatchOptions} 转为 native 层结构 */
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

/**
 * 全屏模板匹配（单次截屏 + NCC）。
 * @internal 供 `screen` 模块使用；一般请用 `screen.find`。
 */
export async function findNeedle(
  needle: string | Buffer,
  options?: MatchOptions
): Promise<Region> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return native.findTemplate(path, buffer, toNativeOpts(options));
}

/**
 * 全屏查找所有模板匹配。
 * @internal 供 `screen` 模块使用；一般请用 `screen.findAll`。
 */
export async function findAllNeedle(
  needle: string | Buffer,
  options?: MatchOptions
): Promise<Region[]> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return native.findAllTemplates(path, buffer, toNativeOpts(options));
}

/**
 * 轮询等待全屏模板出现。
 * @internal 供 `screen` 模块使用；一般请用 `screen.waitFor`。
 */
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

/**
 * 截取屏幕（供匹配 pipeline 使用）。
 * @param region 可选子区域；省略则全屏
 */
export function captureForMatch(region?: Region): CaptureImage {
  const native = loadNative();
  return native.captureScreen(region);
}
