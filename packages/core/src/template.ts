import { centerOf, type MatchOptions, type Region } from "@spotter/base";
import { toNativeOpts } from "./match";
import { loadNative } from "./native";

function needleArgs(needle: string | Buffer): { path: string; buffer?: Buffer } {
  if (typeof needle === "string") {
    return { path: needle };
  }
  return { path: "", buffer: needle };
}

/** Template match within a window (returns screen coordinates). */
export function findInWindow(
  windowId: string,
  needle: string | Buffer,
  options?: MatchOptions
): Region {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return native.findTemplateInWindow(
    windowId,
    path,
    buffer,
    toNativeOpts(options)
  );
}

/** All template matches within a window (returns screen coordinates). */
export function findAllInWindow(
  windowId: string,
  needle: string | Buffer,
  options?: MatchOptions
): Region[] {
  const native = loadNative();
  const { path, buffer } = needleArgs(needle);
  return native.findAllTemplatesInWindow(
    windowId,
    path,
    buffer,
    toNativeOpts(options)
  );
}

/** Find template in window and click its center. */
export function tapInWindow(
  windowId: string,
  needle: string | Buffer,
  options?: MatchOptions
): Region {
  const region = findInWindow(windowId, needle, options);
  const { x, y } = centerOf(region);
  loadNative().tapAt(x, y);
  return region;
}
