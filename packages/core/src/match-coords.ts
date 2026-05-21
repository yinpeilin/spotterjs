import { centerOf, type Point, type Region } from "@spotter/base";

/** Window outer frame (matches `captureWindow` / `getWindowRegion`). */
export type WindowFrame = Region;

/** Match result with both screen and window-local regions. */
export type MatchBox = {
  screen: Region;
  local: Region;
  /** Window-local center of the matched region. */
  localCenter: Point;
};

export function toScreen(frame: WindowFrame, local: Point): Point {
  return {
    x: frame.left + local.x,
    y: frame.top + local.y,
  };
}

export function toLocal(frame: WindowFrame, screen: Point): Point {
  return {
    x: screen.x - frame.left,
    y: screen.y - frame.top,
  };
}

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

/** Screen tap point: center of the matched region (independent of stale frame). */
export function matchTapScreen(box: MatchBox): Point {
  return centerOf(box.screen);
}
