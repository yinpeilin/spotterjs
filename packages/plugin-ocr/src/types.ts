import type { CaptureImage, Point, Region } from "@spotterjs/base";
import type { InferenceSession } from "onnxruntime-node";

/** OCR input image: raw capture, encoded image bytes, or an image file path. */
export type OcrImage = CaptureImage | Buffer | string;

/** One recognized text line with geometry and confidence. */
export type OcrTextLine = {
  /** Recognized text. */
  text: string;
  /** Recognition confidence. Higher values are more confident. */
  score: number;
  /** Axis-aligned bounding region in the output coordinate space. */
  region: Region;
  /** Four-point text box in clockwise order. */
  box: [Point, Point, Point, Point];
  /** Center point of {@link region}. */
  center: Point;
};

/** Options applied before OCR reads text. */
export type OcrReadOptions = {
  /** Coordinate offset added to returned regions and boxes. */
  origin?: Point;
  /** Optional crop region inside the input image before OCR. */
  searchRegion?: Region;
  /** Optional image preprocessing before OCR inference. */
  preprocess?: OcrPreprocessOptions | boolean;
};

/** Options for text lookup after OCR reading. */
export type OcrFindOptions = OcrReadOptions & {
  /** Require exact text equality instead of substring matching. */
  exact?: boolean;
  /** Preserve case when comparing text. Defaults to case-insensitive matching. */
  caseSensitive?: boolean;
  /** Minimum normalized similarity required when exact/contains matching does not apply. */
  minSimilarity?: number;
};

/** One model artifact in an OCR model profile. */
export type OcrModelFile = {
  name: string;
  url: string;
  mirrorUrl?: string;
  sha256: string;
};

/** Detection model configuration. */
export type OcrDetectionConfig = {
  modelFile: string;
  inputWidth: number;
  inputHeight: number;
  mean: [number, number, number];
  std: [number, number, number];
  boxThreshold: number;
  inputName?: string;
};

/** Recognition model configuration. */
export type OcrRecognitionConfig = {
  modelFile: string;
  dictionaryFile: string;
  inputWidth: number;
  inputHeight: number;
  mean: [number, number, number];
  std: [number, number, number];
  inputName?: string;
};

/** Complete OCR model profile used to locate and run model files. */
export type OcrModelProfile = {
  name: string;
  version: string;
  files: OcrModelFile[];
  detection: OcrDetectionConfig;
  recognition: OcrRecognitionConfig;
};

/** Resolved local model paths for a profile. */
export type ResolvedOcrModels = {
  profile: OcrModelProfile;
  rootDir: string;
  files: Record<string, string>;
};

/** Custom downloader hook used by model resolution. */
export type FetchFile = (url: string) => Promise<Buffer>;

/** Download source preference for built-in model files. */
export type OcrModelSource = "auto" | "origin" | "mirror";
/** Built-in OCR profile aliases. */
export type OcrBuiltInModelProfileName =
  | "server"
  | "large"
  | "mobile"
  | "ppocrv4-server"
  | "ppocrv5-server"
  | "ppocrv5-mobile";

/** ONNX Runtime execution providers, in priority order. */
export type OcrExecutionProvider = InferenceSession.ExecutionProviderConfig;

/** Lightweight OCR image preprocessing options. */
export type OcrPreprocessOptions = {
  /** Convert image to grayscale while preserving RGBA shape. */
  grayscale?: boolean;
  /** Stretch luminance range to improve low-contrast text. */
  normalize?: boolean;
  /** Sharpen text edges. */
  sharpen?: boolean;
  /** Upscale before OCR. Values above 1 can help small text. */
  scale?: number;
};

/** Options for downloading or resolving OCR model files. */
export type EnsureOcrModelsOptions = {
  /** Model cache directory. Defaults to the platform cache directory. */
  modelDir?: string;
  /** Custom model profile. Overrides `modelProfile`. */
  profile?: OcrModelProfile;
  /** Built-in model profile name. */
  modelProfile?: OcrBuiltInModelProfileName;
  /** Optional fetch override for tests or private distribution. */
  fetchFile?: FetchFile;
  /** Preferred download source. */
  modelSource?: OcrModelSource;
};

/** Minimal ONNX-like session shape used by OCR engines. */
export type OcrSession = {
  inputNames?: string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, unknown>>;
};

/** OCR engine implementation consumed by {@link createOcr}. */
export type OcrEngine = {
  read(image: CaptureImage): Promise<OcrTextLine[]>;
};

/** Options for creating an OCR client. */
export type CreateOcrOptions = EnsureOcrModelsOptions & {
  /** Provide a custom OCR engine instead of creating an ONNX engine. */
  engine?: OcrEngine;
  /** Pre-resolved model files. Skips model download. */
  models?: ResolvedOcrModels;
  /** Disable engine caching when set to `false`. */
  cache?: boolean;
  /** Maximum concurrent recognition jobs. Must be an integer from 1 to 16. */
  recognitionConcurrency?: number;
  /** ONNX Runtime execution providers, in priority order. */
  executionProviders?: readonly OcrExecutionProvider[];
  /** Default preprocessing applied before OCR inference. */
  preprocess?: OcrPreprocessOptions | boolean;
};

/** High-level OCR client. */
export type OcrClient = {
  /** Read all text lines from an image. */
  read(image: OcrImage, options?: OcrReadOptions): Promise<OcrTextLine[]>;
  /** Find the first matching text line or throw when none match. */
  findText(
    image: OcrImage,
    text: string,
    options?: OcrFindOptions
  ): Promise<OcrTextLine>;
  /** Find all matching text lines. */
  findAllText(
    image: OcrImage,
    text: string,
    options?: OcrFindOptions
  ): Promise<OcrTextLine[]>;
};
