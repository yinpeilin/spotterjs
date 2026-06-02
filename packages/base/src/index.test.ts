import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { centerOf } from "./index";
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
