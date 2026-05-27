import {
  centerOf,
  type MatchOptions,
  type MatchResult,
  type Region,
} from "@spotterjs/base";

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

export type NativeMatchResult = {
  region: Region;
  score: number;
};

export function toMatchResult(native: NativeMatchResult): MatchResult {
  return {
    region: native.region,
    center: centerOf(native.region),
    score: native.score,
  };
}
