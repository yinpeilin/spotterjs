/**
 * 屏幕或窗口上的矩形区域，坐标系为**屏幕坐标**（左上角为原点，单位：像素）。
 *
 * 模板匹配、截图、窗口边界等 API 均使用此结构。
 */
export interface Region {
  /** 矩形左边缘的 X 坐标（屏幕坐标） */
  left: number;
  /** 矩形上边缘的 Y 坐标（屏幕坐标） */
  top: number;
  /** 矩形宽度（像素，必须 > 0） */
  width: number;
  /** 矩形高度（像素，必须 > 0） */
  height: number;
}

/**
 * 屏幕坐标系中的点（像素）。
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 模板图片输入。
 *
 * - `string` 始终表示图片文件路径
 * - `Buffer` 始终表示已编码的图片字节（PNG/JPEG/WebP），不表示 raw RGBA
 */
export type TemplateImage = string | Buffer;

/**
 * 一次模板匹配结果。
 *
 * 高层 API 返回的 `region` 与 `center` 均为屏幕绝对坐标；它们不相对
 * `region`，也不相对窗口。
 */
export interface MatchResult {
  /** 匹配框（屏幕坐标） */
  region: Region;
  /** 匹配框中心点（屏幕坐标） */
  center: Point;
  /** NCC 匹配分数 */
  score: number;
}

/**
 * RGBA 原始像素截图。
 *
 * - `data` 为行优先排列的 RGBA 字节（每像素 4 字节，无 stride padding）
 * - 尺寸与 `width * height * 4` 一致
 *
 * 可用 {@link encodePng}（`@spotterjs/core`）编码为 PNG。
 */
export interface CaptureImage {
  /** RGBA 像素 buffer */
  data: Buffer;
  width: number;
  height: number;
}

/**
 * 模板匹配（NCC）的可选参数。
 *
 * 详见 `@spotterjs/core` 文档与 `docs/MATCHING.md`。
 */
export interface MatchOptions {
  /**
   * 匹配置信度阈值，范围 0–1，默认由 native 层决定（通常 0.8）。
   * 值越高要求越严格，漏匹配风险上升；值越低误匹配风险上升。
   */
  confidence?: number;
  /**
   * 限定搜索的屏幕子区域。匹配在裁剪后的 haystack 上进行，
   * 返回的 {@link Region} 仍 translated 回**屏幕坐标**。
   */
  region?: Region;
  /**
   * 启用多尺度匹配（对 needle 做缩放后逐一尝试）。
   *
   * `true` 使用 native 默认尺度范围；对象形态可覆盖 min/max/step。
   */
  scale?:
    | boolean
    | {
        /** 多尺度下限，默认 0.8 */
        min?: number;
        /** 多尺度上限，默认 1.2 */
        max?: number;
        /** 多尺度步长，默认 0.05 */
        step?: number;
      };
}

/**
 * 轮询等待模板出现的参数。
 */
export interface MatchWaitOptions extends MatchOptions {
  /** 超时毫秒数，超时则抛错 */
  timeoutMs: number;
  /** 轮询间隔，省略则使用 native 默认值 */
  intervalMs?: number;
}

/**
 * 桌面窗口元信息。
 *
 * `id` 为平台原生句柄的字符串形式，用于 `windows` 等 API。
 */
export interface WindowInfo {
  /** 窗口 ID（十进制字符串，传给 native API） */
  id: string;
  /** 窗口 ID 的十六进制表示（便于日志） */
  idHex: string;
  /** 窗口标题 */
  title: string;
  /** 窗口外框在屏幕上的位置与尺寸 */
  region: Region;
  /** 所属进程 ID */
  processId: number;
  /** 进程名（如 `notepad.exe`） */
  processName: string;
  /** 可执行文件完整路径（若平台可获取） */
  exePath?: string;
  /** 是否最小化 */
  isMinimized: boolean;
  /** 是否为当前前台窗口 */
  isForeground: boolean;
}

/**
 * 按进程聚合的桌面应用信息。
 *
 * 一个进程可能对应多个 {@link WindowInfo}（多窗口应用）。
 */
export interface DesktopApp {
  processId: number;
  processName: string;
  exePath?: string;
  /** 该进程下的所有顶层窗口 */
  windows: WindowInfo[];
  /** 该进程是否拥有前台窗口 */
  isForeground: boolean;
}

/**
 * 模板匹配能力接口（由 `screen` 等模块实现）。
 */
export interface MatchProvider {
  /**
   * 在全屏（或 `region`）中查找第一个匹配。
   * @throws 未找到时 native 层抛出错误
   */
  find(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult>;
  /** 查找所有匹配（按 native 去重/排序规则返回） */
  findAll(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult[]>;
  /**
   * 轮询等待模板出现。
   */
  waitFor(needle: TemplateImage, options: MatchWaitOptions): Promise<MatchResult>;
}

/**
 * 计算 {@link Region} 的几何中心点（整数像素，向下取整）。
 *
 * @example
 * ```ts
 * centerOf({ left: 10, top: 20, width: 100, height: 50 })
 * // => { x: 60, y: 45 }
 * ```
 */
export function centerOf(region: Region): Point {
  return {
    x: region.left + Math.floor(region.width / 2),
    y: region.top + Math.floor(region.height / 2),
  };
}
