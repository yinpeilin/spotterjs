/**
 * Rectangular area on a screen, window, capture, or device image.
 *
 * High-level desktop APIs use screen coordinates unless the API explicitly
 * says otherwise. Width and height are measured in pixels.
 */
export interface Region {
  /** X coordinate of the rectangle's left edge. */
  left: number;
  /** Y coordinate of the rectangle's top edge. */
  top: number;
  /** Rectangle width in pixels. Must be greater than zero for API inputs. */
  width: number;
  /** Rectangle height in pixels. Must be greater than zero for API inputs. */
  height: number;
}

/**
 * Point in a two-dimensional coordinate space, measured in pixels.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Template image input for NCC matching.
 *
 * - `string` always means an image file path.
 * - `Buffer` always means encoded image bytes (PNG/JPEG/WebP), not raw RGBA.
 */
export type TemplateImage = string | Buffer;

/**
 * Result from one template match.
 *
 * Desktop `screen` and `windows` APIs return screen coordinates. Android
 * plugin APIs return Android device screenshot coordinates. `image.find`
 * returns coordinates relative to the provided capture.
 */
export interface MatchResult {
  /** Matched bounding box in the API's documented coordinate space. */
  region: Region;
  /** Center point of {@link region}. */
  center: Point;
  /** NCC score. Higher values are stronger matches. */
  score: number;
}

/**
 * Raw RGBA image capture.
 *
 * `data` is row-major RGBA bytes with 4 bytes per pixel and no stride padding.
 * Its byte length should equal `width * height * 4`.
 *
 * Use `encodePng` from `@spotterjs/core` to encode it as PNG bytes.
 */
export interface CaptureImage {
  /** Row-major RGBA pixel buffer. */
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Options for NCC template matching.
 *
 * See the template matching guide for path buffers, encoded buffers, search
 * regions, scale search, and coordinate behavior.
 */
export interface MatchOptions {
  /**
   * Minimum match confidence, from 0 to 1.
   *
   * Higher values reduce false positives but may miss weak matches. Lower
   * values find more candidates but increase false-positive risk. The native
   * default is used when omitted.
   */
  confidence?: number;
  /**
   * Limit matching to a sub-region.
   *
   * Desktop `screen` APIs translate returned regions back to screen
   * coordinates. `image.find` treats this as a crop inside the provided
   * capture.
   */
  region?: Region;
  /**
   * Enable multi-scale matching by resizing the needle across a range.
   *
   * `true` uses native defaults. Object form overrides the range and step.
   */
  scale?:
    | boolean
    | {
        /** Minimum scale factor. Native default is typically `0.8`. */
        min?: number;
        /** Maximum scale factor. Native default is typically `1.2`. */
        max?: number;
        /** Scale step. Native default is typically `0.05`. */
        step?: number;
      };
}

/**
 * Options for polling until a template appears.
 */
export interface MatchWaitOptions extends MatchOptions {
  /** Timeout in milliseconds. The wait API throws when the deadline passes. */
  timeoutMs: number;
  /** Delay between attempts. Native defaults are used when omitted. */
  intervalMs?: number;
}

/**
 * Desktop window metadata.
 *
 * `id` is a string representation of the native window handle and is accepted
 * by `windows` APIs.
 */
export interface WindowInfo {
  /** Native window ID as a decimal string. */
  id: string;
  /** Native window ID as a hexadecimal string for logs and diagnostics. */
  idHex: string;
  /** Window title. */
  title: string;
  /** Window outer-frame region in screen coordinates. */
  region: Region;
  /** Owning process ID. */
  processId: number;
  /** Process name, such as `notepad.exe`. */
  processName: string;
  /** Full executable path when the platform can provide it. */
  exePath?: string;
  /** Whether the window is minimized. */
  isMinimized: boolean;
  /** Whether this is the current foreground window. */
  isForeground: boolean;
}

/**
 * Desktop application metadata grouped by process.
 *
 * A process can own multiple top-level windows.
 */
export interface DesktopApp {
  processId: number;
  processName: string;
  exePath?: string;
  /** Top-level windows owned by this process. */
  windows: WindowInfo[];
  /** Whether this process owns the foreground window. */
  isForeground: boolean;
}

/**
 * Template matching provider implemented by high-level modules such as
 * `screen`.
 */
export interface MatchProvider {
  /**
   * Find the best match.
   * @throws When no match reaches the configured confidence threshold.
   */
  find(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult>;
  /** Find all matches after native de-duplication and sorting. */
  findAll(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult[]>;
  /**
   * Poll until a template appears or the timeout expires.
   */
  waitFor(needle: TemplateImage, options: MatchWaitOptions): Promise<MatchResult>;
}

/**
 * Return the integer center point of a region, rounded down.
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
