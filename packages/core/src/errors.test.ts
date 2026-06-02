import { describe, expect, it } from "vitest";
import {
  NativeSpotterError,
  SpotterJsError,
  isSpotterJsError,
  nativeErrorCode,
  wrapNativeError,
} from "./errors";

describe("SpotterJsError", () => {
  it("keeps stable code, context, and cause", () => {
    const cause = new Error("native failed");
    const error = new SpotterJsError("HOST_PATH_ERROR", "path failed", {
      cause,
      context: { path: "a.txt" },
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SpotterJsError");
    expect(error.code).toBe("HOST_PATH_ERROR");
    expect(error.context).toEqual({ path: "a.txt" });
    expect(error.cause).toBe(cause);
    expect(isSpotterJsError(error)).toBe(true);
    expect(isSpotterJsError(cause)).toBe(false);
  });
});

describe("nativeErrorCode", () => {
  it("maps raw native codes to public native error codes", () => {
    expect(nativeErrorCode({ code: "MATCH_NOT_FOUND" })).toBe("NATIVE_MATCH_NOT_FOUND");
    expect(nativeErrorCode({ code: "MATCH_TIMEOUT" })).toBe("NATIVE_MATCH_TIMEOUT");
    expect(nativeErrorCode({ code: "CAPTURE_FAILED" })).toBe("NATIVE_CAPTURE_FAILED");
    expect(nativeErrorCode({ code: "INVALID_WINDOW_ID" })).toBe("NATIVE_INVALID_WINDOW_ID");
    expect(nativeErrorCode({ code: "WINDOW_NOT_FOUND" })).toBe("NATIVE_WINDOW_NOT_FOUND");
    expect(nativeErrorCode({ code: "UNSUPPORTED_PLATFORM" })).toBe("NATIVE_UNSUPPORTED_PLATFORM");
    expect(nativeErrorCode({ code: "ACCESSIBILITY_DISABLED" })).toBe("NATIVE_ACCESSIBILITY_DISABLED");
    expect(nativeErrorCode({ code: "ACCESSIBILITY_NOT_SUPPORTED" })).toBe(
      "NATIVE_ACCESSIBILITY_NOT_SUPPORTED"
    );
    expect(nativeErrorCode({ code: "ELEMENT_NOT_FOUND" })).toBe("NATIVE_ELEMENT_NOT_FOUND");
  });

  it("prefers bracketed native codes in error messages", () => {
    const error = new Error("[MATCH_TIMEOUT] waited too long") as Error & { code?: string };
    error.code = "CAPTURE_FAILED";

    expect(nativeErrorCode(error)).toBe("NATIVE_MATCH_TIMEOUT");
  });

  it("falls back to operation failure for unknown errors", () => {
    expect(nativeErrorCode(new Error("boom"))).toBe("NATIVE_OPERATION_FAILED");
    expect(nativeErrorCode("plain failure")).toBe("NATIVE_OPERATION_FAILED");
  });
});

describe("wrapNativeError", () => {
  it("wraps arbitrary failures with stable context", () => {
    const cause = new Error("missing");
    const wrapped = wrapNativeError("screen.find", cause, {
      needle: "path",
      confidence: 0.9,
    });

    expect(wrapped).toBeInstanceOf(NativeSpotterError);
    expect(wrapped).toMatchObject({
      name: "NativeSpotterError",
      code: "NATIVE_OPERATION_FAILED",
      message: "screen.find failed: missing",
      context: {
        api: "screen.find",
        needle: "path",
        confidence: 0.9,
      },
    });
    expect(wrapped.cause).toBe(cause);
  });

  it("does not rewrap an existing NativeSpotterError", () => {
    const existing = new NativeSpotterError("NATIVE_MATCH_NOT_FOUND", "already wrapped");

    expect(wrapNativeError("screen.find", existing)).toBe(existing);
  });
});
