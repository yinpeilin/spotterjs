export type OcrErrorCode =
  | "OCR_MODEL_PROFILE_UNKNOWN"
  | "OCR_MODEL_FILE_MISSING"
  | "OCR_MODEL_DOWNLOAD_FAILED"
  | "OCR_MODEL_SHA256_MISMATCH"
  | "OCR_MODEL_MANIFEST_INVALID"
  | "OCR_TEXT_NOT_FOUND"
  | "OCR_INVALID_ARGUMENT"
  | "OCR_IMAGE_INVALID"
  | "OCR_ONNX_INVALID_OUTPUT";

/** Structured diagnostic details attached to OCR errors. */
export type OcrErrorContext = Record<string, unknown>;

/** Error thrown by OCR model loading, image decoding, inference, and text lookup helpers. */
export class OcrError extends Error {
  /** Stable machine-readable OCR error code. */
  readonly code: OcrErrorCode;
  /** Additional diagnostic context such as profile, path, checksum, or query values. */
  readonly context?: OcrErrorContext;
  /** Original lower-level error when this wraps another failure. */
  readonly cause?: unknown;

  constructor(
    code: OcrErrorCode,
    message: string,
    options: { context?: OcrErrorContext; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "OcrError";
    this.code = code;
    this.context = options.context;
    this.cause = options.cause;
  }
}

/** Return true when an unknown value is an `OcrError`. */
export function isOcrError(error: unknown): error is OcrError {
  return error instanceof OcrError;
}
