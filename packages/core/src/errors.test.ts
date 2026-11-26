import { describe, expect, it } from "vitest";
import {
  SpotterError,
  formatSpotterError,
  isSpotterError,
  wrapNativeError,
} from "./errors";
import { nativeLoadError } from "./unstable-native";

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

  it("attaches actionable hints for native error codes while keeping message intact", () => {
    const cause = new Error(
      `SPOTTER_ERROR_JSON:${JSON.stringify({
        code: "SPOTTER_NATIVE_ACCESSIBILITY_DISABLED",
        message: "accessibility is disabled; call enable() first",
        domain: "native",
        context: {},
      })}`
    );
    const wrapped = wrapNativeError("accessibility.attach", cause);

    expect(wrapped.message).toBe(
      "accessibility.attach failed: accessibility is disabled; call enable() first"
    );
    expect(wrapped.hint).toContain("accessibility.enable()");
    expect(formatSpotterError(wrapped)).toContain(
      "[SPOTTER_NATIVE_ACCESSIBILITY_DISABLED]"
    );
  });
});

describe("nativeLoadError", () => {
  it("explains missing @spotterjs/node optional binary packages with hint", () => {
    const missingPlatform = nativeLoadError(
      new Error("Cannot find module '@spotterjs/node-win32-x64-msvc'")
    );

    expect(missingPlatform).toMatchObject({
      code: "SPOTTER_NATIVE_PACKAGE_MISSING",
      domain: "native",
      context: { missingPackage: "@spotterjs/node-win32-x64-msvc" },
    });
    expect(missingPlatform.hint).toContain("--include=optional");
  });

  it("diagnoses Windows DLL load failures with native addon diagnostics", () => {
    const nodePath =
      "C:\\app\\node_modules\\@spotterjs\\node-win32-x64-msvc\\index.win32-x64-msvc.node";
    const err = Object.assign(
      new Error(`The specified module could not be found.\r\n${nodePath}`),
      { code: "ERR_DLOPEN_FAILED" }
    );
    const wrapped = nativeLoadError(err, {
      platform: "win32",
      arch: "x64",
      osRelease: "10.0.19045",
      existsSync: (target) => target === nodePath,
    });

    expect(wrapped).toMatchObject({
      code: "SPOTTER_NATIVE_LOAD_FAILED",
      domain: "native",
      context: {
        failureKind: "windows-dll-not-found",
        nodePath,
        nodeFileExists: true,
      },
    });
    expect(wrapped.message).toContain("Win32 error 126");
    expect(wrapped.hint).toContain("Visual C++ 2015-2022 Redistributable");
  });
});
