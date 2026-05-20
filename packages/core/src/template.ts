import { centerOf, type MatchOptions, type Region } from "@spotter/base";
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

/** Template match within a window (returns screen coordinates). */
export function findInWindow(
  windowId: string,
  templatePath: string,
  options?: MatchOptions
): Region {
  return loadNative().findTemplateInWindow(
    windowId,
    templatePath,
    toNativeOpts(options)
  );
}

/** All template matches within a window (returns screen coordinates). */
export function findAllInWindow(
  windowId: string,
  templatePath: string,
  options?: MatchOptions
): Region[] {
  return loadNative().findAllTemplatesInWindow(
    windowId,
    templatePath,
    toNativeOpts(options)
  );
}

/** Find template in window and click its center. */
export function tapInWindow(
  windowId: string,
  templatePath: string,
  options?: MatchOptions
): Region {
  const region = findInWindow(windowId, templatePath, options);
  const { x, y } = centerOf(region);
  loadNative().tapAt(x, y);
  return region;
}
