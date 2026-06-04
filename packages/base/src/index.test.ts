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
