import type { CaptureImage, Point, Region } from "@spotterjs/base";
import { OcrError } from "./errors";
import {
  cropImage,
  loadImage,
  preprocessImage,
  validateCaptureImage,
  validateRegion,
} from "./image";
import {
  defaultModelDir,
  ensureOcrModels,
  ocrModelBaseUrl,
  ocrModelMirrorBaseUrl,
  PPOCRV5_MOBILE_PROFILE,
  PPOCRV4_SERVER_PROFILE,
  PPOCRV5_SERVER_PROFILE,
  resolveOcrModelProfile,
  resolveLocalOcrModels,
} from "./models";
import { createOnnxOcrEngine } from "./onnx";
import { centerOf } from "./postprocess";
import type {
  CreateOcrOptions,
  EnsureOcrModelsOptions,
  OcrClient,
  OcrEngine,
  OcrFindOptions,
  OcrImage,
  OcrBuiltInModelProfileName,
  OcrModelProfile,
  OcrPreprocessOptions,
  OcrReadOptions,
  OcrSession,
  OcrTextLine,
} from "./types";

const DEFAULT_RECOGNITION_CONCURRENCY = 2;
const engineCache = new Map<string, Promise<OcrEngine>>();

export {
  OcrError,
  defaultModelDir,
  ensureOcrModels,
  ocrModelBaseUrl,
  ocrModelMirrorBaseUrl,
  PPOCRV5_MOBILE_PROFILE,
  PPOCRV4_SERVER_PROFILE,
  PPOCRV5_SERVER_PROFILE,
  resolveOcrModelProfile,
  resolveLocalOcrModels,
};
export { isOcrError } from "./errors";

export type {
  CreateOcrOptions,
  EnsureOcrModelsOptions,
  OcrClient,
  OcrEngine,
  OcrFindOptions,
  OcrImage,
  OcrBuiltInModelProfileName,
  OcrModelProfile,
  OcrPreprocessOptions,
  OcrReadOptions,
  OcrSession,
  OcrTextLine,
};
export type { OcrErrorCode, OcrErrorContext } from "./errors";

/**
 * Create a high-level OCR client.
 *
 * By default this resolves built-in model files, downloads missing artifacts
 * into the model cache, creates an ONNX engine, and caches the engine by model
 * profile and file paths. Pass `models` for local model files, `engine` for a
 * custom implementation, or `cache: false` to create a fresh engine.
 */
export async function createOcr(options: CreateOcrOptions = {}): Promise<OcrClient> {
  const engine =
    options.engine ??
    (await createCachedOnnxEngine(options));

  let client: OcrClient;
  client = {
    async read(image, readOptions) {
      const prepared = await prepareImage(image, {
        ...readOptions,
        preprocess: readOptions?.preprocess ?? options.preprocess,
      });
      const lines = await engine.read(prepared.image);
      return lines.map((line) => translateLine(line, prepared.offset));
    },

    async findText(image, text, findOptions) {
      const matches = await this.findAllText(image, text, findOptions);
      if (!matches.length) {
        throw new OcrError("OCR_TEXT_NOT_FOUND", `OCR text not found: ${text}`, {
          context: {
            text,
            exact: findOptions?.exact,
            caseSensitive: findOptions?.caseSensitive,
            minSimilarity: findOptions?.minSimilarity,
          },
        });
      }
      return matches[0];
    },

    async findAllText(image, text, findOptions) {
      const lines = await client.read(image, findOptions);
      return lines.filter((line: OcrTextLine) => textMatches(line.text, text, findOptions));
    },
  };
  return client;
}

