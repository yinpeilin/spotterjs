import { centerOf, type MatchOptions, type Region } from "@spotterjs/base";

import { toNativeOpts } from "./match";

import { loadNative } from "./native";

function needleArgs(needle: string | Buffer): { path: string; buffer?: Buffer } {
  if (typeof needle === "string") {
    return { path: needle };
  }

  return { path: "", buffer: needle };
}

/**
 * 在指定窗口客户区内做模板匹配。
 *
 * - 返回的 {@link Region} 为**屏幕坐标**（与 `screen.find` 一致）
 * - 内部会先截取该窗口再匹配，比全屏搜索更快、更稳
 *
 * @param windowId {@link WindowInfo.id}
 * @param needle 模板路径或图像 Buffer
 * @throws 未找到时抛错
 */
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

/**
 * 在窗口内查找所有模板匹配（屏幕坐标）。
 *
 * @param windowId {@link WindowInfo.id}
 * @returns 所有匹配区域；无匹配时返回空数组
 */
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

/**
 * 在窗口内匹配模板并点击其中心。
 *
 * 等价于 `findInWindow` + `mouse.tap(centerOf(region))`。
 * @returns 匹配到的屏幕区域
 * @throws 未找到时抛错
 */
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
