import { centerOf, type CaptureImage, type MatchOptions, type Region } from "@spotter/base";
import {
  captureForMatch,
  findAllNeedle,
  findNeedle,
  toNativeOpts,
  waitForNeedle,
} from "./match";
import { loadNative } from "./native";

/**
 * 屏幕截图与全屏模板匹配。
 *
 * - 坐标均为**屏幕坐标**
 * - `needle` 可为 PNG/JPEG/WebP 文件路径，或已编码图像的 `Buffer`
 * - 匹配算法为 NCC，详见 `docs/MATCHING.md`
 *
 * @example
 * ```ts
 * const region = await screen.find("./button.png", { confidence: 0.9 });
 * const { x, y } = centerOf(region);
 * mouse.tap(x, y);
 * ```
 */
export const screen = {
  /** 主显示器宽度（像素） */
  width(): number {
    return loadNative().getScreenWidth();
  },

  /** 主显示器高度（像素） */
  height(): number {
    return loadNative().getScreenHeight();
  },

  /** 主显示器尺寸 `{ width, height }` */
  size(): { width: number; height: number } {
    return loadNative().getScreenSize();
  },

  /**
   * 截取屏幕。
   * @param region 可选子区域；省略则全屏
   * @returns RGBA {@link CaptureImage}
   */
  capture(region?: Region): CaptureImage {
    return captureForMatch(region);
  },

  /**
   * 截取指定窗口内容（不含窗口装饰外的区域，由 native 层定义）。
   * @param windowId {@link WindowInfo.id}
   */
  captureWindow(windowId: string): CaptureImage {
    return loadNative().captureWindow(windowId);
  },

  /** 截取当前前台窗口 */
  captureActive(): CaptureImage {
    const active = loadNative().getActiveWindow();
    return loadNative().captureWindow(active.id);
  },

  /**
   * 同步查找模板并点击其中心（`tapAt`）。
   *
   * 与 `find` 不同：此方法**同步**调用 native，且不重新截屏轮询。
   * @returns 匹配到的屏幕区域
   * @throws 未找到模板时抛错
   */
  tapTemplate(needle: string | Buffer, options?: MatchOptions): Region {
    const native = loadNative();
    const path = typeof needle === "string" ? needle : "";
    const buffer = typeof needle === "string" ? undefined : needle;
    const region = native.findTemplate(path, buffer, toNativeOpts(options));
    const { x, y } = centerOf(region);
    native.tapAt(x, y);
    return region;
  },

  /**
   * 在全屏（或 `options.searchRegion`）中查找第一个模板匹配。
   *
   * 内部每次调用会重新截屏再匹配。
   * @throws 未找到时抛错
   */
  find(needle: string | Buffer, options?: MatchOptions): Promise<Region> {
    return findNeedle(needle, options);
  },

  /**
   * 查找所有匹配项，返回屏幕坐标下的 {@link Region} 数组。
   *
   * 结果顺序与 native 层去重策略一致。
   */
  findAll(needle: string | Buffer, options?: MatchOptions): Promise<Region[]> {
    return findAllNeedle(needle, options);
  },

  /**
   * 轮询等待模板出现。
   *
   * @param timeoutMs 超时毫秒；超时抛错
   * @param intervalMs 两次尝试间隔；省略则用 native 默认值
   */
  waitFor(
    needle: string | Buffer,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs?: number
  ): Promise<Region> {
    return waitForNeedle(needle, timeoutMs, options, intervalMs);
  },
};