async function prepareImage(
  source: OcrImage,
  options?: OcrReadOptions
): Promise<{ image: CaptureImage; offset: Point }> {
  const image = validateCaptureImage(await loadImage(source), "image");
  const origin = options?.origin ?? { x: 0, y: 0 };
  validatePoint(origin, "origin");
  const searchRegion = options?.searchRegion;
  if (searchRegion) validateRegion(searchRegion, "searchRegion");
  const cropped = cropImage(image, searchRegion);
  const preprocessed = await preprocessImage(cropped, options?.preprocess);
  return {
    image: preprocessed,
    offset: {
      x: origin.x + (searchRegion?.left ?? 0),
      y: origin.y + (searchRegion?.top ?? 0),
    },
  };
}

async function createCachedOnnxEngine(options: CreateOcrOptions): Promise<OcrEngine> {
  const models =
    options.models ??
    (await ensureOcrModels({
      modelDir: options.modelDir,
      profile: options.profile,
      modelProfile: options.modelProfile,
      fetchFile: options.fetchFile,
      modelSource: options.modelSource,
    }));
  const concurrency = normalizeConcurrency(options.recognitionConcurrency);
  const factory = () => createOnnxOcrEngine(models, {
    recognitionConcurrency: concurrency,
    executionProviders: options.executionProviders,
  });
  if (options.cache === false) return factory();

  const cacheKey = JSON.stringify({
    rootDir: models.rootDir,
    profile: models.profile.name,
    version: models.profile.version,
    det: models.files[models.profile.detection.modelFile],
    rec: models.files[models.profile.recognition.modelFile],
    dict: models.files[models.profile.recognition.dictionaryFile],
    concurrency,
    executionProviders: options.executionProviders,
  });
  let cached = engineCache.get(cacheKey);
  if (!cached) {
    cached = factory();
    engineCache.set(cacheKey, cached);
  }
  return cached;
}

function normalizeConcurrency(value: number | undefined): number {
  if (value === undefined) return DEFAULT_RECOGNITION_CONCURRENCY;
  if (!Number.isInteger(value) || value < 1 || value > 16) {
    throw new OcrError(
      "OCR_INVALID_ARGUMENT",
      "recognitionConcurrency must be an integer between 1 and 16",
      { context: { label: "recognitionConcurrency", value } }
    );
  }
  return value;
}

function validatePoint(point: Point, label: string): void {
  if (!Number.isFinite(point.x)) {
    throw new OcrError("OCR_INVALID_ARGUMENT", `${label}.x must be a finite number`, {
      context: { label: `${label}.x`, value: point.x },
    });
  }
  if (!Number.isFinite(point.y)) {
    throw new OcrError("OCR_INVALID_ARGUMENT", `${label}.y must be a finite number`, {
      context: { label: `${label}.y`, value: point.y },
    });
  }
}

function translateLine(line: OcrTextLine, offset: Point): OcrTextLine {
  const region: Region = {
    left: line.region.left + offset.x,
    top: line.region.top + offset.y,
    width: line.region.width,
    height: line.region.height,
  };

  return {
    ...line,
    region,
    box: line.box.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })) as OcrTextLine["box"],
    center: centerOf(region),
  };
}

function textMatches(actual: string, expected: string, options?: OcrFindOptions): boolean {
  const left = options?.caseSensitive ? actual : actual.toLowerCase();
  const right = options?.caseSensitive ? expected : expected.toLowerCase();
  if (options?.exact) return left === right;
  if (left.includes(right)) return true;
  if (options?.minSimilarity === undefined) return false;
  return textSimilarity(left, right) >= options.minSimilarity;
}

function textSimilarity(actual: string, expected: string): number {
  if (actual === expected) return 1;
  if (!actual.length || !expected.length) return 0;

  const distance = levenshtein(actual, expected);
  const scale = Math.max(actual.length, expected.length);
  return 1 - distance / scale;
}

function levenshtein(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i]![0] = i;
  for (let j = 0; j < cols; j++) dp[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j] + 1,
        dp[i]![j - 1] + 1,
        dp[i - 1]![j - 1] + cost
      );
    }
  }

  return dp[left.length]![right.length]!;
}
