import { centerOf, type Point, type Region } from "@spotterjs/base";

/**
 * Window frame region.
 *
 * Used to convert between screen coordinates and window-local coordinates.
 */
export type WindowFrame = Region;

/**
 * Coordinate bundle for a match.
 *
 * - `screen`: match box in screen coordinates.
 * - `local`: match box relative to the window frame's top-left corner.
 * - `localCenter`: center point in window-local coordinates.
 */
export type MatchBox = {
  screen: Region;
  local: Region;
  /** Match center in window-local coordinates. */
  localCenter: Point;
};

/**
 * Convert a window-local point to a screen point.
 *
 * @param frame Window frame in screen coordinates.
 * @param local Point relative to the window frame's top-left corner.
 */
export function toScreen(frame: WindowFrame, local: Point): Point {
  return {
    x: frame.left + local.x,
    y: frame.top + local.y,
  };
}

/**
 * Convert a screen point to a window-local point.
 *
 * @param frame Window frame in screen coordinates.
 * @param screen Point in screen coordinates.
 */
export function toLocal(frame: WindowFrame, screen: Point): Point {
  return {
    x: screen.x - frame.left,
    y: screen.y - frame.top,
  };
}

/**
 * Convert a screen-space match box to a {@link MatchBox}.
 *
 * Useful when you need to preserve both screen and window-local views of the
 * same match.
 */
export function toMatchBox(frame: WindowFrame, screen: Region): MatchBox {
  const local: Region = {
    left: screen.left - frame.left,
    top: screen.top - frame.top,
    width: screen.width,
    height: screen.height,
  };
  return {
    screen,
    local,
    localCenter: centerOf(local),
  };
}

/**
 * Return the click point for a match in screen coordinates.
 *
 * This uses `box.screen` directly and does not depend on a possibly stale
 * window frame.
 */
export function matchTapScreen(box: MatchBox): Point {
  return centerOf(box.screen);
}
