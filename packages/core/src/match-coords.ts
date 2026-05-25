import { centerOf, type Point, type Region } from "@spotterjs/base";

/**
 * 窗口外框（与 `windows.region` / `windows.capture` 一致）。
 *
 * 用于屏幕坐标与窗口局部坐标互转。
 */
export type WindowFrame = Region;

/**
 * 一次匹配结果的坐标封装。
 *
 * - `screen`：屏幕坐标下的匹配框
 * - `local`：相对窗口左上角的匹配框
 * - `localCenter`：窗口局部坐标下的中心点
 */
export type MatchBox = {
  screen: Region;
  local: Region;
  /** 窗口局部坐标系下的匹配区域中心 */
  localCenter: Point;
};

/**
 * 窗口局部坐标 → 屏幕坐标。
 *
 * @param frame 窗口外框（`getRegion`）
 * @param local 相对窗口左上角的点
 */
export function toScreen(frame: WindowFrame, local: Point): Point {
  return {
    x: frame.left + local.x,
    y: frame.top + local.y,
  };
}

/**
 * 屏幕坐标 → 窗口局部坐标。
 *
 * @param frame 窗口外框
 * @param screen 屏幕坐标点
 */
export function toLocal(frame: WindowFrame, screen: Point): Point {
  return {
    x: screen.x - frame.left,
    y: screen.y - frame.top,
  };
}

/**
 * 将屏幕坐标下的匹配框转换为 {@link MatchBox}。
 *
 * 适用于窗口移动后仍想用「局部坐标」描述匹配结果的场景。
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
 * 计算点击点：匹配框在**屏幕坐标**下的中心。
 *
 * 直接使用 `box.screen`，不依赖可能过期的 `frame`，适合窗口已移动后的点击。
 */
export function matchTapScreen(box: MatchBox): Point {
  return centerOf(box.screen);
}
