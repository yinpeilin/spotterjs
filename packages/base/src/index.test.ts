import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { centerOf, isSpotterError, SpotterError, toSpotterError } from "./index";
import type { MatchResult, TextMatchEvaluation } from "./index";

const nccMatch: MatchResult = {
  region: { left: 1, top: 2, width: 3, height: 4 },
  center: { x: 2, y: 4 },
  score: 0.94,
  matchScore: 0.94,
  matchAlgorithm: "ncc",
};

const textEvaluation: TextMatchEvaluation = {
  query: "Send",
  matched: true,
  matchScore: 1,
  matchAlgorithm: "ocr-text",
  matchKind: "exact",
};

void nccMatch;
void textEvaluation;

describe("centerOf", () => {
  it("returns midpoint for even width and height", () => {
    expect(centerOf({ left: 0, top: 0, width: 10, height: 10 })).toEqual({
      x: 5,
      y: 5,
    });
  });

  it("returns midpoint for odd width and height", () => {
    expect(centerOf({ left: 0, top: 0, width: 11, height: 11 })).toEqual({
      x: 5,
      y: 5,
    });
  });

  it("offsets the center by the region origin", () => {
    expect(centerOf({ left: 100, top: 200, width: 40, height: 20 })).toEqual({
      x: 120,
      y: 210,
    });
  });

  it("supports negative origins", () => {
    expect(centerOf({ left: -20, top: -10, width: 10, height: 10 })).toEqual({
      x: -15,
      y: -5,
    });
  });
});

describe("SpotterError", () => {
  it("keeps a stable code, domain, context, and cause", () => {
    const cause = new Error("native failed");
    const error = new SpotterError(
      "SPOTTER_NATIVE_CAPTURE_FAILED",
      "capture failed",
      {
        cause,
        context: { api: "screen.capture" },
        domain: "native",
      }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SpotterError");
    expect(error.code).toBe("SPOTTER_NATIVE_CAPTURE_FAILED");
    expect(error.domain).toBe("native");
    expect(error.context).toEqual({ api: "screen.capture" });
    expect(error.cause).toBe(cause);
    expect(isSpotterError(error)).toBe(true);
  });

  it("recognizes structurally equivalent spotter errors", () => {
    expect(
      isSpotterError({
        name: "SpotterError",
        message: "failed",
        code: "SPOTTER_OCR_TEXT_NOT_FOUND",
      })
    ).toBe(true);
    expect(isSpotterError(new Error("plain"))).toBe(false);
  });

  it("rejects non-spotter shapes and primitives", () => {
    expect(isSpotterError(null)).toBe(false);
    expect(isSpotterError(undefined)).toBe(false);
    expect(isSpotterError("SPOTTER_X")).toBe(false);
    expect(
      isSpotterError({ name: "SpotterError", message: "x", code: "OOPS" })
    ).toBe(false);
    expect(
      isSpotterError({ name: "OtherError", message: "x", code: "SPOTTER_X" })
    ).toBe(false);
  });

  it("converts unknown thrown values into SpotterError", () => {
    const cause = new Error("boom");
    const error = toSpotterError(cause, {
      code: "SPOTTER_NATIVE_OPERATION_FAILED",
      context: { api: "screen.find" },
      domain: "native",
    });

    expect(error).toMatchObject({
      name: "SpotterError",
      code: "SPOTTER_NATIVE_OPERATION_FAILED",
      message: "boom",
      context: { api: "screen.find" },
      domain: "native",
    });
    expect(error.cause).toBe(cause);
  });

  it("returns the same instance for an existing SpotterError", () => {
    const original = new SpotterError("SPOTTER_OCR_TEXT_NOT_FOUND", "missing");
    expect(toSpotterError(original)).toBe(original);
  });

  it("rebuilds structural spotter errors and preserves code and context", () => {
    const structural = {
      name: "SpotterError",
      message: "structural failure",
      code: "SPOTTER_NATIVE_CAPTURE_FAILED",
      context: { api: "windows.capture" },
      domain: "native",
    };

    const error = toSpotterError(structural);

    expect(error).toBeInstanceOf(SpotterError);
    expect(error.code).toBe("SPOTTER_NATIVE_CAPTURE_FAILED");
    expect(error.context).toEqual({ api: "windows.capture" });
    expect(error.domain).toBe("native");
    expect(error.cause).toBe(structural);
  });

  it("defaults unknown non-error values to SPOTTER_UNKNOWN_ERROR", () => {
    const error = toSpotterError("just a string");

    expect(error.code).toBe("SPOTTER_UNKNOWN_ERROR");
    expect(error.message).toBe("just a string");
    expect(error.cause).toBe("just a string");
  });

  it("uses an explicit message override for unknown values", () => {
    const error = toSpotterError({ weird: true }, { message: "overridden" });

    expect(error.code).toBe("SPOTTER_UNKNOWN_ERROR");
    expect(error.message).toBe("overridden");
  });
});

describe("package exports", () => {
  it("publishes only the root entrypoint and package metadata", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

    expect(pkg.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        require: "./dist/index.js",
        default: "./dist/index.js",
      },
      "./package.json": "./package.json",
    });
  });
});
