import {
  isSpotterError,
  SpotterError,
  toSpotterError,
  type SpotterErrorCode,
  type SpotterErrorContext,
  type SpotterErrorOptions,
} from "@spotterjs/base";

type SpotterOcrErrorCode = `SPOTTER_OCR_${string}`;

export {
  isSpotterError,
  SpotterError,
  toSpotterError,
  type SpotterErrorCode,
  type SpotterErrorContext,
};

export function ocrError(
  code: SpotterOcrErrorCode,
  message: string,
  options: Omit<SpotterErrorOptions, "domain"> = {}
): SpotterError {
  return new SpotterError(code, message, {
    ...options,
    domain: "ocr",
  });
}
