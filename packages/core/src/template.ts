import { type MatchOptions, type MatchResult, type TemplateImage } from "@spotterjs/base";
import { findAllNeedleInWindow, findNeedleInWindow } from "./match";
import { loadNative } from "./native";

/**
 * Find the best template match inside a window.
 *
 * Returned coordinates are screen coordinates, matching `screen.find`
 * behavior. Window-scoped matching is usually faster and less ambiguous than
 * full-screen matching.
 *
 * @param windowId {@link WindowInfo.id}
 * @param needle Template image path or encoded image Buffer.
 * @throws When no match reaches the configured confidence.
 */
export function findInWindow(
  windowId: string,
  needle: TemplateImage,
  options?: MatchOptions
): MatchResult {
  return findNeedleInWindow(windowId, needle, options);
}

/**
 * Find all template matches inside a window.
 *
 * @param windowId {@link WindowInfo.id}
 * @returns All matches in screen coordinates, or an empty array when none match.
 */
export function findAllInWindow(
  windowId: string,
  needle: TemplateImage,
  options?: MatchOptions
): MatchResult[] {
  return findAllNeedleInWindow(windowId, needle, options);
}

/**
 * Match a template inside a window and click its center.
 *
 * Equivalent to `findInWindow` followed by tapping the match center.
 * @returns The clicked match in screen coordinates.
 * @throws When no match reaches the configured confidence.
 */
export function tapInWindow(
  windowId: string,
  needle: TemplateImage,
  options?: MatchOptions
): MatchResult {
  const match = findInWindow(windowId, needle, options);
  const { x, y } = match.center;
  loadNative().tapAt(x, y);
  return match;
}
