import { describe, expect, it } from "vitest";
import {
  SpotterError,
  isSpotterError,
  wrapNativeError,
} from "./errors";

describe("wrapNativeError", () => {
  it("parses native JSON payloads into unified SpotterError", () => {
    const cause = new Error(
      `SPOTTER_ERROR_JSON:${JSON.stringify({
        code: "SPOTTER_NATIVE_MATCH_NOT_FOUND",
        message: "image match not found (confidence >= 0.9)",
        domain: "native",
        context: { confidence: 0.9 },
      })}`
    );
    const wrapped = wrapNativeError("screen.find", cause, {
      needle: "path",
    });

    expect(wrapped).toBeInstanceOf(SpotterError);
    expect(wrapped).toMatchObject({
      name: "SpotterError",
      code: "SPOTTER_NATIVE_MATCH_NOT_FOUND",
      message: "screen.find failed: image match not found (confidence >= 0.9)",
      domain: "native",
      context: {
        confidence: 0.9,
        api: "screen.find",
        needle: "path",
      },
    });
    expect(wrapped.cause).toBe(cause);
    expect(isSpotterError(wrapped)).toBe(true);
  });

  it("wraps arbitrary native failures with a fallback code", () => {
    const cause = new Error("missing");
    const wrapped = wrapNativeError("screen.find", cause, { needle: "path" });

    expect(wrapped).toMatchObject({
      name: "SpotterError",
      code: "SPOTTER_NATIVE_OPERATION_FAILED",
      message: "screen.find failed: missing",
      domain: "native",
      context: {
        api: "screen.find",
        needle: "path",
      },
    });
    expect(wrapped.cause).toBe(cause);
  });

  it("does not rewrap an existing SpotterError", () => {
    const existing = new SpotterError(
      "SPOTTER_NATIVE_MATCH_NOT_FOUND",
      "already wrapped",
      { domain: "native" }
    );

    expect(wrapNativeError("screen.find", existing)).toBe(existing);
  });
});
