import {
  formatSpotterError,
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
  formatSpotterError,
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

export function nativeErrorHint(
  code: SpotterErrorCode,
  message: string,
  context?: SpotterErrorContext
): string | undefined {
  switch (code) {
    case "SPOTTER_NATIVE_WINDOW_NOT_FOUND":
      return "Refresh the window list with windows.list() and confirm the window is still open.";
    case "SPOTTER_NATIVE_FOCUS_DENIED":
      return "Windows may restrict background focus changes; verify the window is not elevated above this process and is not minimized.";
    case "SPOTTER_NATIVE_MATCH_NOT_FOUND":
      return "Check that the target UI is visible and unoccluded, verify DPI/theme parity, or try a lower confidence or scale search.";
    case "SPOTTER_NATIVE_MATCH_TIMEOUT":
      return "Increase timeoutMs, confirm the target appears in the expected region, or check template confidence.";
    case "SPOTTER_NATIVE_CAPTURE_FAILED":
      return "Verify the screen or window is visible (not minimized), coordinates are within display bounds, and the desktop session is unlocked.";
    case "SPOTTER_NATIVE_INVALID_WINDOW_ID":
      return "Pass a valid window ID string returned by windows.list() or desktop.findWindows().";
    case "SPOTTER_NATIVE_PLATFORM_ERROR":
      if (/SetCursorPos|SendInput|inputDesktop|threadDesktop/i.test(message) || context?.diagnostics) {
        return "Run automation in an unlocked interactive user session; check Remote Desktop state, UAC elevation mismatch, or protected (secure) desktop prompts.";
      }
      return "Inspect error.context for OS error codes or diagnostics from the platform API.";
    case "SPOTTER_NATIVE_IO_ERROR":
      return "Verify that the file path exists and the process has read/write permissions.";
    case "SPOTTER_NATIVE_IMAGE_ERROR":
      return "Verify that the image file/buffer is a valid PNG, JPEG, or WebP and matches expected RGBA width * height * 4 dimensions.";
    case "SPOTTER_NATIVE_UNSUPPORTED_PLATFORM":
      return "This capability is not implemented on the current OS/architecture.";
    case "SPOTTER_NATIVE_PLUGIN_ERROR":
      return "Inspect the native plugin error details and matching backend configuration.";
    case "SPOTTER_NATIVE_ACCESSIBILITY_DISABLED":
      return "Call accessibility.enable() before attaching to a window or querying elements.";
    case "SPOTTER_NATIVE_ACCESSIBILITY_NOT_SUPPORTED":
      return "Accessibility automation is unavailable on this platform/environment.";
    case "SPOTTER_NATIVE_ELEMENT_NOT_FOUND":
      return "Re-attach or call accessibility.debug.dumpTree() to inspect current element names, control types, and automationIds.";
    case "SPOTTER_NATIVE_PATTERN_NOT_SUPPORTED":
      return "This control does not expose the requested accessibility pattern; fall back to accessibility.click() or template matching.";
    case "SPOTTER_NATIVE_TREE_UNAVAILABLE":
      return "Focus the window, try another treeView ('raw' or 'control'), or increase treeWaitTimeoutMs in accessibility.enable().";
    default:
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
  const code = payload?.code ?? FALLBACK_NATIVE_CODE;
  const message = payload?.message ?? errorMessage(error);
  const mergedContext = compactContext({
    ...(payload?.context ?? {}),
    api,
    ...context,
  });

  return new SpotterError(
    code,
    `${api} failed: ${message}`,
    {
      cause: error,
      context: mergedContext,
      domain: payload?.domain ?? "native",
      hint: nativeErrorHint(code, message, mergedContext),
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
