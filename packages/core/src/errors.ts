export type SpotterErrorContext = Record<string, unknown>;

export class SpotterJsError extends Error {
  readonly code: string;
  readonly context?: SpotterErrorContext;
  readonly cause?: unknown;

  constructor(
    code: string,
    message: string,
    options: { context?: SpotterErrorContext; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "SpotterJsError";
    this.code = code;
    this.context = options.context;
    this.cause = options.cause;
  }
}

export class NativeSpotterError extends SpotterJsError {
  constructor(
    code: string,
    message: string,
    options: { context?: SpotterErrorContext; cause?: unknown } = {}
  ) {
    super(code, message, options);
    this.name = "NativeSpotterError";
  }
}

export function isSpotterJsError(error: unknown): error is SpotterJsError {
  return error instanceof SpotterJsError;
}

export function nativeErrorCode(error: unknown): string {
  const raw =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : String(error);
  const bracketCode = /^\[([A-Z0-9_]+)\]\s/.exec(message)?.[1];
  switch (bracketCode ?? raw) {
    case "MATCH_NOT_FOUND":
    case "NATIVE_MATCH_NOT_FOUND":
      return "NATIVE_MATCH_NOT_FOUND";
    case "MATCH_TIMEOUT":
    case "NATIVE_MATCH_TIMEOUT":
      return "NATIVE_MATCH_TIMEOUT";
    case "CAPTURE_FAILED":
    case "NATIVE_CAPTURE_FAILED":
      return "NATIVE_CAPTURE_FAILED";
    case "INVALID_WINDOW_ID":
    case "NATIVE_INVALID_WINDOW_ID":
      return "NATIVE_INVALID_WINDOW_ID";
    case "WINDOW_NOT_FOUND":
    case "NATIVE_WINDOW_NOT_FOUND":
      return "NATIVE_WINDOW_NOT_FOUND";
    case "UNSUPPORTED_PLATFORM":
    case "NATIVE_UNSUPPORTED_PLATFORM":
      return "NATIVE_UNSUPPORTED_PLATFORM";
    case "ACCESSIBILITY_DISABLED":
    case "NATIVE_ACCESSIBILITY_DISABLED":
      return "NATIVE_ACCESSIBILITY_DISABLED";
    case "ACCESSIBILITY_NOT_SUPPORTED":
    case "NATIVE_ACCESSIBILITY_NOT_SUPPORTED":
      return "NATIVE_ACCESSIBILITY_NOT_SUPPORTED";
    case "ELEMENT_NOT_FOUND":
    case "NATIVE_ELEMENT_NOT_FOUND":
      return "NATIVE_ELEMENT_NOT_FOUND";
    default:
      return "NATIVE_OPERATION_FAILED";
  }
}

export function wrapNativeError(
  api: string,
  error: unknown,
  context: SpotterErrorContext = {}
): NativeSpotterError {
  if (error instanceof NativeSpotterError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new NativeSpotterError(nativeErrorCode(error), `${api} failed: ${message}`, {
    cause: error,
    context: { api, ...context },
  });
}
