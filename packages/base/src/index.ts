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

export type SpotterErrorCode = `SPOTTER_${string}`;
export type SpotterErrorContext = Record<string, unknown>;

export type SpotterErrorOptions = {
  context?: SpotterErrorContext;
  cause?: unknown;
  domain?: string;
};

export type ToSpotterErrorOptions = SpotterErrorOptions & {
  code?: SpotterErrorCode;
  message?: string;
};

export class SpotterError extends Error {
  readonly code: SpotterErrorCode;
  readonly context?: SpotterErrorContext;
  readonly cause?: unknown;
  readonly domain?: string;

  constructor(
    code: SpotterErrorCode,
    message: string,
    options: SpotterErrorOptions = {}
  ) {
    super(message);
    this.name = "SpotterError";
    this.code = code;
    this.context = options.context;
    this.cause = options.cause;
    this.domain = options.domain;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSpotterError(error: unknown): error is SpotterError {
  if (error instanceof SpotterError) return true;
  if (!isRecord(error)) return false;
  return (
    error.name === "SpotterError" &&
    typeof error.message === "string" &&
    typeof error.code === "string" &&
    error.code.startsWith("SPOTTER_")
  );
}

export function toSpotterError(
  error: unknown,
  options: ToSpotterErrorOptions = {}
): SpotterError {
  if (error instanceof SpotterError) return error;
  if (isSpotterError(error)) {
    return new SpotterError(error.code, error.message, {
      cause: options.cause ?? error,
      context:
        options.context ??
        (isRecord(error.context) ? (error.context as SpotterErrorContext) : undefined),
      domain:
        options.domain ??
        (typeof error.domain === "string" ? error.domain : undefined),
    });
  }

  const message =
    options.message ?? (error instanceof Error ? error.message : String(error));
  return new SpotterError(options.code ?? "SPOTTER_UNKNOWN_ERROR", message, {
    cause: options.cause ?? error,
    context: options.context,
    domain: options.domain,
  });
}

/**
 * Point in a two-dimensional coordinate space, measured in pixels.
 */
export interface Point {
  x: number;
  y: number;
}

/** RGB color with 8-bit channel values. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Template image input for template matching.
 *
 * - `string` always means an image file path.
 * - `Buffer` always means encoded image bytes (PNG/JPEG/WebP), not raw RGBA.
 */
export type TemplateImage = string | Buffer;

/** Matching algorithm that produced a normalized match score. */
export type MatchAlgorithm = "ncc" | "feature" | "ocr-text";

/** Template matching backend. */
export type MatchBackend = "ncc" | "feature";

/** Text matching strategy used for OCR text lookup diagnostics. */
export type TextMatchKind = "exact" | "contains" | "similarity" | "none";

/** Normalized match score shared by visual and text matching results. */
export interface MatchScore {
  /** Normalized match score from 0 to 1. Higher values are stronger matches. */
  matchScore: number;
  /** Algorithm that produced {@link matchScore}. */
  matchAlgorithm: MatchAlgorithm;
}

/** Text match evaluation for one recognized text candidate. */
export interface TextMatchEvaluation extends MatchScore {
  matchAlgorithm: "ocr-text";
  /** Query text used for the comparison. */
  query: string;
  /** Whether this candidate satisfies the requested matching options. */
  matched: boolean;
  /** Matching strategy that produced the candidate score. */
  matchKind: TextMatchKind;
}

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
  /** Backend-native match score. Higher values are stronger matches. */
  score: number;
  /** Normalized match score. For template matching this is the same value as {@link score}. */
  matchScore: number;
  /** Match algorithm used to produce this result. */
  matchAlgorithm: MatchBackend;
}

/**
 * Raw RGBA image capture.
 *
 * `data` is row-major RGBA bytes with 4 bytes per pixel and no stride padding.
 * Its byte length should equal `width * height * 4`.
 *
 * Use `image.encode` from `@spotterjs/core` to encode it as PNG bytes.
 */
export interface CaptureImage {
  /** Row-major RGBA pixel buffer. */
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Options for template matching.
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
   * Enable NCC multi-scale matching by resizing the needle across a range.
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
  /**
   * Matching backend. `ncc` is fast and precise for same-scale UI; `feature`
   * is slower but more tolerant of scale and rotation.
   */
  backend?: MatchBackend;
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
 *
 * Method names mirror the `screen` and `windows` APIs so providers stay
 * interchangeable.
 */
export interface MatchProvider {
  /**
   * Find the best match.
   * @throws When no match reaches the configured confidence threshold.
   */
  findTemplate(needle: TemplateImage, options?: MatchOptions): Promise<MatchResult>;
  /** Find all matches after native de-duplication and sorting. */
  findAllTemplates(
    needle: TemplateImage,
    options?: MatchOptions
  ): Promise<MatchResult[]>;
  /**
   * Poll until a template appears or the timeout expires.
   */
  waitForTemplate(
    needle: TemplateImage,
    options: MatchWaitOptions
  ): Promise<MatchResult>;
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
