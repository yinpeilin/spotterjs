import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadNative as loadUnstableNative } from "./unstable-native";
import type { SpotterNative } from "./unstable-native";

vi.mock("./native", () => ({
  loadNative: () => ({}),
}));

import * as core from "./index";

describe("public API surface", () => {
  it("exports stable high-level namespaces from the root entrypoint", () => {
    expect(core.screen).toBeDefined();
    expect(core.windows).toBeDefined();
    expect(core.image).toBeDefined();
    expect(core.mouse).toBeDefined();
    expect(core.keyboard).toBeDefined();
    expect(core.SpotterJsError).toBeDefined();
    expect(core.NativeSpotterError).toBeDefined();
    expect(core.isSpotterJsError).toBeDefined();
  });

  it("does not export removed root-level escape hatches or legacy helpers", () => {
    expect("windowApi" in core).toBe(false);
    expect("findInWindow" in core).toBe(false);
    expect("findAllInWindow" in core).toBe(false);
    expect("tapInWindow" in core).toBe(false);
    expect("loadNative" in core).toBe(false);
    expect("findInCapture" in core).toBe(false);
    expect("findAllInCapture" in core).toBe(false);
    expect("waitForInCapture" in core).toBe(false);
    expect("findNeedleInWindow" in core).toBe(false);
    expect("findNeedleInCapture" in core).toBe(false);
    expect("loadNeedleCapture" in core).toBe(false);
    expect("encodePng" in core).toBe(false);
    expect("encodePngBase64" in core).toBe(false);
    expect("captureToBase64" in core).toBe(false);
  });

  it("publishes native bindings only through explicit unstable subpaths", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

    expect(pkg.exports["./unstable-native"]).toEqual({
      types: "./dist/unstable-native.d.ts",
      require: "./dist/unstable-native.js",
      default: "./dist/unstable-native.js",
    });
    expect(pkg.exports["./native"]).toEqual(pkg.exports["./unstable-native"]);
    expect(typeof loadUnstableNative).toBe("function");

    const native: SpotterNative | null = null;
    expect(native).toBeNull();
  });
});
