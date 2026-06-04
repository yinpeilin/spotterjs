import {
  isSpotterError,
  SpotterError,
  toSpotterError,
  type SpotterErrorCode,
  type SpotterErrorContext,
} from "@spotterjs/base";

const NATIVE_ERROR_PREFIX = "SPOTTER_ERROR_JSON:";
const FALLBACK_NATIVE_CODE = "SPOTTER_NATIVE_OPERATION_FAILED";

type NativeErrorPayload = {
  code: SpotterErrorCode;
  message: string;
  domain: string;
  context?: SpotterErrorContext;
};

export {
  isSpotterError,
  SpotterError,
  toSpotterError,
  type SpotterErrorCode,
  type SpotterErrorContext,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function compactContext(context: SpotterErrorContext): SpotterErrorContext {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseNativePayload(error: unknown): NativeErrorPayload | undefined {
  const message = errorMessage(error);
  if (!message.startsWith(NATIVE_ERROR_PREFIX)) return undefined;

  try {
    const parsed = JSON.parse(message.slice(NATIVE_ERROR_PREFIX.length)) as unknown;
    if (!isRecord(parsed)) return undefined;
    const code = parsed.code;
    const payloadMessage = parsed.message;
    if (
      typeof code !== "string" ||
      !code.startsWith("SPOTTER_") ||
      typeof payloadMessage !== "string"
    ) {
      return undefined;
    }
    return {
      code: code as SpotterErrorCode,
      message: payloadMessage,
      domain: typeof parsed.domain === "string" ? parsed.domain : "native",
      context: isRecord(parsed.context)
        ? (parsed.context as SpotterErrorContext)
        : undefined,
    };
  } catch {
    return undefined;
  }
}

export function wrapNativeError(
  api: string,
  error: unknown,
  context: SpotterErrorContext = {}
): SpotterError {
  if (isSpotterError(error)) return toSpotterError(error);

  const payload = parseNativePayload(error);
  const message = payload?.message ?? errorMessage(error);
  const mergedContext = compactContext({
    ...(payload?.context ?? {}),
    api,
    ...context,
  });

  return new SpotterError(
    payload?.code ?? FALLBACK_NATIVE_CODE,
    `${api} failed: ${message}`,
    {
      cause: error,
      context: mergedContext,
      domain: payload?.domain ?? "native",
    }
  );
}

export function callNative<T>(
  api: string,
  context: SpotterErrorContext,
  fn: () => T
): T {
  try {
    return fn();
  } catch (error) {
    throw wrapNativeError(api, error, context);
  }
}
