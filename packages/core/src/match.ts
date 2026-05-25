import {
  centerOf,
  type CaptureImage,
  type MatchOptions,
  type MatchWaitOptions,
  type MatchResult,
  type Region,
  type TemplateImage,
} from "@spotterjs/base";

import { loadNative } from "./native";

/** 将公共 {@link MatchOptions} 转为 native 层结构 */
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

function needleArgs(needle: TemplateImage): { path: string; buffer?: Buffer } {
  if (typeof needle === "string") {
    return { path: needle };
  }

  return { path: "", buffer: needle };
}

export function toMatchResult(native: NativeMatchResult): MatchResult {
  return {
    region: native.region,
    center: centerOf(native.region),
    score: native.score,
  };
}

/**
 * 全屏模板匹配（单次截屏 + NCC）。
 * @internal 供 `screen` 模块使用；一般请用 `screen.find`。
 */
export async function findNeedle(
  needle: TemplateImage,
  options?: MatchOptions
): Promise<MatchResult> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return toMatchResult(native.findTemplate(path, buffer, toNativeOpts(options)));
}

/**
 * 全屏查找所有模板匹配。
 * @internal 供 `screen` 模块使用；一般请用 `screen.findAll`。
 */
export async function findAllNeedle(
  needle: TemplateImage,
  options?: MatchOptions
): Promise<MatchResult[]> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return native
    .findAllTemplates(path, buffer, toNativeOpts(options))
    .map(toMatchResult);
}

/**
 * 轮询等待全屏模板出现。
 * @internal 供 `screen` 模块使用；一般请用 `screen.waitFor`。
 */
export async function waitForNeedle(
  needle: TemplateImage,
  options: MatchWaitOptions
): Promise<MatchResult> {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  const { timeoutMs, intervalMs, ...matchOptions } = options;
  return toMatchResult(
    native.waitForTemplate(
      path,
      buffer,
      timeoutMs,
      toNativeOpts(matchOptions),
      intervalMs
    )
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
